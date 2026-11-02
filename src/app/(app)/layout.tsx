import { connection } from "next/server";
import { db } from "@/backend/db";
import { requireSession } from "@/backend/auth/guards";
import { getShellData } from "@/backend/data/overview";
import { googleIntegrationStatus } from "@/backend/google/config";
import { getConnectedAccount } from "@/backend/google/oauth";
import { AppShell } from "@/frontend/components/shell/app-shell";

/**
 * `cacheComponents` is enabled, and every route in this group is gated on the
 * session cookie — there is no useful static shell to prerender ahead of
 * knowing who is signed in. `instant = false` tells Next.js this segment is
 * allowed to block, which is the honest description of an authenticated app.
 */
export const instant = false;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Establishes a request before the clock is read. Without this, the
  // `new Date()` below is synchronous IO during prerender and fails the build.
  await connection();
  const now = new Date();

  const session = await requireSession();
  const [shell, preference, googleAccount] = await Promise.all([
    getShellData(session, now),
    db.userPreference.findUnique({
      where: { userId: session.userId },
      select: { sidebarCollapsed: true },
    }),
    getConnectedAccount(session.userId),
  ]);

  const googleStatus = googleIntegrationStatus();

  return (
    <AppShell
      workspace={session.workspace}
      member={session.member}
      counterpart={shell.counterpart}
      counts={shell.counts}
      alerts={shell.alerts}
      google={{
        configured: googleStatus.configured,
        connected: Boolean(googleAccount),
        email: googleAccount?.googleEmail ?? null,
      }}
      initialCollapsed={preference?.sidebarCollapsed ?? false}
    >
      {children}
    </AppShell>
  );
}
