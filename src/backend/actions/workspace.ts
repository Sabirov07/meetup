"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import {
  requireAdministrator,
  requireSessionForAction,
} from "@/backend/auth/guards";
import { disconnectGoogle } from "@/backend/google/oauth";
import { ACCENT_TOKENS } from "@/shared/domain/types";
import { message } from "@/backend/i18n/message";
import type { TranslationKey } from "@/shared/i18n";
import { fail, guarded, ok, type ActionResult } from "./shared";

export async function renameWorkspace(name: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireAdministrator();
    const parsed = z.string().trim().min(2).max(80).safeParse(name);
    if (!parsed.success) return fail(await message("errors.workspace.nameTooShort"));

    await db.workspace.update({
      where: { id: session.workspace.id },
      data: { name: parsed.data },
    });
    refresh();
    return ok(undefined);
  });
}

const profileInput = z.object({
  memberId: z.string().min(1),
  name: z.string().trim().min(2, "errors.workspace.personNameTooShort").max(80),
  jobTitle: z.string().trim().max(60).nullable(),
  accentToken: z.enum(ACCENT_TOKENS),
});

/**
 * Renames a person in the workspace.
 *
 * Anyone can edit themselves; only an administrator can edit someone else.
 * This is how the seeded placeholder names get replaced with real ones.
 */
export async function updateMemberProfile(
  raw: z.input<typeof profileInput>,
): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = profileInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issue(parsed.error.issues[0]?.message, "errors.workspace.profileInvalid"));
    }
    const input = parsed.data;

    const member = await db.workspaceMember.findFirst({
      where: { id: input.memberId, workspaceId: session.workspace.id },
      select: { id: true, userId: true },
    });
    if (!member) return fail(await message("errors.member.notInWorkspace"));

    const isSelf = member.id === session.member.id;
    if (!isSelf && session.member.role !== "ADMINISTRATOR") {
      return fail(await message("errors.workspace.notYourProfile"));
    }

    await db.$transaction([
      db.user.update({
        where: { id: member.userId },
        data: { name: input.name, accentToken: input.accentToken },
      }),
      db.workspaceMember.update({
        where: { id: member.id },
        data: { jobTitle: input.jobTitle || null },
      }),
    ]);

    refresh();
    return ok(undefined);
  });
}

export async function disconnectGoogleAccount(): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await disconnectGoogle(session.userId);
    refresh();
    return ok(undefined);
  });
}

/** Resolves a Zod issue's key, falling back to a generic message. */
async function issue(key: string | undefined, fallback: TranslationKey): Promise<string> {
  return message((key ?? fallback) as TranslationKey);
}
