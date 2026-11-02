import "server-only";

import { db, isUniqueViolationOn } from "@/backend/db";
import { emailMatches, findUsableInvite } from "@/backend/team/invites";
import { ACCENT_TOKENS } from "@/shared/domain/types";

/**
 * Account creation, shared by every way in: email + password sign-up and
 * Google sign-in both land here.
 *
 * A person is useless to this product without a workspace — `getSessionContext`
 * returns null when there is no membership, which `requireSession` turns into a
 * redirect back to /login. So a new account always ends up in exactly one of
 * two places:
 *
 *  * signing up from an invite link, it joins the workspace that invited it;
 *  * otherwise it gets a workspace of its own and is its administrator.
 *
 * The first case deliberately does NOT also create a personal workspace. An
 * invited colleague who arrives to find "Alex's workspace" sitting empty next
 * to the one they were asked to join has been handed a puzzle, not a product;
 * they can always start one later from the workspace switcher.
 */

/** Stable accent per account, so the same person is always the same colour. */
function accentFor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum = (sum + seed.charCodeAt(i)) % 9973;
  return ACCENT_TOKENS[sum % ACCENT_TOKENS.length];
}

/** Falls back to the email's local part when the name gives nothing usable. */
function slugBase(name: string, email: string): string {
  const fromName = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (fromName.length >= 2) return fromName.slice(0, 40);

  const local = email.split("@")[0]?.replace(/[^a-z0-9]+/g, "-") ?? "";
  return local.length >= 2 ? local.slice(0, 40) : "workspace";
}

/**
 * Workspace slugs are unique, and two people called "Alex" will collide. Tries
 * the plain slug first, then suffixes, so the common case stays readable.
 */
async function uniqueSlug(base: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  // Six names were taken; stop guessing and make it unambiguous.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** "Alex Morgan" → "Alex's workspace" */
function workspaceNameFor(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name.trim();
  return first.endsWith("s") ? `${first}' workspace` : `${first}'s workspace`;
}

export type ProvisionInput = {
  email: string;
  name: string;
  /** Null for a Google-only account. */
  passwordHash: string | null;
  googleSub?: string | null;
  /**
   * The invite this account is being created in order to accept, if any. An
   * unusable token is ignored rather than fatal: the person still gets an
   * account, in a workspace of their own.
   */
  inviteToken?: string | null;
};

/**
 * Creates the user, their workspace, their membership and their preferences in
 * one transaction, so a failure part-way through cannot leave an account that
 * can sign in but has nowhere to land.
 */
export async function provisionAccount(input: ProvisionInput): Promise<{ userId: string }> {
  if (input.inviteToken) {
    const joined = await createAccountFromInvite(input, input.inviteToken);
    if (joined) return joined;
  }

  const base = slugBase(input.name, input.email);

  // `uniqueSlug` reads before the transaction writes, so two sign-ups a
  // millisecond apart can still pick the same slug. The unique index settles
  // it; one more attempt with a random suffix is always enough.
  for (let attempt = 0; ; attempt += 1) {
    const slug =
      attempt === 0 ? await uniqueSlug(base) : `${base}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      return await createAccount(input, slug);
    } catch (error) {
      if (attempt === 0 && isUniqueViolationOn(error, "slug")) continue;
      throw error;
    }
  }
}

/**
 * Creates an account that joins an existing workspace instead of starting one.
 *
 * Returns null when the token turns out not to be usable — expired, revoked,
 * already spent, or pinned to a different address than the one signing up — so
 * the caller falls back to the ordinary path. The invite is marked ACCEPTED
 * inside the same transaction as the membership, and only `WHERE status =
 * 'PENDING'`, so two people racing one link cannot both get in on it.
 */
async function createAccountFromInvite(
  input: ProvisionInput,
  token: string,
): Promise<{ userId: string } | null> {
  const lookup = await findUsableInvite(token);
  if (!lookup.ok) return null;

  const invite = lookup.invite;
  if (!emailMatches(invite, input.email)) return null;

  return db.$transaction(async (tx) => {
    const spent = await tx.workspaceInvite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (spent.count === 0) return null;

    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        googleSub: input.googleSub ?? null,
        accentToken: accentFor(input.email),
      },
      select: { id: true },
    });

    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedByUserId: user.id },
    });

    const member = await tx.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
        jobTitle: invite.jobTitle,
      },
      select: { id: true },
    });

    // The workspace they were invited to is the only one they have, so it is
    // both where they land and the one they belong to.
    await tx.userPreference.create({
      data: {
        userId: user.id,
        lastWorkspaceId: invite.workspaceId,
        primaryWorkspaceId: invite.workspaceId,
      },
    });

    await tx.activityEvent.create({
      data: {
        workspaceId: invite.workspaceId,
        actorMemberId: member.id,
        type: "MEMBER_JOINED",
        summary: `${input.name} joined the workspace`,
      },
    });

    return { userId: user.id };
  });
}

async function createAccount(
  input: ProvisionInput,
  slug: string,
): Promise<{ userId: string }> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        googleSub: input.googleSub ?? null,
        accentToken: accentFor(input.email),
      },
      select: { id: true },
    });

    const workspace = await tx.workspace.create({
      data: { name: workspaceNameFor(input.name), slug },
      select: { id: true },
    });

    const member = await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "ADMINISTRATOR" },
      select: { id: true },
    });

    await tx.userPreference.create({
      data: {
        userId: user.id,
        lastWorkspaceId: workspace.id,
        primaryWorkspaceId: workspace.id,
      },
    });

    await tx.activityEvent.create({
      data: {
        workspaceId: workspace.id,
        actorMemberId: member.id,
        type: "MEMBER_JOINED",
        summary: `${input.name} created this workspace`,
      },
    });

    return { userId: user.id };
  });
}

export type GoogleSignInOutcome = {
  userId: string;
  /** True when this sign-in created the account rather than reusing one. */
  created: boolean;
};

/**
 * Finds or creates the account behind a Google sign-in.
 *
 * Matching order matters:
 *
 *  1. `googleSub` — the only identifier Google guarantees is stable. Someone
 *     who changes their Google email still lands on their own account.
 *  2. the email address — this is what links Google to an account that was
 *     created with a password. It is only safe because the caller has already
 *     established that Google considers the address verified; without that
 *     check, anyone could claim an account by signing up for a Google address.
 *  3. otherwise, a new account.
 */
export async function resolveGoogleSignIn(
  identity: { subject: string; email: string; name: string },
  inviteToken?: string | null,
): Promise<GoogleSignInOutcome> {
  const bySub = await db.user.findUnique({
    where: { googleSub: identity.subject },
    select: { id: true },
  });
  if (bySub) return { userId: bySub.id, created: false };

  const byEmail = await db.user.findUnique({
    where: { email: identity.email },
    select: { id: true, googleSub: true },
  });
  if (byEmail) {
    if (!byEmail.googleSub) {
      await db.user.update({
        where: { id: byEmail.id },
        data: { googleSub: identity.subject },
      });
    }
    // A different `sub` already linked to this email means two Google accounts
    // share one address, which Google does not allow. Leave the existing link
    // alone rather than letting the newcomer take it over.
    return { userId: byEmail.id, created: false };
  }

  const { userId } = await provisionAccount({
    email: identity.email,
    name: identity.name,
    passwordHash: null,
    googleSub: identity.subject,
    inviteToken,
  });
  return { userId, created: true };
}
