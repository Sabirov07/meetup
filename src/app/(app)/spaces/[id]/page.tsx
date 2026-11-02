import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { listMeetings } from "@/backend/data/meetings";
import { getSpace, listSpaces } from "@/backend/data/spaces";
import { listTasks } from "@/backend/data/tasks";
import { getTranslator } from "@/backend/i18n/locale";
import { NO_SPACE } from "@/shared/domain/types";
import { FolderOpen } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/ui/feedback";
import { TaskPage } from "@/frontend/components/tasks/task-page";
import { TaskStoreProvider } from "@/frontend/components/tasks/task-store";
import { BoardSkeleton } from "@/frontend/components/tasks/board-skeleton";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/spaces/[id]">): Promise<Metadata> {
  const { t } = await getTranslator();
  const { id } = await params;

  if (id === NO_SPACE) return { title: t("spaces.unfiled") };

  // A title is not worth failing the page over, so an unreadable session or a
  // stale id falls back to the generic heading rather than throwing.
  const session = await requireSession();
  const space = await getSpace(id, session.workspace.id);
  return { title: space?.name ?? t("nav.section.spaces") };
}

export default function SpacePage(props: PageProps<"/spaces/[id]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <SpaceData params={props.params} />
    </Suspense>
  );
}

/**
 * One section of the workspace, as a board.
 *
 * `/spaces/none` is the same surface for work that has not been filed under
 * anything — it is reachable from the sidebar whenever such work exists, and
 * it is where tasks land when a section is deleted. Treating it as a route
 * rather than a special case keeps one page answering "show me this pile".
 */
async function SpaceData({ params }: { params: PageProps<"/spaces/[id]">["params"] }) {
  await connection();
  const now = new Date();
  const [session, { id }] = await Promise.all([requireSession(), params]);

  const [tasks, meetings, spaces] = await Promise.all([
    listTasks(session.workspace.id),
    listMeetings(session.workspace.id),
    listSpaces(session.workspace.id),
  ]);

  const unfiled = id === NO_SPACE;
  const space = unfiled ? null : (spaces.find((s) => s.id === id) ?? null);

  // A deleted section leaves live links behind — in someone's browser, in a
  // chat message. Saying what happened, and where the work went, beats a 404.
  if (!unfiled && !space) return <MissingSpace />;

  return (
    <TaskStoreProvider
      initialTasks={tasks}
      members={session.workspace.members}
      spaces={spaces}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
    >
      <TaskPage
        heading="spaces.unfiled"
        headingText={space?.name}
        description={unfiled ? "spaces.unfiledDescription" : "spaces.page.description"}
        descriptionText={space?.description ?? undefined}
        spaceFilter={unfiled ? NO_SPACE : space!.id}
        space={space}
        meetings={meetings.map((m) => ({ id: m.id, title: m.title }))}
      />
    </TaskStoreProvider>
  );
}

async function MissingSpace() {
  const { t } = await getTranslator();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EmptyState
        icon={FolderOpen}
        title={t("spaces.gone")}
        description={t("spaces.goneBody")}
        action={
          <Button variant="secondary" asChild>
            <Link href="/all-tasks">{t("spaces.backToAll")}</Link>
          </Button>
        }
      />
    </div>
  );
}
