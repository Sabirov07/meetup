"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { listStatuses } from "@/backend/data/statuses";
import { message } from "@/backend/i18n/message";
import {
  CUSTOM_STATUS_PREFIX,
  MAX_CUSTOM_STATUSES,
  STATUS_LABEL_MAX,
  STATUS_POSITION_STEP,
  STATUS_TONES,
} from "@/shared/domain/statuses";
import type { TaskStatusDef } from "@/shared/domain/types";
import { fail, guarded, logActivity, ok, type ActionResult } from "./shared";

/**
 * Writes for a workspace's task statuses.
 *
 * Any member may shape the flow: statuses are shared vocabulary, like
 * sections. What every call checks is that the row belongs to the caller's
 * workspace, since the id arrives from the browser.
 *
 * Every action answers with the whole list in its new order, so the client
 * replaces its copy rather than patching it — there is only ever a handful.
 */

const labelField = z.string().trim().min(1, "errors.status.needsName").max(STATUS_LABEL_MAX);
const toneField = z.enum(STATUS_TONES);

async function assertStatusInWorkspace(id: string, workspaceId: string) {
  const row = await db.taskStatusDefinition.findFirst({
    where: { id, workspaceId },
    select: { id: true, key: true, label: true, builtin: true },
  });
  if (!row) throw new Error(await message("errors.status.gone"));
  return row;
}

function randomKey(): string {
  // Short, URL-safe and unguessable enough; uniqueness is enforced by the
  // index, and a clash would simply fail the create.
  return CUSTOM_STATUS_PREFIX + Math.random().toString(36).slice(2, 10);
}

const createInput = z.object({ label: labelField, tone: toneField.optional() });

export async function createStatus(
  raw: z.input<typeof createInput>,
): Promise<ActionResult<TaskStatusDef[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = createInput.safeParse(raw);
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message;
      return fail(await message(key === "errors.status.needsName" ? key : "errors.status.invalid"));
    }
    const workspaceId = session.workspace.id;

    const existing = await listStatuses(workspaceId);
    if (existing.filter((s) => !s.builtin).length >= MAX_CUSTOM_STATUSES) {
      return fail(await message("errors.status.tooMany", { max: MAX_CUSTOM_STATUSES }));
    }

    // A new stage lands before "Completed" when that is last, which is where
    // nearly every added step belongs; otherwise at the end.
    const completedAt = existing.findIndex((s) => s.key === "COMPLETED");
    const isLast = completedAt === existing.length - 1 && completedAt > 0;
    const position = isLast
      ? existing[completedAt].position
      : (existing[existing.length - 1]?.position ?? 0) + STATUS_POSITION_STEP;

    await db.$transaction(async (tx) => {
      if (isLast) {
        await tx.taskStatusDefinition.update({
          where: { id: existing[completedAt].id },
          data: { position: position + STATUS_POSITION_STEP },
        });
      }
      await tx.taskStatusDefinition.create({
        data: {
          workspaceId,
          key: randomKey(),
          label: parsed.data.label,
          tone: parsed.data.tone ?? "info",
          position,
        },
      });
    });

    await logActivity({
      workspaceId,
      actorMemberId: session.member.id,
      type: "TASK_STATUS_CHANGED",
      summary: `added the “${parsed.data.label}” status`,
      metadata: { status: parsed.data.label },
    });

    refresh();
    return ok(await listStatuses(workspaceId));
  });
}

const updateInput = z.object({
  id: z.string().min(1),
  label: labelField.optional(),
  tone: toneField.optional(),
});

export async function updateStatus(
  raw: z.input<typeof updateInput>,
): Promise<ActionResult<TaskStatusDef[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = updateInput.safeParse(raw);
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message;
      return fail(await message(key === "errors.status.needsName" ? key : "errors.status.invalid"));
    }
    const row = await assertStatusInWorkspace(parsed.data.id, session.workspace.id);

    await db.taskStatusDefinition.update({
      where: { id: row.id },
      data: {
        // A built-in keeps its translated name; only its colour can change.
        ...(parsed.data.label !== undefined && !row.builtin ? { label: parsed.data.label } : {}),
        ...(parsed.data.tone !== undefined ? { tone: parsed.data.tone } : {}),
      },
    });

    refresh();
    return ok(await listStatuses(session.workspace.id));
  });
}

/**
 * Removes a custom status. The tasks that were in it go back to "To do":
 * a column someone tidied away must never take the work with it.
 */
export async function deleteStatus(id: string): Promise<ActionResult<TaskStatusDef[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const row = await assertStatusInWorkspace(id, session.workspace.id);
    if (row.builtin) return fail(await message("errors.status.builtin"));

    const moved = await db.$transaction(async (tx) => {
      const result = await tx.task.updateMany({
        where: { workspaceId: session.workspace.id, status: row.key },
        data: { status: "TODO", completedAt: null },
      });
      await tx.taskStatusDefinition.delete({ where: { id: row.id } });
      return result.count;
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_STATUS_CHANGED",
      summary: `removed the “${row.label}” status`,
      metadata: { status: row.label, movedTasks: moved },
    });

    refresh();
    return ok(await listStatuses(session.workspace.id));
  });
}

/** Persists a drag-arranged order. Ids not in the workspace are ignored. */
export async function reorderStatuses(orderedIds: string[]): Promise<ActionResult<TaskStatusDef[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = z.array(z.string().min(1)).max(100).safeParse(orderedIds);
    if (!parsed.success) return fail(await message("errors.status.invalid"));

    const owned = await db.taskStatusDefinition.findMany({
      where: { id: { in: parsed.data }, workspaceId: session.workspace.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));

    await db.$transaction(
      parsed.data
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          db.taskStatusDefinition.update({
            where: { id },
            data: { position: (index + 1) * STATUS_POSITION_STEP },
          }),
        ),
    );

    refresh();
    return ok(await listStatuses(session.workspace.id));
  });
}
