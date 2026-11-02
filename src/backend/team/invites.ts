import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/backend/db";
import { appUrlFor } from "@/backend/app-url";
import type { InviteStatus, WorkspaceRole } from "@/shared/domain/types";

/**
 * Invitations: the one way a second person gets into a workspace.
 *
 * The link is the whole mechanism. No mail is sent, because nothing else in
 * this product sends mail yet and a flow that silently depends on SMTP being
 * configured is worse than one that hands you a link to paste into whatever
 * you already talk on. An address can still be attached to an invite, in which
 * case it stops being a link anyone may use and becomes one only that person
 * can accept.
 */

/** Seven days: long enough to survive a weekend, short enough to go stale. */
export const INVITE_DAYS = 7;

/**
 * Carries a pending invite across sign-in and sign-up.
 *
 * Someone who opens an invite link without an account has to leave the page
 * (to /signup, or out to Google and back) before they can accept anything. The
 * token has to survive that round trip, and it cannot ride in the query string
 * of a Google redirect — the redirect URI is fixed at the provider. A
 * short-lived httpOnly cookie is what every path back into the app can read.
 */
export const INVITE_COOKIE = "meetup_invite";

const INVITE_COOKIE_MINUTES = 60;

export function createInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The absolute link an administrator copies out of the Team page. */
export function inviteLink(token: string, fallbackOrigin?: string): string {
  return appUrlFor(`/join/${token}`, fallbackOrigin).toString();
}

export async function rememberInvite(token: string): Promise<void> {
  const store = await cookies();
  store.set(INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_COOKIE_MINUTES * 60,
  });
}

export async function readRememberedInvite(): Promise<string | null> {
  const store = await cookies();
  return store.get(INVITE_COOKIE)?.value ?? null;
}

export async function forgetInvite(): Promise<void> {
  (await cookies()).delete(INVITE_COOKIE);
}

/** Why a link did not work, for a page that has to explain itself. */
export type InviteProblem = "unknown" | "revoked" | "accepted" | "expired" | "wrongEmail";

export type UsableInvite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  jobTitle: string | null;
  /** Lower-cased, or null when the link is open to anyone who has it. */
  email: string | null;
  invitedByName: string | null;
  expiresAt: Date;
};

type InviteLookup =
  | { ok: true; invite: UsableInvite }
  | { ok: false; problem: InviteProblem };

/**
 * Resolves a raw token to an invite that may still be accepted.
 *
 * Expiry is decided here rather than by a scheduled job, so a link stops
 * working the moment it is out of date even though the row still says PENDING.
 */
export async function findUsableInvite(token: string): Promise<InviteLookup> {
  const row = await db.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      workspaceId: true,
      role: true,
      jobTitle: true,
      email: true,
      status: true,
      expiresAt: true,
      workspace: { select: { name: true } },
      invitedBy: { select: { user: { select: { name: true } } } },
    },
  });

  if (!row) return { ok: false, problem: "unknown" };
  if (row.status === "REVOKED") return { ok: false, problem: "revoked" };
  if (row.status === "ACCEPTED") return { ok: false, problem: "accepted" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, problem: "expired" };

  return {
    ok: true,
    invite: {
      id: row.id,
      workspaceId: row.workspaceId,
      workspaceName: row.workspace.name,
      role: row.role as WorkspaceRole,
      jobTitle: row.jobTitle,
      email: row.email,
      invitedByName: row.invitedBy?.user.name ?? null,
      expiresAt: row.expiresAt,
    },
  };
}

/**
 * The workspace a token points at, whatever state the invite is in.
 *
 * The /join page needs this before it knows whether the link is usable: a
 * member who clicks their own spent link should be told they are already in,
 * not that the invitation has been used up by a stranger.
 */
export async function findInviteWorkspace(
  token: string,
): Promise<{ workspaceId: string; workspaceName: string } | null> {
  const row = await db.workspaceInvite.findUnique({
    where: { token },
    select: { workspaceId: true, workspace: { select: { name: true } } },
  });
  return row ? { workspaceId: row.workspaceId, workspaceName: row.workspace.name } : null;
}

/** An invite pinned to an address may only be accepted by that address. */
export function emailMatches(invite: UsableInvite, email: string): boolean {
  return !invite.email || invite.email === email.trim().toLowerCase();
}

export type AcceptOutcome =
  | { ok: true; workspaceId: string; alreadyMember: boolean }
  | { ok: false; problem: InviteProblem };

