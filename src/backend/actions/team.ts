"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestOrigin } from "@/backend/app-url";
import { db, isUniqueViolationOn } from "@/backend/db";
import {
  requireAdministrator,
  requireSessionForAction,
} from "@/backend/auth/guards";
import { destroyCurrentSession } from "@/backend/auth/session";
import { message } from "@/backend/i18n/message";
import {
  INVITE_DAYS,
  acceptInvite,
  createInviteToken,
  forgetWorkspace,
  inviteLink,
  rememberInvite,
  setLastWorkspace,
  setPrimaryWorkspace,
} from "@/backend/team/invites";
import { WORKSPACE_ROLES } from "@/shared/domain/types";
import { fail, guarded, logActivity, ok, type ActionResult } from "./shared";

/**
 * Team management: who is in a workspace, how they got there, and how they
 * leave.
 *
 * Two invariants are enforced on every path through this file, because losing
 * either one strands people out of their own data:
 *
 *  1. A workspace always keeps at least one administrator. Nobody can demote,
 *     remove or walk out on the last one.
 *  2. A person always keeps at least one workspace. `getSessionContext`
 *     returns null without a membership, which `requireSession` turns into a
 *     redirect to /login — so letting someone leave their only workspace would
 *     lock them out of an account that is otherwise perfectly valid.
 */

const inviteInput = z.object({
  /**
   * Optional. An address pins the invite to one person; without it the link
   * works for whoever opens it, which is what makes it pasteable into a chat.
   */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("errors.team.inviteEmailInvalid")
    .nullable()
    .optional(),
  role: z.enum(WORKSPACE_ROLES),
  jobTitle: z.string().trim().max(60).nullable().optional(),
});

export async function createInvite(
  raw: z.input<typeof inviteInput>,
): Promise<ActionResult<{ link: string }>> {
  return guarded(async () => {
    const session = await requireAdministrator();
    const parsed = inviteInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await message("errors.team.inviteEmailInvalid"));
    }
    const input = parsed.data;
    const email = input.email || null;

    if (email) {
      // Inviting someone who is already here is a mistake worth naming rather
      // than a link that will fail on arrival.
      const already = await db.workspaceMember.findFirst({
        where: { workspaceId: session.workspace.id, user: { email } },
        select: { id: true },
      });
      if (already) return fail(await message("errors.team.alreadyMember"));

      // One live invite per address. A second one would leave two working
      // links where only the first can ever be used.
      await db.workspaceInvite.updateMany({
        where: { workspaceId: session.workspace.id, email, status: "PENDING" },
        data: { status: "REVOKED" },
      });
    }

    const token = createInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

    try {
      await db.workspaceInvite.create({
        data: {
          workspaceId: session.workspace.id,
          token,
          email,
          role: input.role,
          jobTitle: input.jobTitle?.trim() || null,
          invitedByMemberId: session.member.id,
          expiresAt,
        },
      });
    } catch (error) {
      // 24 random bytes colliding is not a thing that happens, but a unique
      // violation here must not read as a mysterious generic failure.
      if (isUniqueViolationOn(error, "token")) {
        return fail(await message("errors.generic"));
      }
      throw error;
    }

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEMBER_INVITED",
      summary: email ? `invited ${email}` : "created an invite link",
      metadata: { person: email ?? null },
    });

    refresh();
    return ok({ link: inviteLink(token, await requestOrigin()) });
  });
}

export async function revokeInvite(inviteId: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireAdministrator();

    const revoked = await db.workspaceInvite.updateMany({
      where: { id: inviteId, workspaceId: session.workspace.id, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    if (revoked.count === 0) return fail(await message("errors.team.inviteGone"));

    refresh();
    return ok(undefined);
  });
}

/**
 * Accepts an invite for the person who is already signed in.
 *
 * Returns the workspace rather than redirecting, so the /join page can show a
 * result and move the browser itself — a redirect out of an action would race
 * the router refresh the new membership needs.
 */
export async function acceptInviteForMe(
  token: string,
): Promise<ActionResult<{ workspaceId: string }>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    if (!user) return fail(await message("errors.sessionExpired"));

    const outcome = await acceptInvite({
      token,
      userId: session.userId,
      userEmail: user.email,
    });

    if (!outcome.ok) {
      return fail(await message(`errors.invite.${outcome.problem}`));
    }

    refresh();
    return ok({ workspaceId: outcome.workspaceId });
  });
}

