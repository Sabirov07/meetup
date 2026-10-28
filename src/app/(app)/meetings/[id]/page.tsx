import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { getMeeting, listAnalyses } from "@/lib/data/meetings";
import { listTasks } from "@/lib/data/tasks";
import { isAiConfigured } from "@/lib/ai/extract";
import { MeetingDetail } from "@/components/meetings/meeting-detail";

export const instant = false;

export async function generateMetadata(props: PageProps<"/meetings/[id]">) {
  const { id } = await props.params;
  const session = await requireSession();
  const meeting = await getMeeting(id, session.workspace.id);
  return { title: meeting?.title ?? "Meeting" };
}

export default async function MeetingPage(props: PageProps<"/meetings/[id]">) {
  await connection();
  const now = new Date();

  const { id } = await props.params;
  const session = await requireSession();

  const meeting = await getMeeting(id, session.workspace.id);
  if (!meeting) notFound();

  const [analyses, allTasks] = await Promise.all([
    listAnalyses(session.workspace.id),
    listTasks(session.workspace.id),
  ]);

  const analysis = analyses.find((a) => a.meetingId === id) ?? null;
  const tasks = allTasks.filter((t) => t.sourceMeeting?.id === id);

  return (
    <MeetingDetail
      meeting={meeting}
      analysis={analysis}
      tasks={tasks}
      members={session.workspace.members}
      aiConfigured={isAiConfigured()}
      serverNow={now.toISOString()}
    />
  );
}
