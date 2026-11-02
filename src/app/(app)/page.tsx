import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { listActivity, countPendingProposals, listMeetings } from "@/backend/data/meetings";
import { listDismissedRecommendationIds, listTasks } from "@/backend/data/tasks";
import { googleIntegrationStatus } from "@/backend/google/config";
import { getConnectedAccount } from "@/backend/google/oauth";
import { Overview } from "@/frontend/components/dashboard/overview";
import { TaskStoreProvider } from "@/frontend/components/tasks/task-store";
import { PanelSkeleton, Skeleton } from "@/frontend/components/ui/feedback";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewData />
    </Suspense>
  );
}

async function OverviewData() {
  // Request-time by design; the skeleton above covers the wait.
  await connection();
  const now = new Date();

  const session = await requireSession();
  const [tasks, meetings, activity, dismissed, pendingProposals, googleAccount] =
    await Promise.all([
      listTasks(session.workspace.id),
      listMeetings(session.workspace.id),
      listActivity(session.workspace.id, 12),
      listDismissedRecommendationIds(session.workspace.id),
      countPendingProposals(session.workspace.id),
      getConnectedAccount(session.userId),
    ]);

  const counterpart =
    session.workspace.members.find((m) => m.id !== session.member.id) ?? null;
  const googleStatus = googleIntegrationStatus();

  return (
    <TaskStoreProvider
      initialTasks={tasks}
      members={session.workspace.members}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
    >
      <Overview
        member={session.member}
        counterpart={counterpart}
        meetings={meetings}
        activity={activity}
        dismissedRecommendationIds={[...dismissed]}
        pendingProposals={pendingProposals}
        google={{
          configured: googleStatus.configured,
          connected: Boolean(googleAccount),
          email: googleAccount?.googleEmail ?? null,
        }}
      />
    </TaskStoreProvider>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:flex">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex-1 space-y-2 border-b border-r border-line px-3 py-2.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t border-line px-3 py-2">
          <Skeleton className="h-2.5 w-36" />
          <Skeleton className="h-1 w-full" />
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSkeleton rows={5} />
          <PanelSkeleton rows={4} />
        </div>
        <div className="space-y-4">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={2} />
        </div>
      </div>
    </div>
  );
}
