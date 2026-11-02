import type { Metadata } from "next";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getTeam, listMyWorkspaces } from "@/backend/data/team";
import { getTranslator } from "@/backend/i18n/locale";
import { TeamView } from "@/frontend/components/team/team-view";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("team.heading") };
}

export default async function TeamPage() {
  // Establishes a request before the clock is read, as in the group layout.
  await connection();
  const now = new Date();
  const session = await requireSession();

  const [team, workspaces] = await Promise.all([
    getTeam(session, now),
    listMyWorkspaces(session.userId, session.workspace.id),
  ]);

  return (
    <TeamView
      workspace={session.workspace}
      viewer={session.member}
      team={team}
      // Leaving your only workspace would lock you out of your own account:
      // `getSessionContext` has no membership to resolve afterwards.
      canLeave={workspaces.length > 1}
      serverNow={now.toISOString()}
    />
  );
}
