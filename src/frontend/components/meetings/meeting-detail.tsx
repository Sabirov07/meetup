"use client";

import {
  ArrowLeft,
  CircleHelp,
  ExternalLink,
  FileText,
  Gavel,
  Play,
  Sparkles,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { analyseMeeting } from "@/backend/actions/analysis";
import { getTranscriptText, setMeetingStatus } from "@/backend/actions/meetings";
import type {
  AnalysisView,
  MeetingStatus,
  MeetingView,
  MemberSummary,
  TaskView,
} from "@/shared/domain/types";
import {
  evidenceMeta,
  meetingStatusMeta,
  priorityMeta,
  statusMeta,
  transcriptStatusMeta,
} from "@/shared/domain/labels";
import { useI18n } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar, AvatarStack } from "@/frontend/components/ui/avatar";
import { Badge, Count, Dot } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState, Separator, Tooltip } from "@/frontend/components/ui/feedback";
import { ProposalCard } from "@/frontend/components/review/proposal-card";
import { AddTranscriptDialog } from "./add-transcript-dialog";

/**
 * The lifecycle a conversation actually goes through.
 *
 * Shown as a stepper so it is obvious where a meeting is stuck — in particular
 * that "awaiting transcript" is a real, expected state and not a failure.
 * Google does not produce a transcript the instant a call ends.
 */
const LIFECYCLE: MeetingStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_TRANSCRIPT",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "COMPLETED",
];