const removeInput = z.object({
  memberId: z.string().min(1),
  /** Where their open work goes. Null leaves it unassigned. */
  reassignToMemberId: z.string().min(1).nullable().optional(),
});

/**
 * Removes someone from the workspace.
 *
 * Their tasks are not deleted — `Task.ownerMemberId` is `SetNull`, so work
 * survives the person who was doing it and lands in the unassigned pile.
 * Passing `reassignToMemberId` hands it to a named colleague instead, which is
 * almost always what an administrator actually wants.
 */
export async function removeMember(
  raw: z.input<typeof removeInput>,
): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireAdministrator();
    const parsed = removeInput.safeParse(raw);
    if (!parsed.success) return fail(await message("errors.generic"));
    const input = parsed.data;

    if (input.memberId === session.member.id) {
      return fail(await message("errors.team.cannotRemoveSelf"));
    }

    const member = await db.workspaceMember.findFirst({
      where: { id: input.memberId, workspaceId: session.workspace.id },
      select: { id: true, role: true, userId: true, user: { select: { name: true } } },
    });
    if (!member) return fail(await message("errors.member.notInWorkspace"));

    if (member.role === "ADMINISTRATOR") {
      const admins = await db.workspaceMember.count({
        where: { workspaceId: session.workspace.id, role: "ADMINISTRATOR" },
      });
      if (admins <= 1) return fail(await message("errors.workspace.needsAdmin"));
    }

    if (input.reassignToMemberId) {
      const heir = await db.workspaceMember.findFirst({
        where: { id: input.reassignToMemberId, workspaceId: session.workspace.id },
        select: { id: true },
      });
      if (!heir) return fail(await message("errors.member.notInWorkspace"));

      await db.task.updateMany({
        where: {
          workspaceId: session.workspace.id,
          ownerMemberId: member.id,
          status: { not: "COMPLETED" },
        },
        data: { ownerMemberId: heir.id },
      });
    }

    // The activity entry has to outlive the membership it refers to, and
    // `actorMemberId` is SetNull on delete — so it is written first, by the
    // administrator doing the removing, and names the person in its summary.
    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEMBER_REMOVED",
      summary: `removed ${member.user.name} from the workspace`,
      metadata: { person: member.user.name },
    });

    await db.workspaceMember.delete({ where: { id: member.id } });

    // Their next page load must not land back here. Clearing the pointers
    // sends `getSessionContext` to whichever workspace they do still belong to.
    await forgetWorkspace(member.userId, session.workspace.id);

    refresh();
    return ok(undefined);
  });
}

/** Leaves the active workspace, then lands on whichever one is left. */
export async function leaveWorkspace(): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();

    const [memberships, admins, others] = await Promise.all([
      db.workspaceMember.count({ where: { userId: session.userId } }),
      db.workspaceMember.count({
        where: { workspaceId: session.workspace.id, role: "ADMINISTRATOR" },
      }),
      db.workspaceMember.count({
        where: { workspaceId: session.workspace.id, id: { not: session.member.id } },
      }),
    ]);

    if (memberships <= 1) return fail(await message("errors.team.lastWorkspace"));
    if (session.member.role === "ADMINISTRATOR" && admins <= 1 && others > 0) {
      return fail(await message("errors.team.lastAdminLeaving"));
    }

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEMBER_LEFT",
      summary: `${session.member.name} left the workspace`,
    });

    await db.workspaceMember.delete({ where: { id: session.member.id } });
    await forgetWorkspace(session.userId, session.workspace.id);

    refresh();
    return ok(undefined);
  });
}

