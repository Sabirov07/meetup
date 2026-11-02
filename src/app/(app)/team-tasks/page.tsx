import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { listMeetings } from "@/backend/data/meetings";
import { listSpaces } from "@/backend/data/spaces";
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
  return { title: t("nav.teamTasks") };
}

export default function TeamTasksPage(props: PageProps<"/team-tasks">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <TeamTasksData searchParams={props.searchParams} />
    </Suspense>
  );
}

/**
 * Everyone else's work.
 *
 * `?owner=<memberId>` narrows it to one person, which is what the Team page
 * links to — the same surface answers "what is the team carrying?" and "what
 * is Anna carrying?" rather than needing a route per colleague. An id that
 * names nobody is ignored rather than erroring: a stale bookmark should show
 * the team, not a crash.
 */
async function TeamTasksData({
  searchParams,
}: {
  searchParams: PageProps<"/team-tasks">["searchParams"];
}) {
  await connection();
  const now = new Date();
  const [session, search] = await Promise.all([requireSession(), searchParams]);

  const [tasks, meetings, spaces] = await Promise.all([
    listTasks(session.workspace.id),
    listMeetings(session.workspace.id),
    listSpaces(session.workspace.id),
  ]);

  const requested = Array.isArray(search.owner) ? search.owner[0] : search.owner;
  const others = session.workspace.members.filter((m) => m.id !== session.member.id);

  // An explicit ?owner= wins. Failing that, a two-person workspace has exactly
  // one "them", and naming that person beats a generic heading.
  const focus =
    (requested ? session.workspace.members.find((m) => m.id === requested) : undefined) ??
    (others.length === 1 ? others[0] : undefined) ??
    null;

  return (
    <TaskStoreProvider
      initialTasks={tasks}
      members={session.workspace.members}
      spaces={spaces}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
      initialFilters={focus ? undefined : { owners: others.map((m) => m.id) }}
    >
      <TaskPage
        heading={focus ? "nav.personTasks" : "nav.teamTasks"}
        headingName={focus?.name}
        description={focus ? "tasks.page.person.description" : "tasks.page.team.description"}
        ownerFilter={focus?.id}
        owner={focus}
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </TaskStoreProvider>
  );
}
