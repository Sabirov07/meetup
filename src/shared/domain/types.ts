/**
 * Domain model. Deliberately free of any Prisma / database import so that
 * client components can use these types and label maps without pulling the
 * generated client into the browser bundle.
 *
 * The string values match the Prisma enum values exactly, so translating at
 * the data-access boundary is an identity cast rather than a lookup table.
 */

import type { FlowchartDocument } from "./flowchart";

/**
 * The key of a workspace's status definition. Four keys are built in — TODO,
 * IN_PROGRESS, BLOCKED, COMPLETED — and a workspace may add more, so this is
 * a string rather than a union. See `statuses.ts` for the rules.
 */
export type TaskStatus = string;

/** One stage of a workspace's flow, in the order it is shown. */
export type TaskStatusDef = {
  id: string;
  key: TaskStatus;
  /** Empty for a built-in, which is translated from its key. */
  label: string;
  /** A `--tone-*` token name: neutral, accent, info, warning, success, danger. */
  tone: string;
  position: number;
  builtin: boolean;
};

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

/** Who wrote a message in a task discussion. */
export const COMMENT_KINDS = ["MESSAGE", "AI_ANSWER"] as const;
export type CommentKind = (typeof COMMENT_KINDS)[number];

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
export const WORKSPACE_ROLES = ["ADMINISTRATOR", "MEMBER"] as const;
export type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";
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
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_REMOVED"
  | "MEMBER_LEFT"
  | "KNOWLEDGE_CREATED"
  | "KNOWLEDGE_UPDATED"
  | "KNOWLEDGE_DELETED"
  | "SPACE_CREATED"
  | "SPACE_UPDATED"
  | "SPACE_DELETED";

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

/**
 * A section of the workspace, as a task carries it: enough to draw a dot and
 * a name without a second lookup.
 */
export type SpaceRef = {
  id: string;
  name: string;
  colorToken: string;
};

/** A section in the sidebar and on the sections page, with its workload. */
export type SpaceSummary = SpaceRef & {
  description: string | null;
  position: number;
  /** Not-completed tasks filed here. */
  openTasks: number;
  totalTasks: number;
};

/**
 * The filter value, and the route segment, for tasks that belong to no
 * section. A real space id is a cuid, so it can never collide with this.
 */
export const NO_SPACE = "none";

export type TaskDependencyRef = {
  id: string;
  title: string;
  status: TaskStatus;
};

/**
 * One step on a task's checklist.
 *
 * A step is not a task — see the note on `Subtask` in schema.prisma — so this
 * carries a title and whether it is ticked, and nothing else.
 */
export type SubtaskRef = {
  id: string;
  title: string;
  done: boolean;
  position: number;
  /** Who is doing this step, or null when it is simply the task owner's. */
  assignee: MemberSummary | null;
};

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  /** Which section it is filed under, or null for "No section". */
  space: SpaceRef | null;
  owner: MemberSummary | null;
  /**
   * Everyone else on the task beside the owner, in the order they were added.
   * Never contains the owner. `peopleOn()` gives the full list.
   */
  assignees: MemberSummary[];
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
  /** The task's checklist, in the order it is worked down. */
  subtasks: SubtaskRef[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/**
 * One task the model drafted from a pasted brief, before anybody has agreed
 * to it.
 *
 * Drafts deliberately have no database row. A transcript proposal is worth
 * storing because the transcript outlives the conversation and someone may
 * come back to it days later; a brief someone just pasted is reviewed in the
 * same breath, and a table of abandoned drafts would be a graveyard. So these
 * live in the dialog's state, are edited there, and are written straight to
 * `tasks` on confirm — or discarded with the dialog.
 *
 * `key` is a client-side identity for list keys and edits, not an id.
 */
export type TaskDraft = {
  key: string;
  title: string;
  description: string | null;
  ownerMemberId: string | null;
  priority: TaskPriority;
  category: TaskCategory;
  labels: string[];
  /** `yyyy-MM-dd`, the shape a date input wants, or null. */
  dueDate: string | null;
  estimateMinutes: number | null;
  /** How much of the owner choice came from the brief rather than the model. */
  ownerEvidence: EvidenceLevel;
  ownerRationale: string | null;
  priorityRationale: string | null;
  /** Verbatim quote from the brief that this task came from. */
  sourceExcerpt: string | null;
  /** The one thing a person has to settle first, when there is one. */
  openQuestion: string | null;
  needsReview: boolean;
};

/** A whole brief, read. */
export type TaskBreakdown = {
  /** What the model understood the brief to be asking for. */
  summary: string;
  drafts: TaskDraft[];
  /** Parts of the brief it deliberately did not turn into work. */
  leftovers: string[];
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

/** One flowchart in the list. The diagram itself is not sent to the list. */
export type FlowchartSummary = {
  id: string;
  title: string;
  description: string | null;
  nodes: number;
  edges: number;
  updatedBy: MemberSummary | null;
  createdAt: string;
  updatedAt: string;
};

/** One flowchart, opened on the canvas. */
export type FlowchartView = FlowchartSummary & {
  document: FlowchartDocument;
  createdBy: MemberSummary | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  members: MemberSummary[];
};

/**
 * One workspace in the switcher. Deliberately not a `WorkspaceSummary`: the
 * switcher is drawn on every page, and shipping every member of every
 * workspace a person belongs to in order to label a menu item would be absurd.
 */
export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberCount: number;
  isActive: boolean;
  /** Their main workspace: where a session with nothing to resume lands. */
  isPrimary: boolean;
};

/** A member as the Team page shows them: the person, plus their workload. */
export type TeamMember = MemberSummary & {
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  joinedAt: string;
};

/** A pending invitation, with the link ready to copy. */
export type InviteView = {
  id: string;
  /** Absolute `/join/<token>` URL. Only ever sent to an administrator. */
  link: string;
  /** Null for a link anyone may use. */
  email: string | null;
  role: WorkspaceRole;
  jobTitle: string | null;
  invitedBy: MemberSummary | null;
  expiresAt: string;
  createdAt: string;
};

/** Everything the Team page renders. */
export type TeamView = {
  members: TeamMember[];
  /** Pending invites only, and only when the viewer may manage them. */
  invites: InviteView[];
  /** Unowned open tasks — the backlog nobody has picked up. */
  unassignedTasks: number;
};

export type SessionContext = {
  userId: string;
  workspace: WorkspaceSummary;
  /** The signed-in person's membership in the active workspace. */
  member: MemberSummary;
};
