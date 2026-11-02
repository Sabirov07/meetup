import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { listMeetings } from "@/backend/data/meetings";
import { listTasks } from "@/backend/data/tasks";
import { TaskPage } from "@/frontend/components/tasks/task-page";
import { TaskStoreProvider } from "@/frontend/components/tasks/task-store";
import { BoardSkeleton } from "@/frontend/components/tasks/board-skeleton";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export const metadata: Metadata = { title: "My tasks" };

export default function MyTasksPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <MyTasksData />
    </Suspense>
  );
}

async function MyTasksData() {
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
        heading="My tasks"
        description="Everything assigned to you. Drag a card between columns to change its status."
        ownerFilter={session.member.id}
        owner={session.member}
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </TaskStoreProvider>
  );
}
