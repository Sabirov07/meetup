import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { listMeetings } from "@/backend/data/meetings";
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
  return { title: t("nav.employerTasks") };
}

export default function EmployerTasksPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <EmployerTasksData />
    </Suspense>
  );
}

async function EmployerTasksData() {
  await connection();
  const now = new Date();
  const session = await requireSession();

  const [tasks, meetings] = await Promise.all([
    listTasks(session.workspace.id),
    listMeetings(session.workspace.id),
  ]);

  const others = session.workspace.members.filter((m) => m.id !== session.member.id);
  const counterpart = others.length === 1 ? others[0]! : null;

  return (
    <TaskStoreProvider
      initialTasks={tasks}
      members={session.workspace.members}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
      initialFilters={counterpart ? undefined : { owners: others.map((m) => m.id) }}
    >
      <TaskPage
        heading={counterpart ? "nav.personTasks" : "nav.teamTasks"}
        headingName={counterpart?.name}
        description={
          counterpart ? "tasks.page.employer.description" : "tasks.page.team.description"
        }
        // With more than two people this becomes an owner-filtered view of all
        // tasks rather than a single person's board.
        ownerFilter={counterpart?.id}
        owner={counterpart}
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </TaskStoreProvider>
  );
}