export function MeetingDetail({
  meeting: initial,
  analysis: initialAnalysis,
  tasks,
  members,
  aiConfigured,
  serverNow,
}: {
  meeting: MeetingView;
  analysis: AnalysisView | null;
  tasks: TaskView[];
  members: MemberSummary[];
  aiConfigured: boolean;
  serverNow: string;
}) {
  const { t, f } = useI18n();
  const [meeting, setMeeting] = useState(initial);
  const [analysis] = useState(initialAnalysis);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [now] = useState(() => new Date(serverNow));
  const router = useRouter();

  const transcript = meeting.transcript;
  const canAnalyse = transcript?.status === "READY" && transcript.hasContent;
  const pendingProposals =
    analysis?.proposals.filter((p) => p.status === "PENDING" && !resolved.has(p.id)) ?? [];

  const currentStep = LIFECYCLE.indexOf(meeting.status);

  async function loadTranscript() {
    setLoadingTranscript(true);
    const result = await getTranscriptText(meeting.id);
    setLoadingTranscript(false);
    if (result.ok) setTranscriptText(result.data.content);
    else toast.error(t("detail.loadTranscriptFailed"), { description: result.error });
  }

  async function runAnalysis() {
    setAnalysing(true);
    const result = await analyseMeeting(meeting.id);
    setAnalysing(false);
    if (!result.ok) {
      toast.error(t("meetings.analysisFailed"), { description: result.error });
      return;
    }
    setMeeting(result.data);
    toast.success(t("meetings.analysisComplete"), {
      description: t("detail.analysisCompleteDetail"),
      action: { label: t("detail.reviewAction"), onClick: () => router.push("/review") },
    });
  }

  async function changeStatus(status: MeetingStatus) {
    const result = await setMeetingStatus({ id: meeting.id, status });
    if (result.ok) setMeeting(result.data);
    else toast.error(t("meetings.updateFailed"), { description: result.error });
  }

  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-2xs text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-3 w-3" />
        {t("detail.allMeetings")}
      </Link>

      {/* Header */}
      <header className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-base font-semibold tracking-[-0.02em] text-text">
                {meeting.title}
              </h1>
              <Badge tone={meetingStatusMeta[meeting.status].tone}>
                {t(`meetingStatus.${meeting.status}.label`)}
              </Badge>
              {meeting.source === "GOOGLE_MEET" && (
                <Badge tone="tone-info" variant="outline">
                  {t("meetings.googleMeet")}
                </Badge>
              )}
              {analysis?.isSample && (
                <Badge tone="tone-neutral">{t("meetings.sampleData")}</Badge>
              )}
            </div>
            <p className="mt-1 text-2xs text-text-muted">
              {f.when(meeting.scheduledAt, now)}
              {meeting.createdBy &&
                ` · ${t("detail.createdBy", { name: meeting.createdBy.name })}`}
            </p>
            {meeting.participants.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <AvatarStack
                  members={meeting.participants.map((p) => ({
                    name: p.member?.name ?? p.displayName,
                    initials: p.member?.initials ?? p.displayName.slice(0, 2).toUpperCase(),
                    accentToken: p.member?.accentToken ?? "slate",
                  }))}
                  max={5}
                />
                <span className="text-2xs text-text-faint">
                  {meeting.participants.map((p) => p.member?.name ?? p.displayName).join(", ")}
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {meeting.meetUrl && (
              <Button variant="secondary" size="md" asChild>
                <a href={meeting.meetUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("detail.joinCall")}
                </a>
              </Button>
            )}
            {meeting.status === "IN_PROGRESS" ? (
              <Button variant="outline" size="md" onClick={() => void changeStatus("AWAITING_TRANSCRIPT")}>
                <Square className="h-3.5 w-3.5" />
                {t("detail.endMeeting")}
              </Button>
            ) : (
              meeting.status === "SCHEDULED" ||
              (meeting.status === "READY_TO_JOIN" && (
                <Button variant="outline" size="md" onClick={() => void changeStatus("IN_PROGRESS")}>
                  <Play className="h-3.5 w-3.5" />
                  {t("detail.startMeeting")}
                </Button>
              ))
            )}
          </div>
        </div>

        {/* Lifecycle */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-line px-4 py-2.5">
          {LIFECYCLE.map((step, index) => {
            const meta = meetingStatusMeta[step];
            const reached = currentStep >= index && currentStep !== -1;
            const active = meeting.status === step;
            return (
              <div key={step} className="flex shrink-0 items-center gap-1">
                <Tooltip content={t(`meetingStatus.${step}.description`)}>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs transition-colors",
                      active
                        ? `${meta.tone} bg-[var(--tone-bg)] font-medium text-[var(--tone-fg)]`
                        : reached
                          ? "text-text-muted"
                          : "text-text-faint",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        active
                          ? "bg-[var(--tone-fg)]"
                          : reached
                            ? "bg-text-muted"
                            : "bg-line-strong",
                      )}
                    />
                    {t(`meetingStatus.${step}.label`)}
                  </span>
                </Tooltip>
                {index < LIFECYCLE.length - 1 && (
                  <span
                    aria-hidden
                    className={cn("h-px w-3", reached ? "bg-line-strong" : "bg-line")}
                  />
                )}
              </div>
            );
          })}
          {meeting.status === "FAILED" && (
            <Badge tone="tone-danger" className="ml-2">
              {t("detail.failed")}
            </Badge>
          )}
        </div>
      </header>

      {/* Transcript */}
      <section className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-text-faint" />
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
              {t("detail.transcript")}
            </h2>
            {transcript && (
              <Badge tone={transcriptStatusMeta[transcript.status].tone}>
                {t(`transcriptStatus.${transcript.status}.label`)}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {transcript?.hasContent && !transcriptText && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadTranscript()}
                loading={loadingTranscript}
              >
                {t("detail.viewTranscript")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setTranscriptOpen(true)}>
              {t(transcript?.hasContent ? "detail.replace" : "meetings.addTranscript")}
            </Button>
            {canAnalyse && (
              <Tooltip
                content={aiConfigured ? undefined : t("meetings.analyseNeedsKey")}
              >
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void runAnalysis()}
                  loading={analysing}
                  loadingLabel={t("meetings.analysing")}
                  disabled={!aiConfigured}
                >
                  <Sparkles className="h-3 w-3" />
                  {t(
                    analysis?.status === "COMPLETED"
                      ? "meetings.reanalyse"
                      : "meetings.analyse",
                  )}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="px-4 py-3">
          {!transcript || !transcript.hasContent ? (
            <div className="space-y-2">
              <p className="text-2xs leading-5 text-text-muted">
                {transcript
                  ? t(`transcriptStatus.${transcript.status}.detail`)
                  : t("detail.noTranscriptStored")}
              </p>
              <p className="text-2xs leading-5 text-text-faint">{t("detail.transcriptHelp")}</p>
            </div>
          ) : transcriptText ? (
            <pre className="max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-md bg-canvas p-3 font-mono text-2xs leading-5 text-text-secondary">
              {transcriptText}
            </pre>
          ) : (
            <p className="text-2xs text-text-muted">
              {transcript.fetchedAt
                ? t("detail.storedAt", { when: f.dateTime(transcript.fetchedAt, now) })
                : t("detail.stored")}
            </p>
          )}

          {transcript?.failureReason && (
            <p className="mt-2 text-2xs leading-4 text-danger">{transcript.failureReason}</p>
          )}
        </div>
      </section>

      {/* Analysis */}
      {analysis && analysis.status === "COMPLETED" && (
        <section className="rounded-xl border border-line bg-surface">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <Sparkles className="h-3.5 w-3.5 text-accent-bright" />
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
              {t("detail.analysisHeading")}
            </h2>
            {analysis.model && (
              <span className="ml-auto text-2xs text-text-faint">{analysis.model}</span>
            )}
          </div>

          {analysis.summary && (
            <div className="px-4 py-3">
              <p className="eyebrow mb-1">{t("detail.summary")}</p>
              <p className="text-[13px] leading-6 text-text-secondary">{analysis.summary}</p>
            </div>
          )}

          {analysis.decisions.length > 0 && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                  <Gavel className="h-3 w-3" />
                  {t("detail.decisions")}
                  <Count>{analysis.decisions.length}</Count>
                </p>
                <ul className="space-y-2">
                  {analysis.decisions.map((decision, index) => (
                    <li key={index}>
                      <div className="flex items-start gap-1.5">
                        <Badge tone={evidenceMeta[decision.evidence].tone} variant="outline">
                          {t(`evidence.${decision.evidence}.label`)}
                        </Badge>
                        <p className="min-w-0 flex-1 text-2xs leading-5 text-text-secondary">
                          {decision.text}
                        </p>
                      </div>
                      {decision.excerpt && (
                        <p className="mt-0.5 text-2xs italic leading-4 text-text-faint">
                          “{decision.excerpt}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {analysis.openQuestions.length > 0 && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                  <CircleHelp className="h-3 w-3" />
                  {t("detail.openQuestions")}
                  <Count>{analysis.openQuestions.length}</Count>
                </p>
                <ul className="space-y-1.5">
                  {analysis.openQuestions.map((question, index) => (
                    <li key={index}>
                      <p className="text-2xs leading-5 text-text-secondary">{question.text}</p>
                      {question.excerpt && (
                        <p className="text-2xs italic leading-4 text-text-faint">
                          “{question.excerpt}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      )}

      {analysis?.status === "FAILED" && (
        <section className="tone-danger rounded-xl border border-danger/35 bg-[var(--tone-bg)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--tone-fg)]">
            {t("meetings.analysisFailed")}
          </p>
          <p className="mt-0.5 text-2xs leading-4 text-text-secondary">
            {analysis.failureReason ?? t("detail.analysisFailedReason")}
          </p>
          {canAnalyse && aiConfigured && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => void runAnalysis()}
              loading={analysing}
            >
              {t("common.retry")}
            </Button>
          )}
        </section>
      )}

      {/* Proposals awaiting review */}
      {pendingProposals.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="eyebrow">{t("detail.proposedTasks")}</h2>
            <Count>{pendingProposals.length}</Count>
            <span className="text-2xs text-text-faint">{t("detail.notCommitments")}</span>
          </div>
          {pendingProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              members={members}
              onResolved={(id) => setResolved((prev) => new Set(prev).add(id))}
            />
          ))}
        </section>
      )}

      {/* Tasks from this meeting */}
      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
            {t("detail.tasksFromMeeting")}
          </h2>
          <Count>{tasks.length}</Count>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            title={t("detail.noTasks")}
            description={t(
              canAnalyse ? "detail.noTasksCanAnalyse" : "detail.noTasksNeedTranscript",
            )}
          />
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 border-b border-line px-4 py-2 last:border-b-0"
            >
              <Dot tone={statusMeta[task.status].tone} />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px]",
                  task.status === "COMPLETED"
                    ? "text-text-faint line-through"
                    : "text-text-secondary",
                )}
              >
                {task.title}
              </span>
              <Badge tone={priorityMeta[task.priority].tone}>
                {t(`priority.${task.priority}.label`)}
              </Badge>
              <Avatar member={task.owner} size="md" />
            </div>
          ))
        )}
      </section>

      <AddTranscriptDialog
        open={transcriptOpen}
        onOpenChange={setTranscriptOpen}
        meeting={meeting}
        onSaved={(updated) => {
          setMeeting(updated);
          setTranscriptText(null);
        }}
      />
    </div>
  );
}
