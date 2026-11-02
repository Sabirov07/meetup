import "server-only";

import { db } from "@/backend/db";
import { toMemberSummary } from "@/backend/auth/guards";
import type {
  ActivityView,
  AnalysisView,
  DecisionEntry,
  MeetingView,
  OpenQuestionEntry,
  ProposalView,
} from "@/shared/domain/types";

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  user: { select: { id: true, name: true, email: true, accentToken: true } },
} as const;

const meetingSelect = {
  id: true,
  title: true,
  source: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  endedAt: true,
  meetUrl: true,
  notes: true,
  createdAt: true,
  createdBy: { select: memberSelect },
  participants: {
    select: {
      id: true,
      displayName: true,
      email: true,
      member: { select: memberSelect },
    },
  },
  transcript: {
    select: { status: true, fetchedAt: true, failureReason: true, content: true },
  },
  analysis: { select: { status: true, summary: true, isSample: true } },
  _count: { select: { tasks: true } },
} as const;

export async function listMeetings(workspaceId: string): Promise<MeetingView[]> {
  const rows = await db.meeting.findMany({
    where: { workspaceId },
    select: meetingSelect,
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
  });

  const pending = await db.taskProposal.groupBy({
    by: ["meetingId"],
    where: { status: "PENDING", meeting: { workspaceId } },
    _count: { _all: true },
  });
  const pendingByMeeting = new Map(pending.map((p) => [p.meetingId, p._count._all]));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source,
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    meetUrl: row.meetUrl,
    notes: row.notes,
    createdBy: row.createdBy ? toMemberSummary(row.createdBy) : null,
    participants: row.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      email: p.email,
      member: p.member ? toMemberSummary(p.member) : null,
    })),
    transcript: row.transcript
      ? {
          status: row.transcript.status,
          fetchedAt: row.transcript.fetchedAt?.toISOString() ?? null,
          failureReason: row.transcript.failureReason,
          // The transcript body itself is never sent to the client here.
          hasContent: Boolean(row.transcript.content),
        }
      : null,
    analysis: row.analysis
      ? {
          status: row.analysis.status,
          summary: row.analysis.summary,
          isSample: row.analysis.isSample,
        }
      : null,
    taskCount: row._count.tasks,
    pendingProposalCount: pendingByMeeting.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getMeeting(
  meetingId: string,
  workspaceId: string,
): Promise<MeetingView | null> {
  const all = await listMeetings(workspaceId);
  return all.find((m) => m.id === meetingId) ?? null;
}

// ---------------------------------------------------------------------------
// AI review
// ---------------------------------------------------------------------------

const proposalSelect = {
  id: true,
  meetingId: true,
  title: true,
  description: true,
  ownerEvidence: true,
  ownerRationale: true,
  isExplicitCommitment: true,
  suggestedPriority: true,
  priorityEvidence: true,
  priorityRationale: true,
  suggestedDueDate: true,
  dueDateEvidence: true,
  category: true,
  labels: true,
  transcriptExcerpt: true,
  blockers: true,
  dependsOnTitles: true,
  status: true,
  needsReview: true,
  isSample: true,
  createdTaskId: true,
  createdAt: true,
  suggestedOwner: { select: memberSelect },
  meeting: { select: { title: true } },
} as const;

type ProposalRow = {
  id: string;
  meetingId: string;
  title: string;
  description: string | null;
  ownerEvidence: ProposalView["ownerEvidence"];
  ownerRationale: string | null;
  isExplicitCommitment: boolean;
  suggestedPriority: ProposalView["suggestedPriority"];
  priorityEvidence: ProposalView["priorityEvidence"];
  priorityRationale: string | null;
  suggestedDueDate: string | null;
  dueDateEvidence: ProposalView["dueDateEvidence"];
  category: ProposalView["category"];
  labels: string[];
  transcriptExcerpt: string | null;
  blockers: string[];
  dependsOnTitles: string[];
  status: ProposalView["status"];
  needsReview: boolean;
  isSample: boolean;
  createdTaskId: string | null;
  createdAt: Date;
  suggestedOwner: Parameters<typeof toMemberSummary>[0] | null;
  meeting: { title: string };
};

function toProposalView(row: ProposalRow): ProposalView {
  return {
    id: row.id,
    meetingId: row.meetingId,
    meetingTitle: row.meeting.title,
    title: row.title,
    description: row.description,
    suggestedOwner: row.suggestedOwner ? toMemberSummary(row.suggestedOwner) : null,
    ownerEvidence: row.ownerEvidence,
    ownerRationale: row.ownerRationale,
    isExplicitCommitment: row.isExplicitCommitment,
    suggestedPriority: row.suggestedPriority,
    priorityEvidence: row.priorityEvidence,
    priorityRationale: row.priorityRationale,
    suggestedDueDate: row.suggestedDueDate,
    dueDateEvidence: row.dueDateEvidence,
    category: row.category,
    labels: row.labels,
    transcriptExcerpt: row.transcriptExcerpt,
    blockers: row.blockers,
    dependsOnTitles: row.dependsOnTitles,
    status: row.status,
    needsReview: row.needsReview,
    isSample: row.isSample,
    createdTaskId: row.createdTaskId,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseDecisions(value: unknown): DecisionEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.text !== "string") return [];
    const evidence = e.evidence;
    return [
      {
        text: e.text,
        evidence:
          evidence === "CONFIRMED" || evidence === "INFERRED" || evidence === "RECOMMENDED"
            ? evidence
            : "INFERRED",
        excerpt: typeof e.excerpt === "string" ? e.excerpt : null,
      },
    ];
  });
}

function parseQuestions(value: unknown): OpenQuestionEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.text !== "string") return [];
    return [{ text: e.text, excerpt: typeof e.excerpt === "string" ? e.excerpt : null }];
  });
}

/** Analyses that have something for a human to look at, newest first. */
export async function listAnalyses(workspaceId: string): Promise<AnalysisView[]> {
  const rows = await db.meetingAnalysis.findMany({
    where: { meeting: { workspaceId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      meetingId: true,
      status: true,
      summary: true,
      decisions: true,
      openQuestions: true,
      model: true,
      failureReason: true,
      isSample: true,
      meeting: {
        select: {
          title: true,
          scheduledAt: true,
          endedAt: true,
          transcript: { select: { status: true } },
        },
      },
      proposals: { select: proposalSelect, orderBy: { createdAt: "asc" } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    meetingId: row.meetingId,
    meetingTitle: row.meeting.title,
    meetingDate: (row.meeting.endedAt ?? row.meeting.scheduledAt)?.toISOString() ?? null,
    status: row.status,
    summary: row.summary,
    decisions: parseDecisions(row.decisions),
    openQuestions: parseQuestions(row.openQuestions),
    model: row.model,
    failureReason: row.failureReason,
    isSample: row.isSample,
    transcriptStatus: row.meeting.transcript?.status ?? "NOT_REQUESTED",
    proposals: row.proposals.map(toProposalView),
  }));
}

export async function countPendingProposals(workspaceId: string): Promise<number> {
  return db.taskProposal.count({
    where: { status: "PENDING", meeting: { workspaceId } },
  });
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export async function listActivity(workspaceId: string, take = 80): Promise<ActivityView[]> {
  const rows = await db.activityEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      summary: true,
      taskId: true,
      meetingId: true,
      metadata: true,
      createdAt: true,
      actor: { select: memberSelect },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    summary: row.summary,
    actor: row.actor ? toMemberSummary(row.actor) : null,
    taskId: row.taskId,
    meetingId: row.meetingId,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
  }));
}
