import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getTranslator } from "@/backend/i18n/locale";
import { listActivity } from "@/backend/data/meetings";
import { listTasks } from "@/backend/data/tasks";
import { ActivityView } from "@/frontend/components/activity/activity-view";
import { Skeleton } from "@/frontend/components/ui/feedback";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.activity") };
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <ActivityData />
    </Suspense>
  );
}

async function ActivityData() {
  await connection();
  const session = await requireSession();

  const [events, tasks] = await Promise.all([
    listActivity(session.workspace.id, 120),
    listTasks(session.workspace.id),
  ]);

  return <ActivityView events={events} tasks={tasks} members={session.workspace.members} />;
}

function ActivitySkeleton() {
  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
