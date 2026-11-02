import type {
  ActivityType,
  EvidenceLevel,
  MeetingStatus,
  RecommendationKind,
  SortMode,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  TranscriptStatus,
} from "./types";

/**
 * Presentation metadata for every enum in the domain.
 *
 * Colours are referenced as semantic token class names defined in globals.css
 * (`--tone-*`), never as raw hex values scattered through components.
 */

export const statusMeta: Record<
  TaskStatus,
  { label: string; short: string; tone: string; dot: string }
> = {
  TODO: { label: "To do", short: "To do", tone: "tone-neutral", dot: "bg-[--tone-neutral-fg]" },
  IN_PROGRESS: {
    label: "In progress",
    short: "Active",
    tone: "tone-accent",
    dot: "bg-[--tone-accent-fg]",
  },
  BLOCKED: {
    label: "Waiting / Blocked",
    short: "Waiting",
    tone: "tone-warning",
    dot: "bg-[--tone-warning-fg]",
  },
  COMPLETED: {
    label: "Completed",
    short: "Done",
    tone: "tone-success",
    dot: "bg-[--tone-success-fg]",
  },
};

export const priorityMeta: Record<
  TaskPriority,
  { label: string; tone: string; rank: number }
> = {
  URGENT: { label: "Urgent", tone: "tone-danger", rank: 0 },
  HIGH: { label: "High", tone: "tone-warning", rank: 1 },
  MEDIUM: { label: "Medium", tone: "tone-info", rank: 2 },
  LOW: { label: "Low", tone: "tone-neutral", rank: 3 },
};

export const categoryMeta: Record<TaskCategory, { label: string }> = {
  DEVELOPMENT: { label: "Development" },
  AI_AUTOMATION: { label: "AI & Automation" },
  INFRASTRUCTURE: { label: "Infrastructure & DevOps" },
  RESEARCH: { label: "Research" },
  BUSINESS_OPS: { label: "Business Operations" },
  FINANCE: { label: "Finance & Payments" },
  COMMUNICATION: { label: "Communication" },
  ADMINISTRATION: { label: "Administration" },
  PLANNING: { label: "Planning" },
  REVIEW_APPROVAL: { label: "Review & Approval" },
  GENERAL: { label: "General" },
};

export const evidenceMeta: Record<
  EvidenceLevel,
  { label: string; tone: string; description: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    tone: "tone-success",
    description: "Stated explicitly in the conversation, or set by a person.",
  },
  INFERRED: {
    label: "Inferred",
    tone: "tone-info",
    description: "Read from surrounding context — worth a glance before approving.",
  },
  RECOMMENDED: {
    label: "Suggested",
    tone: "tone-neutral",
    description: "Not stated in the conversation. This is the model's suggestion.",
  },
};

export const meetingStatusMeta: Record<
  MeetingStatus,
  { label: string; tone: string; description: string }
> = {
  SCHEDULED: { label: "Scheduled", tone: "tone-neutral", description: "Not started yet." },
  READY_TO_JOIN: { label: "Ready to join", tone: "tone-info", description: "Starting soon." },
  IN_PROGRESS: { label: "In progress", tone: "tone-accent", description: "Happening now." },
  AWAITING_TRANSCRIPT: {
    label: "Awaiting transcript",
    tone: "tone-warning",
    description: "Meeting ended. Google may still be generating the transcript.",
  },
  PROCESSING: {
    label: "Processing",
    tone: "tone-accent",
    description: "Analysing the transcript.",
  },
  REVIEW_REQUIRED: {
    label: "Review required",
    tone: "tone-warning",
    description: "Proposed tasks are waiting for your approval.",
  },
  COMPLETED: { label: "Completed", tone: "tone-success", description: "Fully processed." },
  FAILED: { label: "Failed", tone: "tone-danger", description: "Something went wrong." },
};

export const transcriptStatusMeta: Record<
  TranscriptStatus,
  { label: string; tone: string; detail: string }