/** Switches which workspace the app is showing. */
export async function switchWorkspace(workspaceId: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();

    // Membership is the authorisation check: an id from the browser is only
    // ever as good as a row saying this person belongs to it.
    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.userId, workspaceId },
      select: { id: true },
    });
    if (!membership) return fail(await message("errors.team.notAMember"));

    await setLastWorkspace(session.userId, workspaceId);
    refresh();
    return ok(undefined);
  });
}

/**
 * Names a workspace as this person's main one.
 *
 * Switching is about right now; this is about where they belong. The two are
 * only the same until an account has a real team and a personal workspace it
 * never opens — at which point the main one is the answer to "where should I
 * be" and the last one open is not.
 */
export async function setMainWorkspace(workspaceId: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();

    // Same rule as switching: an id from the browser is only as good as a row
    // saying this person belongs to it.
    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.userId, workspaceId },
      select: { id: true },
    });
    if (!membership) return fail(await message("errors.team.notAMember"));

    await setPrimaryWorkspace(session.userId, workspaceId);
    refresh();
    return ok(undefined);
  });
}

const createWorkspaceInput = z.string().trim().min(2).max(80);

/**
 * Starts a second workspace — a different company, client or side project.
 *
 * The creator is its administrator, and it becomes the active one, because
 * nobody creates a workspace in order to carry on looking at another. It does
 * not become their main one: a side project should not quietly displace the
 * company they work at. `setMainWorkspace` is how that moves.
 */
export async function createWorkspace(name: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = createWorkspaceInput.safeParse(name);
    if (!parsed.success) return fail(await message("errors.workspace.nameTooShort"));

    const person = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });

    await db.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: parsed.data, slug: await uniqueSlug(parsed.data) },
        select: { id: true },
      });

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: session.userId,
          role: "ADMINISTRATOR",
        },
        select: { id: true },
      });

      await tx.activityEvent.create({
        data: {
          workspaceId: workspace.id,
          actorMemberId: member.id,
          type: "MEMBER_JOINED",
          summary: `${person?.name ?? "Someone"} created this workspace`,
        },
      });

      await tx.userPreference.upsert({
        where: { userId: session.userId },
        create: { userId: session.userId, lastWorkspaceId: workspace.id },
        update: { lastWorkspaceId: workspace.id },
      });
    });

    refresh();
    return ok(undefined);
  });
}

/** Changes a member's role. Lives here rather than beside the profile edits. */
export async function changeMemberRole(input: {
  memberId: string;
  role: "ADMINISTRATOR" | "MEMBER";
}): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireAdministrator();

    const member = await db.workspaceMember.findFirst({
      where: { id: input.memberId, workspaceId: session.workspace.id },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    if (!member) return fail(await message("errors.member.notInWorkspace"));
    if (member.role === input.role) return ok(undefined);

    if (input.role === "MEMBER") {
      const admins = await db.workspaceMember.count({
        where: { workspaceId: session.workspace.id, role: "ADMINISTRATOR" },
      });
      if (admins <= 1) return fail(await message("errors.workspace.needsAdmin"));
    }

    await db.workspaceMember.update({
      where: { id: member.id },
      data: { role: input.role },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEMBER_ROLE_CHANGED",
      summary:
        input.role === "ADMINISTRATOR"
          ? `made ${member.user.name} an administrator`
          : `changed ${member.user.name} to a member`,
      metadata: { person: member.user.name, role: input.role },
    });

    refresh();
    return ok(undefined);
  });
}

/**
 * Remembers an invite, then sends the visitor off to sign in or sign up.
 *
 * A page cannot write a cookie, so the two buttons on /join are plain forms
 * that post here. That also means the flow works with no JavaScript, which is
 * the right bar for the one screen a new colleague sees first.
 */
export async function beginJoin(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const destination = String(formData.get("to") ?? "") === "login" ? "/login" : "/signup";

  if (token) await rememberInvite(token);
  redirect(destination);
}

/** Sign-out that lands on the invite the person was trying to accept. */
export async function signOutToJoin(token: string): Promise<void> {
  await destroyCurrentSession();
  redirect(`/join/${encodeURIComponent(token)}`);
}

/** Slug generation, mirroring the one used for a first workspace at sign-up. */
async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace";

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
