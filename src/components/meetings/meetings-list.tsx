"use client";

import {
  CalendarClock,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Play,
  Sparkles,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { analyseMeeting } from "@/lib/actions/analysis";
import { deleteMeeting, setMeetingStatus } from "@/lib/actions/meetings";
import type { MeetingView, MemberSummary } from "@/lib/domain/types";
import { meetingStatusMeta, transcriptStatusMeta } from "@/lib/domain/labels";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge, Count } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Tooltip } from "@/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { AddTranscriptDialog } from "./add-transcript-dialog";
import { StartMeetingDialog, type GoogleState } from "./start-meeting-dialog";

export function MeetingsList({
  meetings: initial,
  members,
  currentMemberId,
  google,
  aiConfigured,
  serverNow,
}: {
  meetings: MeetingView[];
  members: MemberSummary[];
  currentMemberId: string;
  google: GoogleState;
  aiConfigured: boolean;
  serverNow: string;
}) {
  const [meetings, setMeetings] = useState(initial);
  const [now] = useState(() => new Date(serverNow));
  const [startOpen, setStartOpen] = useState(false);
  const [transcriptFor, setTranscriptFor] = useState<MeetingView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function replace(meeting: MeetingView) {
    setMeetings((prev) => prev.map((m) => (m.id === meeting.id ? meeting : m)));
  }

  const upcoming = meetings.filter((m) =>
    ["SCHEDULED", "READY_TO_JOIN", "IN_PROGRESS"].includes(m.status),
  );
  const needsAttention = meetings.filter((m) =>
    ["AWAITING_TRANSCRIPT", "PROCESSING", "REVIEW_REQUIRED", "FAILED"].includes(m.status),
  );
  const done = meetings.filter((m) => m.status === "COMPLETED");

  async function runAnalysis(meeting: MeetingView) {
    setBusyId(meeting.id);
    const result = await analyseMeeting(meeting.id);
    setBusyId(null);
    if (!result.ok) {
      toast.error("Analysis failed", { description: result.error });
      return;
    }
    replace(result.data);
    toast.success("Analysis complete", { description: "Proposed tasks are ready for review." });
  }

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">Meetings</h1>
          <p className="mt-1 text-[13px] leading-5 text-text-muted">
            Each conversation, its transcript, and the tasks that came out of it.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setStartOpen(true)}>
          <Video className="h-3.5 w-3.5" />
          Start meeting
        </Button>
      </header>

      {meetings.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={CalendarClock}
            title="No meetings yet"
            description="Start one and it will appear here with its transcript and extracted tasks."
            action={
              <Button variant="primary" size="sm" onClick={() => setStartOpen(true)}>
                <Video className="h-3 w-3" />
                Start meeting
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Group title="Needs attention" count={needsAttention.length} meetings={needsAttention}>
            {(meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                now={now}
                busy={busyId === meeting.id}
                aiConfigured={aiConfigured}
                onAddTranscript={() => setTranscriptFor(meeting)}
                onAnalyse={() => void runAnalysis(meeting)}
                onStatus={async (status) => {
                  const result = await setMeetingStatus({ id: meeting.id, status });
                  if (result.ok) replace(result.data);
                  else toast.error("Could not update the meeting", { description: result.error });
                }}
                onDelete={async () => {
                  const result = await deleteMeeting(meeting.id);
                  if (result.ok) {
                    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
                    toast.success("Meeting deleted");
                  } else {
                    toast.error("Could not delete that meeting", { description: result.error });
                  }
                }}
              />
            )}
          </Group>

          <Group title="Upcoming" count={upcoming.length} meetings={upcoming}>
            {(meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                now={now}
                busy={busyId === meeting.id}
                aiConfigured={aiConfigured}
                onAddTranscript={() => setTranscriptFor(meeting)}
                onAnalyse={() => void runAnalysis(meeting)}
                onStatus={async (status) => {
                  const result = await setMeetingStatus({ id: meeting.id, status });
                  if (result.ok) replace(result.data);
                  else toast.error("Could not update the meeting", { description: result.error });
                }}
                onDelete={async () => {
                  const result = await deleteMeeting(meeting.id);
                  if (result.ok) {
                    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
                    toast.success("Meeting deleted");
                  } else {
                    toast.error("Could not delete that meeting", { description: result.error });
                  }
                }}
              />
            )}
          </Group>

          <Group title="Completed" count={done.length} meetings={done}>
            {(meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                now={now}
                busy={busyId === meeting.id}
                aiConfigured={aiConfigured}
                onAddTranscript={() => setTranscriptFor(meeting)}
                onAnalyse={() => void runAnalysis(meeting)}
                onStatus={async (status) => {
                  const result = await setMeetingStatus({ id: meeting.id, status });
                  if (result.ok) replace(result.data);
                  else toast.error("Could not update the meeting", { description: result.error });
                }}
                onDelete={async () => {
                  const result = await deleteMeeting(meeting.id);
                  if (result.ok) {
                    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
                    toast.success("Meeting deleted");
                  } else {
                    toast.error("Could not delete that meeting", { description: result.error });
                  }
                }}
              />
            )}
          </Group>
        </>
      )}

      <StartMeetingDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        members={members}
        currentMemberId={currentMemberId}
        google={google}
      />

      {transcriptFor && (
        <AddTranscriptDialog
          open
          onOpenChange={(open) => !open && setTranscriptFor(null)}
          meeting={transcriptFor}
          onSaved={replace}
        />
      )}
    </div>
  );
}

