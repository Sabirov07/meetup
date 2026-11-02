import type { Metadata } from "next";
import { db } from "@/backend/db";
import { resolveUserFromCookie } from "@/backend/auth/session";
import { getTranslator } from "@/backend/i18n/locale";
import { findInviteWorkspace, findUsableInvite } from "@/backend/team/invites";
import { InviteProblem, JoinInvite } from "@/frontend/components/team/join-invite";

/**
 * The invitation landing page.
 *
 * It is readable without a session — that is the point of it — so it must not
 * use `requireSession`. What it does read is the cookie, to decide between
 * "join this workspace" and "create an account first", which makes the route
 * request-time like the rest of the authenticated app.
 */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("join.title") };
}

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const [lookup, target, user] = await Promise.all([
    findUsableInvite(token),
    findInviteWorkspace(token),
    resolveUserFromCookie(),
  ]);

  // Membership is checked before the invite's state, so clicking your own
  // already-used link reads as "you are already in" rather than as an error.
  const existingMembership =
    user && target
      ? await db.workspaceMember.findFirst({
          where: { workspaceId: target.workspaceId, userId: user.id },
          select: { id: true },
        })
      : null;

  if (existingMembership && target) {
    return (
      <JoinInvite
        invite={{
          token,
          workspaceName: target.workspaceName,
          role: lookup.ok ? lookup.invite.role : "MEMBER",
          email: null,
          invitedByName: null,
          // Nothing is on offer here, so there is no deadline to report.
          expiresAt: null,
        }}
        viewer={user ? { email: user.email } : null}
        alreadyMember
      />
    );
  }

  if (!lookup.ok) return <InviteProblem reason={lookup.problem} />;
  const invite = lookup.invite;

  return (
    <JoinInvite
      invite={{
        token,
        workspaceName: invite.workspaceName,
        role: invite.role,
        email: invite.email,
        invitedByName: invite.invitedByName,
        expiresAt: invite.expiresAt.toISOString(),
      }}
      viewer={user ? { email: user.email } : null}
      alreadyMember={false}
    />
  );
}
