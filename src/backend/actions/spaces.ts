"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db, isUniqueViolationOn } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { getSpace, listSpaces } from "@/backend/data/spaces";
import { message } from "@/backend/i18n/message";
import { ACCENT_TOKENS, type SpaceSummary } from "@/shared/domain/types";
import type { TranslationKey } from "@/shared/i18n";
import { fail, guarded, logActivity, ok, type ActionResult } from "./shared";

/**
 * Writes for the sections of a workspace.
 *
 * A section is a shared container, not private property: any member may make
 * one, rename one and file work into it. What is checked on every call is
 * that the section belongs to the caller's workspace — the id arrives from
 * the browser and is never trusted on its own.
 *
 * Deleting is the one place where the policy is worth stating out loud. It
 * removes the container and nothing else: `Task.spaceId` is `SetNull`, so the
 * work inside reappears under "No section" rather than disappearing with the
 * folder somebody tidied away.
 */

const NAME_MAX = 60;
const DESCRIPTION_MAX = 200;

/** Sections are spaced 100 apart so one can be dropped between two others. */
const POSITION_STEP = 100;

async function assertSpaceInWorkspace(id: string, workspaceId: string) {
  const space = await db.space.findFirst({
    where: { id, workspaceId },
    select: { id: true, name: true, colorToken: true, description: true },
  });
  if (!space) throw new Error(await message("errors.space.gone"));
  return space;
}

const createInput = z.object({
  name: z.string().trim().min(1, "errors.space.needsName").max(NAME_MAX),
  colorToken: z.enum(ACCENT_TOKENS).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
});

export async function createSpace(
  raw: z.input<typeof createInput>,
): Promise<ActionResult<SpaceSummary>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = createInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issue(parsed.error.issues[0]?.message, "errors.space.invalid"));
    }
    const input = parsed.data;

    const last = await db.space.findFirst({
      where: { workspaceId: session.workspace.id },
      select: { position: true },
      orderBy: { position: "desc" },
    });

    let created: { id: string };
    try {
      created = await db.space.create({
        data: {
          workspaceId: session.workspace.id,
          name: input.name,
          colorToken: input.colorToken ?? "violet",
          description: input.description?.trim() || null,
          position: (last?.position ?? 0) + POSITION_STEP,
          createdByMemberId: session.member.id,
        },
        select: { id: true },
      });
    } catch (error) {
      // The unique index on (workspaceId, name) is the whole reason two
      // identical entries cannot appear in the sidebar. Say so plainly.
      if (isUniqueViolationOn(error, "name")) {
        return fail(await message("errors.space.nameTaken"));
      }
      throw error;
    }

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "SPACE_CREATED",
      summary: `created the “${input.name}” section`,
      metadata: { space: input.name },
    });

    const space = await getSpace(created.id, session.workspace.id);
    if (!space) return fail(await message("errors.space.createdNotReadable"));

    refresh();
    return ok(space);
  });
}

/**
 * A change to one section, where an absent key means "leave it alone".
 *
 * Spelled out field by field rather than with `.partial()`, which keeps each
 * field's default — so recolouring a section would also blank its
 * description.
 */
const updateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "errors.space.needsName").max(NAME_MAX).optional(),
  colorToken: z.enum(ACCENT_TOKENS).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
});

export async function updateSpace(
  raw: z.input<typeof updateInput>,
): Promise<ActionResult<SpaceSummary>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = updateInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issue(parsed.error.issues[0]?.message, "errors.space.invalid"));
    }

    const { id, ...changes } = parsed.data;
    const before = await assertSpaceInWorkspace(id, session.workspace.id);

    const data: Record<string, unknown> = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.colorToken !== undefined) data.colorToken = changes.colorToken;
    if (changes.description !== undefined) {
      data.description = changes.description?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      const unchanged = await getSpace(id, session.workspace.id);
      return unchanged ? ok(unchanged) : fail(await message("errors.space.gone"));
    }

    try {
      await db.space.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolationOn(error, "name")) {
        return fail(await message("errors.space.nameTaken"));
      }
      throw error;
    }

    const renamed = changes.name !== undefined && changes.name !== before.name;
    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "SPACE_UPDATED",
      summary: renamed
        ? `renamed “${before.name}” to “${changes.name}”`
        : `updated the “${before.name}” section`,
      metadata: { space: changes.name ?? before.name },
    });

    const space = await getSpace(id, session.workspace.id);
    if (!space) return fail(await message("errors.space.gone"));

    refresh();
    return ok(space);
  });
}

/**
 * Removes a section. The tasks filed under it survive and return to
 * "No section" — see the note at the top of this file.
 */
export async function deleteSpace(id: string): Promise<ActionResult<{ freedTasks: number }>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const before = await assertSpaceInWorkspace(id, session.workspace.id);

    const freedTasks = await db.task.count({
      where: { workspaceId: session.workspace.id, spaceId: id },
    });

    await db.space.delete({ where: { id } });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "SPACE_DELETED",
      summary: `deleted the “${before.name}” section`,
      metadata: { space: before.name },
    });

    refresh();
    return ok({ freedTasks });
  });
}

/**
 * Persists a hand-arranged sidebar order.
 *
 * Ids that do not belong to this workspace are dropped rather than rejected:
 * a reorder is a gesture, and failing the whole thing over one stale id would
 * lose the arrangement someone just made.
 */
export async function reorderSpaces(
  orderedIds: string[],
): Promise<ActionResult<SpaceSummary[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = z.array(z.string().min(1)).max(200).safeParse(orderedIds);
    if (!parsed.success) return fail(await message("errors.space.orderInvalid"));

    const owned = await db.space.findMany({
      where: { id: { in: parsed.data }, workspaceId: session.workspace.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));

    await db.$transaction(
      parsed.data
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          db.space.update({
            where: { id },
            data: { position: (index + 1) * POSITION_STEP },
          }),
        ),
    );

    refresh();
    return ok(await listSpaces(session.workspace.id));
  });
}

/** Resolves a Zod issue's key, falling back to a generic message. */
async function issue(key: string | undefined, fallback: TranslationKey): Promise<string> {
  return message((key ?? fallback) as TranslationKey);
}