> = {
  NOT_REQUESTED: {
    label: "Not requested",
    tone: "tone-neutral",
    detail: "No transcript has been requested for this meeting.",
  },
  AWAITING: {
    label: "Awaiting transcript",
    tone: "tone-warning",
    detail: "Google Meet transcripts are not available the instant a call ends.",
  },
  FETCHING: { label: "Fetching", tone: "tone-accent", detail: "Retrieving the transcript." },
  READY: { label: "Transcript ready", tone: "tone-success", detail: "Transcript stored." },
  UNAVAILABLE: {
    label: "Unavailable",
    tone: "tone-neutral",
    detail:
      "No transcript exists. Meet only produces one when transcription is switched on and the organiser is on a Google Workspace plan.",
  },
  FAILED: { label: "Retrieval failed", tone: "tone-danger", detail: "Retrieval failed." },
};

export const sortModeMeta: Record<SortMode, { label: string; description: string }> = {
  SMART: {
    label: "Smart priority",
    description: "Priority, weighted by deadlines, blocking impact and status.",
  },
  PRIORITY: { label: "Priority", description: "Urgent first." },
  DUE_DATE: { label: "Due date", description: "Soonest deadline first." },
  STATUS: { label: "Status", description: "Grouped by workflow stage." },
  CREATED_AT: { label: "Newest", description: "Most recently created first." },
  UPDATED_AT: { label: "Recently updated", description: "Most recently touched first." },
  ALPHABETICAL: { label: "A–Z", description: "By title." },
  MANUAL: { label: "Manual order", description: "The order you arranged by hand." },
};

export const recommendationMeta: Record<
  RecommendationKind,
  { label: string; tone: string }
> = {
  UNBLOCK_DEPENDENCY: { label: "Dependency", tone: "tone-info" },
  REQUEST_ACCESS: { label: "Access needed", tone: "tone-warning" },
  CLARIFY_DEADLINE: { label: "Unclear deadline", tone: "tone-neutral" },
  HIGH_IMPACT_BLOCKER: { label: "High impact", tone: "tone-danger" },
  POSSIBLE_DUPLICATE: { label: "Possible duplicate", tone: "tone-neutral" },
  STALE_TASK: { label: "Going stale", tone: "tone-neutral" },
  OVERDUE_CLUSTER: { label: "Overdue", tone: "tone-danger" },
  AWAITING_OTHER_PERSON: { label: "Waiting on someone", tone: "tone-warning" },
};

export const activityMeta: Record<ActivityType, { label: string; tone: string }> = {
  TASK_CREATED: { label: "created", tone: "tone-accent" },
  TASK_UPDATED: { label: "updated", tone: "tone-neutral" },
  TASK_STATUS_CHANGED: { label: "moved", tone: "tone-info" },
  TASK_OWNER_CHANGED: { label: "reassigned", tone: "tone-info" },
  TASK_PRIORITY_CHANGED: { label: "reprioritised", tone: "tone-warning" },
  TASK_DUE_DATE_CHANGED: { label: "rescheduled", tone: "tone-warning" },
  TASK_COMPLETED: { label: "completed", tone: "tone-success" },
  TASK_REOPENED: { label: "reopened", tone: "tone-warning" },
  TASK_DELETED: { label: "deleted", tone: "tone-danger" },
  TASK_COMMENTED: { label: "commented", tone: "tone-neutral" },
  MEETING_CREATED: { label: "scheduled a meeting", tone: "tone-accent" },
  MEETING_UPDATED: { label: "updated a meeting", tone: "tone-neutral" },
  TRANSCRIPT_READY: { label: "transcript ready", tone: "tone-success" },
  TRANSCRIPT_FAILED: { label: "transcript failed", tone: "tone-danger" },
  ANALYSIS_COMPLETED: { label: "analysis complete", tone: "tone-accent" },
  PROPOSAL_APPROVED: { label: "approved a proposal", tone: "tone-success" },
  PROPOSAL_REJECTED: { label: "rejected a proposal", tone: "tone-neutral" },
  MEMBER_INVITED: { label: "invited", tone: "tone-info" },
  MEMBER_JOINED: { label: "joined", tone: "tone-accent" },
  MEMBER_ROLE_CHANGED: { label: "role changed", tone: "tone-info" },
  MEMBER_REMOVED: { label: "removed", tone: "tone-danger" },
  MEMBER_LEFT: { label: "left", tone: "tone-neutral" },
  KNOWLEDGE_CREATED: { label: "added a page", tone: "tone-accent" },
  KNOWLEDGE_UPDATED: { label: "edited a page", tone: "tone-neutral" },
  KNOWLEDGE_DELETED: { label: "deleted a page", tone: "tone-danger" },
};

/** Initials for an avatar, from a display name. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