/**
 * Turns an invite into a membership.
 *
 * Everything lands in one transaction: the membership, the invite's new state
 * and the `lastWorkspaceId` that decides where the next page load goes. A
 * half-applied accept would leave a live link that had already been counted,
 * or a member who is sent back to the wrong workspace on every visit.
 *
 * Marking the invite ACCEPTED is conditional on it still being PENDING, so two
 * browsers racing the same link produce one membership and one loser, rather
 * than two members from a single-use token.
 */
export async function acceptInvite(args: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<AcceptOutcome> {
  const lookup = await findUsableInvite(args.token);
  if (!lookup.ok) return lookup;

  const invite = lookup.invite;
  if (!emailMatches(invite, args.userEmail)) return { ok: false, problem: "wrongEmail" };

  const existing = await db.workspaceMember.findFirst({
    where: { workspaceId: invite.workspaceId, userId: args.userId },
    select: { id: true },
  });

  if (existing) {
    // Already in. The link is spent either way — leaving it live would let the
    // same person "join" repeatedly, and they have nothing more to gain by it.
    await db.workspaceInvite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: args.userId },
    });
    await setLastWorkspace(args.userId, invite.workspaceId);
    return { ok: true, workspaceId: invite.workspaceId, alreadyMember: true };
  }

  const user = await db.user.findUnique({
    where: { id: args.userId },
    select: { name: true },
  });

  const claimed = await db.$transaction(async (tx) => {
    const spent = await tx.workspaceInvite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: args.userId },
    });
    // Someone else got there first in the microseconds since the lookup.
    if (spent.count === 0) return false;

    const member = await tx.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: args.userId,
        role: invite.role,
        jobTitle: invite.jobTitle,
      },
      select: { id: true },
    });

    await tx.activityEvent.create({
      data: {
        workspaceId: invite.workspaceId,
        actorMemberId: member.id,
        type: "MEMBER_JOINED",
        summary: `${user?.name ?? "Someone"} joined the workspace`,
      },
    });

    await tx.userPreference.upsert({
      where: { userId: args.userId },
      create: { userId: args.userId, lastWorkspaceId: invite.workspaceId },
      update: { lastWorkspaceId: invite.workspaceId },
    });

    return true;
  });

  if (!claimed) return { ok: false, problem: "accepted" };
  return { ok: true, workspaceId: invite.workspaceId, alreadyMember: false };
}

/** Where the next page load lands. Safe to call for a workspace already set. */
export async function setLastWorkspace(userId: string, workspaceId: string): Promise<void> {
  await db.userPreference.upsert({
    where: { userId },
    create: { userId, lastWorkspaceId: workspaceId },
    update: { lastWorkspaceId: workspaceId },
  });
}

/**
 * Marks a workspace as this person's main one, and opens it.
 *
 * Both pointers move together because naming your main workspace while being
 * left looking at a different one would be a strange thing to do to someone.
 */
export async function setPrimaryWorkspace(userId: string, workspaceId: string): Promise<void> {
  await db.userPreference.upsert({
    where: { userId },
    create: { userId, lastWorkspaceId: workspaceId, primaryWorkspaceId: workspaceId },
    update: { lastWorkspaceId: workspaceId, primaryWorkspaceId: workspaceId },
  });
}

/**
 * Drops every reference to a workspace someone no longer belongs to.
 *
 * Called when a membership ends, from either side. Missing one of the two
 * pointers would send them straight back to a workspace they have just been
 * removed from — `getSessionContext` only reads the id, and the membership
 * check that would catch it is the very row that has gone.
 */
export async function forgetWorkspace(userId: string, workspaceId: string): Promise<void> {
  await db.$transaction([
    db.userPreference.updateMany({
      where: { userId, lastWorkspaceId: workspaceId },
      data: { lastWorkspaceId: null },
    }),
    db.userPreference.updateMany({
      where: { userId, primaryWorkspaceId: workspaceId },
      data: { primaryWorkspaceId: null },
    }),
  ]);
}

/**
 * Accepts whatever invite is sitting in the cookie, if any, and clears it.
 *
 * Called on every way in — password sign-in, password sign-up and Google — so
 * that "open the link, then sign in" works the same as "sign in, then open the
 * link". A failure is deliberately silent: the person is already authenticated
 * by this point, and dropping them on an error page because a stale cookie
 * pointed at a revoked invite would be worse than landing them in their own
 * workspace.
 */
export async function consumeRememberedInvite(user: {
  id: string;
  email: string;
}): Promise<{ workspaceId: string } | null> {
  const token = await readRememberedInvite();
  if (!token) return null;

  await forgetInvite();
  const outcome = await acceptInvite({ token, userId: user.id, userEmail: user.email });
  return outcome.ok ? { workspaceId: outcome.workspaceId } : null;
}

export type { InviteStatus };
