import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { listMeetings } from "@/backend/data/meetings";
import { listSpaces } from "@/backend/data/spaces";
import { listStatuses } from "@/backend/data/statuses";
import { listTasks } from "@/backend/data/tasks";
import { getTranslator } from "@/backend/i18n/locale";
import { TaskPage } from "@/frontend/components/tasks/task-page";
import { TaskStoreProvider } from "@/frontend/components/tasks/task-store";
import { BoardSkeleton } from "@/frontend/components/tasks/board-skeleton";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.myTasks") };
}

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

  const [tasks, meetings, spaces, statuses] = await Promise.all([
    listTasks(session.workspace.id),
    listMeetings(session.workspace.id),
    listSpaces(session.workspace.id),
    listStatuses(session.workspace.id),
  ]);

  return (
    <TaskStoreProvider
      initialTasks={tasks}
      members={session.workspace.members}
      spaces={spaces}
      statuses={statuses}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
    >
      <TaskPage
        heading="nav.myTasks"
        description="tasks.page.mine.description"
        ownerFilter={session.member.id}
        owner={session.member}
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </TaskStoreProvider>
  );
}
