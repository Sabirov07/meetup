import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getTranslator } from "@/backend/i18n/locale";
import { getMeeting, listAnalyses } from "@/backend/data/meetings";
import { listTasks } from "@/backend/data/tasks";
import { listStatuses } from "@/backend/data/statuses";
import { isAiConfigured } from "@/backend/ai/extract";
import { MeetingDetail } from "@/frontend/components/meetings/meeting-detail";

export const instant = false;

export async function generateMetadata(props: PageProps<"/meetings/[id]">) {
  const { id } = await props.params;
  const session = await requireSession();
  const [meeting, { t }] = await Promise.all([
    getMeeting(id, session.workspace.id),
    getTranslator(),
  ]);
  return { title: meeting?.title ?? t("palette.kind.meeting") };
}

export default async function MeetingPage(props: PageProps<"/meetings/[id]">) {
  await connection();
  const now = new Date();

  const { id } = await props.params;
  const session = await requireSession();

  const meeting = await getMeeting(id, session.workspace.id);
  if (!meeting) notFound();

  const [analyses, allTasks, statuses] = await Promise.all([
    listAnalyses(session.workspace.id),
    listTasks(session.workspace.id),
    listStatuses(session.workspace.id),
  ]);

  const analysis = analyses.find((a) => a.meetingId === id) ?? null;
  const tasks = allTasks.filter((t) => t.sourceMeeting?.id === id);

  return (
    <MeetingDetail
      meeting={meeting}
      analysis={analysis}
      tasks={tasks}
      statuses={statuses}
      members={session.workspace.members}
      aiConfigured={isAiConfigured()}
      serverNow={now.toISOString()}
    />
  );
}
