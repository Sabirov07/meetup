"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireAdministrator,
  requireSessionForAction,
} from "@/lib/auth/guards";
import { disconnectGoogle } from "@/lib/google/oauth";
import { ACCENT_TOKENS } from "@/lib/domain/types";
import { fail, guarded, ok, type ActionResult } from "./shared";

export async function renameWorkspace(name: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireAdministrator();
    const parsed = z.string().trim().min(2).max(80).safeParse(name);
    if (!parsed.success) return fail("Give the workspace a name of at least 2 characters.");

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
  name: z.string().trim().min(2, "Names need at least 2 characters.").max(80),
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
      return fail(parsed.error.issues[0]?.message ?? "That profile is not valid.");
    }
    const input = parsed.data;

    const member = await db.workspaceMember.findFirst({
      where: { id: input.memberId, workspaceId: session.workspace.id },
      select: { id: true, userId: true },
    });
    if (!member) return fail("That person is not a member of this workspace.");

    const isSelf = member.id === session.member.id;
    if (!isSelf && session.member.role !== "ADMINISTRATOR") {
      return fail("Only an administrator can edit someone else's profile.");
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

export async function setMemberRole(input: {
  memberId: string;
  role: "ADMINISTRATOR" | "MEMBER";
}): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireAdministrator();

    const member = await db.workspaceMember.findFirst({
      where: { id: input.memberId, workspaceId: session.workspace.id },
      select: { id: true },
    });
    if (!member) return fail("That person is not a member of this workspace.");

    // Never let the last administrator demote themselves out of the workspace.
    if (input.role === "MEMBER") {
      const admins = await db.workspaceMember.count({
        where: { workspaceId: session.workspace.id, role: "ADMINISTRATOR" },
      });
      if (admins <= 1 && member.id === session.member.id) {
        return fail("The workspace needs at least one administrator.");
      }
    }

    await db.workspaceMember.update({
      where: { id: member.id },
      data: { role: input.role },
    });
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