function Group({
  title,
  count,
  meetings,
  children,
}: {
  title: string;
  count: number;
  meetings: MeetingView[];
  children: (meeting: MeetingView) => React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="eyebrow">{title}</h2>
        <Count>{count}</Count>
      </div>
      <div className="space-y-2">{meetings.map(children)}</div>
    </section>
  );
}

function MeetingCard({
  meeting,
  now,
  busy,
  aiConfigured,
  onAddTranscript,
  onAnalyse,
  onStatus,
  onDelete,
}: {
  meeting: MeetingView;
  now: Date;
  busy: boolean;
  aiConfigured: boolean;
  onAddTranscript: () => void;
  onAnalyse: () => void;
  onStatus: (status: MeetingView["status"]) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const status = meetingStatusMeta[meeting.status];
  const transcript = meeting.transcript;
  const canAnalyse = transcript?.status === "READY" && transcript.hasContent;

  return (
    <article className="rounded-xl border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/meetings/${meeting.id}`}
              className="truncate text-[13px] font-semibold tracking-[-0.01em] text-text hover:underline"
            >
              {meeting.title}
            </Link>
            <Badge tone={status.tone}>{status.label}</Badge>
            {meeting.analysis?.isSample && <Badge tone="tone-neutral">Sample data</Badge>}
            {meeting.source === "GOOGLE_MEET" && (
              <Tooltip content="Created through the Google Meet API">
                <span>
                  <Badge tone="tone-info" variant="outline">
                    Google Meet
                  </Badge>
                </span>
              </Tooltip>
            )}
          </div>

          <p className="mt-1 text-2xs text-text-muted">{formatWhen(meeting.scheduledAt, now)}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-faint">
            {meeting.participants.length > 0 && (
              <AvatarStack
                members={meeting.participants.map((p) => ({
                  name: p.member?.name ?? p.displayName,
                  initials: p.member?.initials ?? p.displayName.slice(0, 2).toUpperCase(),
                  accentToken: p.member?.accentToken ?? "slate",
                }))}
              />
            )}

            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {transcript
                ? transcriptStatusMeta[transcript.status].label
                : "No transcript"}
            </span>

            {meeting.taskCount > 0 && (
              <span>
                {meeting.taskCount} {meeting.taskCount === 1 ? "task" : "tasks"}
              </span>
            )}

            {meeting.pendingProposalCount > 0 && (
              <Link href="/review" className="text-accent-bright hover:underline">
                {meeting.pendingProposalCount} awaiting review
              </Link>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {meeting.meetUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={meeting.meetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Join
              </a>
            </Button>
          )}

          {!transcript?.hasContent && (
            <Button variant="outline" size="sm" onClick={onAddTranscript}>
              <FileText className="h-3 w-3" />
              Add transcript
            </Button>
          )}

          {canAnalyse && (
            <Tooltip
              content={
                aiConfigured
                  ? "Extract tasks, owners and decisions from the transcript"
                  : "Needs ANTHROPIC_API_KEY in .env.local"
              }
            >
              <Button
                variant="primary"
                size="sm"
                onClick={onAnalyse}
                loading={busy}
                loadingLabel="Analysing…"
                disabled={!aiConfigured}
              >
                <Sparkles className="h-3 w-3" />
                {meeting.analysis?.status === "COMPLETED" ? "Re-analyse" : "Analyse"}
              </Button>
            </Tooltip>
          )}

          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${meeting.title}`}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem asChild>
                <Link href={`/meetings/${meeting.id}`}>Open meeting</Link>
              </MenuItem>
              <MenuSeparator />
              {meeting.status !== "IN_PROGRESS" && (
                <MenuItem onSelect={() => void onStatus("IN_PROGRESS")}>
                  <Play className="h-3.5 w-3.5" />
                  Mark in progress
                </MenuItem>
              )}
              {meeting.status === "IN_PROGRESS" && (
                <MenuItem onSelect={() => void onStatus("AWAITING_TRANSCRIPT")}>
                  <Square className="h-3.5 w-3.5" />
                  Mark as ended
                </MenuItem>
              )}
              <MenuItem onSelect={onAddTranscript}>
                <FileText className="h-3.5 w-3.5" />
                {transcript?.hasContent ? "Replace transcript" : "Add transcript"}
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => void onDelete()}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete meeting
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      {meeting.status === "FAILED" && transcript?.failureReason && (
        <p
          className={cn(
            "tone-danger border-t border-line bg-[var(--tone-bg)] px-3 py-2 text-2xs leading-4",
            "text-[var(--tone-fg)]",
          )}
        >
          {transcript.failureReason}
        </p>
      )}
    </article>
  );
}
