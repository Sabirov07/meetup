import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { listMeetings } from "@/lib/data/meetings";
import { listTasks } from "@/lib/data/tasks";
import { TaskPage } from "@/components/tasks/task-page";
import { TaskStoreProvider } from "@/components/tasks/task-store";
import { BoardSkeleton } from "@/components/tasks/board-skeleton";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export const metadata: Metadata = { title: "All tasks" };

export default function AllTasksPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <AllTasksData />
    </Suspense>
  );
}

async function AllTasksData() {
  await connection();
  const now = new Date();
  const session = await requireSession();

  const [tasks, meetings] = await Promise.all([
    listTasks(session.workspace.id),
    listMeetings(session.workspace.id),
  ]);

  return (
    <TaskStoreProvider
      initialTasks={tasks}
      members={session.workspace.members}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
    >
      <TaskPage
        heading="All tasks"
        description="The whole workspace in one board, across every owner."
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </TaskStoreProvider>
  );
}
