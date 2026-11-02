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
import { analyseMeeting } from "@/backend/actions/analysis";
import { deleteMeeting, setMeetingStatus } from "@/backend/actions/meetings";
import type { MeetingView, MemberSummary } from "@/shared/domain/types";
import { meetingStatusMeta } from "@/shared/domain/labels";
import { useI18n, useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { AvatarStack } from "@/frontend/components/ui/avatar";
import { Badge, Count } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState, Tooltip } from "@/frontend/components/ui/feedback";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/frontend/components/ui/menu";
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
  const t = useT();
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
      toast.error(t("meetings.analysisFailed"), { description: result.error });
      return;
    }
    replace(result.data);
    toast.success(t("meetings.analysisComplete"), {
      description: t("meetings.analysisCompleteDetail"),
    });
  }

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {t("meetings.heading")}
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-text-muted">
            {t("meetings.description")}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setStartOpen(true)}>
          <Video className="h-3.5 w-3.5" />
          {t("header.startMeeting")}
        </Button>
      </header>

      {meetings.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={CalendarClock}
            title={t("meetings.empty.title")}
            description={t("meetings.empty.description")}
            action={
              <Button variant="primary" size="sm" onClick={() => setStartOpen(true)}>
                <Video className="h-3 w-3" />
                {t("header.startMeeting")}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <Group title={t("meetings.group.needsAttention")} count={needsAttention.length} meetings={needsAttention}>
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
                  else toast.error(t("meetings.updateFailed"), { description: result.error });
                }}
                onDelete={async () => {
                  const result = await deleteMeeting(meeting.id);
                  if (result.ok) {
                    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
                    toast.success(t("meetings.deleted"));
                  } else {
                    toast.error(t("meetings.deleteFailed"), { description: result.error });
                  }
                }}
              />
            )}
          </Group>

          <Group title={t("meetings.group.upcoming")} count={upcoming.length} meetings={upcoming}>
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
                  else toast.error(t("meetings.updateFailed"), { description: result.error });
                }}
                onDelete={async () => {
                  const result = await deleteMeeting(meeting.id);
                  if (result.ok) {
                    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
                    toast.success(t("meetings.deleted"));
                  } else {
                    toast.error(t("meetings.deleteFailed"), { description: result.error });
                  }
                }}
              />
            )}
          </Group>

          <Group title={t("meetings.group.completed")} count={done.length} meetings={done}>
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
                  else toast.error(t("meetings.updateFailed"), { description: result.error });
                }}
                onDelete={async () => {
                  const result = await deleteMeeting(meeting.id);
                  if (result.ok) {
                    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
                    toast.success(t("meetings.deleted"));
                  } else {
                    toast.error(t("meetings.deleteFailed"), { description: result.error });
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
  const { t, f } = useI18n();
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
            <Badge tone={status.tone}>{t(`meetingStatus.${meeting.status}.label`)}</Badge>
            {meeting.analysis?.isSample && (
              <Badge tone="tone-neutral">{t("meetings.sampleData")}</Badge>
            )}
            {meeting.source === "GOOGLE_MEET" && (
              <Tooltip content={t("meetings.viaGoogleApi")}>
                <span>
                  <Badge tone="tone-info" variant="outline">
                    {t("meetings.googleMeet")}
                  </Badge>
                </span>
              </Tooltip>
            )}
          </div>

          <p className="mt-1 text-2xs text-text-muted">{f.when(meeting.scheduledAt, now)}</p>

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
                ? t(`transcriptStatus.${transcript.status}.label`)
                : t("meetings.noTranscript")}
            </span>

            {meeting.taskCount > 0 && (
              <span>{t("common.tasks", { count: meeting.taskCount })}</span>
            )}

            {meeting.pendingProposalCount > 0 && (
              <Link href="/review" className="text-accent-bright hover:underline">
                {t("meetings.awaitingReview", { count: meeting.pendingProposalCount })}
              </Link>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {meeting.meetUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={meeting.meetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                {t("meetings.join")}
              </a>
            </Button>
          )}

          {!transcript?.hasContent && (
            <Button variant="outline" size="sm" onClick={onAddTranscript}>
              <FileText className="h-3 w-3" />
              {t("meetings.addTranscript")}
            </Button>
          )}

          {canAnalyse && (
            <Tooltip
              content={t(
                aiConfigured ? "meetings.analyseTip" : "meetings.analyseNeedsKey",
              )}
            >
              <Button
                variant="primary"
                size="sm"
                onClick={onAnalyse}
                loading={busy}
                loadingLabel={t("meetings.analysing")}
                disabled={!aiConfigured}
              >
                <Sparkles className="h-3 w-3" />
                {t(
                  meeting.analysis?.status === "COMPLETED"
                    ? "meetings.reanalyse"
                    : "meetings.analyse",
                )}
              </Button>
            </Tooltip>
          )}

          <Menu>
            <MenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("meetings.actionsFor", { title: meeting.title })}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem asChild>
                <Link href={`/meetings/${meeting.id}`}>{t("meetings.openMeeting")}</Link>
              </MenuItem>
              <MenuSeparator />
              {meeting.status !== "IN_PROGRESS" && (
                <MenuItem onSelect={() => void onStatus("IN_PROGRESS")}>
                  <Play className="h-3.5 w-3.5" />
                  {t("meetings.markInProgress")}
                </MenuItem>
              )}
              {meeting.status === "IN_PROGRESS" && (
                <MenuItem onSelect={() => void onStatus("AWAITING_TRANSCRIPT")}>
                  <Square className="h-3.5 w-3.5" />
                  {t("meetings.markEnded")}
                </MenuItem>
              )}
              <MenuItem onSelect={onAddTranscript}>
                <FileText className="h-3.5 w-3.5" />
                {t(
                  transcript?.hasContent
                    ? "meetings.replaceTranscript"
                    : "meetings.addTranscript",
                )}
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => void onDelete()}>
                <Trash2 className="h-3.5 w-3.5" />
                {t("meetings.deleteMeeting")}
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
