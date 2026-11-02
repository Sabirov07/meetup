/**
 * Domain model. Deliberately free of any Prisma / database import so that
 * client components can use these types and label maps without pulling the
 * generated client into the browser bundle.
 *
 * The string values match the Prisma enum values exactly, so translating at
 * the data-access boundary is an identity cast rather than a lookup table.
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CATEGORIES = [
  "DEVELOPMENT",
  "AI_AUTOMATION",
  "INFRASTRUCTURE",
  "RESEARCH",
  "BUSINESS_OPS",
  "FINANCE",
  "COMMUNICATION",
  "ADMINISTRATION",
  "PLANNING",
  "REVIEW_APPROVAL",
  "GENERAL",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/**
 * Avatar colours. Lives here rather than beside the server action that uses it
 * because a `"use server"` module may only export async functions — a plain
 * array exported from one becomes an unusable server reference on the client.
 */
export const ACCENT_TOKENS = ["violet", "amber", "teal", "blue", "rose", "slate"] as const;
export type AccentToken = (typeof ACCENT_TOKENS)[number];

export const EVIDENCE_LEVELS = ["CONFIRMED", "INFERRED", "RECOMMENDED"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const MEETING_STATUSES = [
  "SCHEDULED",
  "READY_TO_JOIN",
  "IN_PROGRESS",
  "AWAITING_TRANSCRIPT",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "COMPLETED",
  "FAILED",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const TRANSCRIPT_STATUSES = [
  "NOT_REQUESTED",
  "AWAITING",
  "FETCHING",
  "READY",
  "UNAVAILABLE",
  "FAILED",
] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

export type AnalysisStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type ProposalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type WorkspaceRole = "ADMINISTRATOR" | "MEMBER";
export type MeetingSource = "MANUAL" | "GOOGLE_MEET";

export const SORT_MODES = [
  "SMART",
  "PRIORITY",
  "DUE_DATE",
  "STATUS",
  "CREATED_AT",
  "UPDATED_AT",
  "ALPHABETICAL",
  "MANUAL",
] as const;
export type SortMode = (typeof SORT_MODES)[number];

export type RecommendationKind =
  | "UNBLOCK_DEPENDENCY"
  | "REQUEST_ACCESS"
  | "CLARIFY_DEADLINE"
  | "HIGH_IMPACT_BLOCKER"
  | "POSSIBLE_DUPLICATE"
  | "STALE_TASK"
  | "OVERDUE_CLUSTER"
  | "AWAITING_OTHER_PERSON";

export type ActivityType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_OWNER_CHANGED"
  | "TASK_PRIORITY_CHANGED"
  | "TASK_DUE_DATE_CHANGED"
  | "TASK_COMPLETED"
  | "TASK_REOPENED"
  | "TASK_DELETED"
  | "TASK_COMMENTED"
  | "MEETING_CREATED"
  | "MEETING_UPDATED"
  | "TRANSCRIPT_READY"
  | "TRANSCRIPT_FAILED"
  | "ANALYSIS_COMPLETED"
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_REJECTED"
  | "MEMBER_JOINED"
  | "KNOWLEDGE_CREATED"
  | "KNOWLEDGE_UPDATED"
  | "KNOWLEDGE_DELETED";

// ---------------------------------------------------------------------------
// View models — the exact shapes the UI consumes.
// ---------------------------------------------------------------------------

export type MemberSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: WorkspaceRole;
  jobTitle: string | null;
  accentToken: string;
};

export type TaskDependencyRef = {
  id: string;
  title: string;
  status: TaskStatus;
};

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  owner: MemberSummary | null;
  creator: MemberSummary | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  labels: string[];
  /** ISO string, or null. Serialised for the client boundary. */
  dueDate: string | null;
  estimateMinutes: number | null;
  aiSuggestedPriority: TaskPriority | null;
  aiPriorityRationale: string | null;
  isAiGenerated: boolean;
  confirmedByHuman: boolean;
  needsReview: boolean;
  sourceMeeting: { id: string; title: string } | null;
  sourceExcerpt: string | null;
  manualOrder: number | null;
  /** Tasks this one is waiting on. */
  dependencies: TaskDependencyRef[];
  /** Tasks waiting on this one. */
  dependents: TaskDependencyRef[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type MeetingView = {
  id: string;
  title: string;
  source: MeetingSource;
  status: MeetingStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  meetUrl: string | null;
  notes: string | null;
  createdBy: MemberSummary | null;
  participants: { id: string; displayName: string; email: string | null; member: MemberSummary | null }[];
  transcript: {
    status: TranscriptStatus;
    fetchedAt: string | null;
    failureReason: string | null;
    hasContent: boolean;
  } | null;
  analysis: {
    status: AnalysisStatus;
    summary: string | null;
    isSample: boolean;
  } | null;
  taskCount: number;
  pendingProposalCount: number;
  createdAt: string;
};

export type DecisionEntry = { text: string; evidence: EvidenceLevel; excerpt?: string | null };
export type OpenQuestionEntry = { text: string; excerpt?: string | null };

export type ProposalView = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  title: string;
  description: string | null;
  suggestedOwner: MemberSummary | null;
  ownerEvidence: EvidenceLevel;
  ownerRationale: string | null;
  isExplicitCommitment: boolean;
  suggestedPriority: TaskPriority;
  priorityEvidence: EvidenceLevel;
  priorityRationale: string | null;
  suggestedDueDate: string | null;
  dueDateEvidence: EvidenceLevel;
  category: TaskCategory;
  labels: string[];
  transcriptExcerpt: string | null;
  blockers: string[];
  dependsOnTitles: string[];
  status: ProposalStatus;
  needsReview: boolean;
  isSample: boolean;
  createdTaskId: string | null;
  createdAt: string;
};

export type AnalysisView = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string | null;
  status: AnalysisStatus;
  summary: string | null;
  decisions: DecisionEntry[];
  openQuestions: OpenQuestionEntry[];
  model: string | null;
  failureReason: string | null;
  isSample: boolean;
  transcriptStatus: TranscriptStatus;
  proposals: ProposalView[];
};

export type RecommendationView = {
  id: string;
  kind: RecommendationKind;
  title: string;
  body: string;
  relatedTaskIds: string[];
  evidence: EvidenceLevel;
  isDeterministic: boolean;
  createdAt: string;
};

export type ActivityView = {
  id: string;
  type: ActivityType;
  summary: string;
  actor: MemberSummary | null;
  taskId: string | null;
  meetingId: string | null;
  knowledgeDocId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

/**
 * A page in the knowledge library, as the list shows it.
 *
 * The body is deliberately absent: a library of a hundred pages would
 * otherwise ship every word of every one of them to render a list. The
 * excerpt and the counts are derived on the server instead.
 */
export type KnowledgeDocSummary = {
  id: string;
  title: string;
  /** First couple of lines, with the Markdown stripped out. */
  excerpt: string;
  labels: string[];
  isPinned: boolean;
  words: number;
  images: number;
  updatedBy: MemberSummary | null;
  createdAt: string;
  updatedAt: string;
};

/** One page, opened. */
export type KnowledgeDocView = KnowledgeDocSummary & {
  body: string | null;
  createdBy: MemberSummary | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  members: MemberSummary[];
};

export type SessionContext = {
  userId: string;
  workspace: WorkspaceSummary;
  /** The signed-in person's membership in the active workspace. */
  member: MemberSummary;
};
