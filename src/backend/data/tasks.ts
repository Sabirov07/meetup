import "server-only";

import { db } from "@/backend/db";
import { toMemberSummary } from "@/backend/auth/guards";
import type { CommentKind, TaskView } from "@/shared/domain/types";
import type { Advice } from "@/shared/domain/sketch";

/**
 * Reads for the task surfaces.
 *
 * Every function takes `workspaceId` and filters on it. That argument must
 * always come from `requireSession()` — see the note in `auth/guards.ts` about
 * why the database's RLS policies do not constrain these queries.
 */

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  user: { select: { id: true, name: true, email: true, accentToken: true } },
} as const;

const spaceSelect = { id: true, name: true, colorToken: true } as const;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  labels: true,
  dueDate: true,
  estimateMinutes: true,
  aiSuggestedPriority: true,
  aiPriorityRationale: true,
  isAiGenerated: true,
  confirmedByHuman: true,
  needsReview: true,
  sourceExcerpt: true,
  manualOrder: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  space: { select: spaceSelect },
  owner: { select: memberSelect },
  assignees: {
    select: { member: { select: memberSelect } },
    orderBy: { createdAt: "asc" },
  },
  creator: { select: memberSelect },
  sourceMeeting: { select: { id: true, title: true } },
  dependencies: {
    select: { dependsOnTask: { select: { id: true, title: true, status: true } } },
  },
  dependents: {
    select: { task: { select: { id: true, title: true, status: true } } },
  },
  subtasks: {
    select: {
      id: true,
      title: true,
      done: true,
      position: true,
      assignee: { select: memberSelect },
    },
    // Positions are assigned strictly increasing, within a batch and across
    // batches, so this one key is the order the list was written in.
    orderBy: { position: "asc" },
  },
  _count: { select: { comments: true } },
} as const;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskView["status"];
  priority: TaskView["priority"];
  category: TaskView["category"];
  labels: string[];
  dueDate: Date | null;
  estimateMinutes: number | null;
  aiSuggestedPriority: TaskView["priority"] | null;
  aiPriorityRationale: string | null;
  isAiGenerated: boolean;
  confirmedByHuman: boolean;
  needsReview: boolean;
  sourceExcerpt: string | null;
  manualOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  space: { id: string; name: string; colorToken: string } | null;
  owner: Parameters<typeof toMemberSummary>[0] | null;
  assignees: { member: Parameters<typeof toMemberSummary>[0] }[];
  creator: Parameters<typeof toMemberSummary>[0] | null;
  sourceMeeting: { id: string; title: string } | null;
  dependencies: { dependsOnTask: { id: string; title: string; status: TaskView["status"] } }[];
  dependents: { task: { id: string; title: string; status: TaskView["status"] } }[];
  subtasks: {
    id: string;
    title: string;
    done: boolean;
    position: number;
    assignee: Parameters<typeof toMemberSummary>[0] | null;
  }[];
  _count: { comments: number };
};

/** Dates become ISO strings here so the row can cross the client boundary. */
export function toTaskView(row: TaskRow): TaskView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    space: row.space,
    owner: row.owner ? toMemberSummary(row.owner) : null,
    assignees: row.assignees
      .map((a) => toMemberSummary(a.member))
      .filter((m) => m.id !== row.owner?.id),
    creator: row.creator ? toMemberSummary(row.creator) : null,
    status: row.status,
    priority: row.priority,
    category: row.category,
    labels: row.labels,
    dueDate: row.dueDate?.toISOString() ?? null,
    estimateMinutes: row.estimateMinutes,
    aiSuggestedPriority: row.aiSuggestedPriority,
    aiPriorityRationale: row.aiPriorityRationale,
    isAiGenerated: row.isAiGenerated,
    confirmedByHuman: row.confirmedByHuman,
    needsReview: row.needsReview,
    sourceMeeting: row.sourceMeeting,
    sourceExcerpt: row.sourceExcerpt,
    manualOrder: row.manualOrder,
    dependencies: row.dependencies.map((d) => d.dependsOnTask),
    dependents: row.dependents.map((d) => d.task),
    subtasks: row.subtasks.map((subtask) => ({
      ...subtask,
      assignee: subtask.assignee ? toMemberSummary(subtask.assignee) : null,
    })),
    commentCount: row._count.comments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/**
 * Every task in the workspace.
 *
 * Filtering, sorting and the KPI numbers all run on the client against this
 * one list. For a two-person workspace that is the right trade: a single
 * round-trip, instant filter interactions, and statistics that cannot drift
 * out of step with the rows on screen. If a workspace ever grows past a few
 * thousand tasks, this is the function to paginate.
 */
export async function listTasks(workspaceId: string): Promise<TaskView[]> {
  const rows = await db.task.findMany({
    where: { workspaceId },
    select: taskSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toTaskView);
}

export async function getTask(taskId: string, workspaceId: string): Promise<TaskView | null> {
  const row = await db.task.findFirst({
    where: { id: taskId, workspaceId },
    select: taskSelect,
  });
  return row ? toTaskView(row) : null;
}

/** One message in a task's discussion, as the drawer renders it. */
export type CommentView = {
  id: string;
  kind: CommentKind;
  body: string;
  author: { id: string; name: string; initials: string; accentToken: string } | null;
  /** Members called in by name, in the order they were mentioned. */
  mentionedMemberIds: string[];
  mentionsAi: boolean;
  /** The message this one answers, for an assistant reply. */
  answersId: string | null;
  /** The structured half of an assistant reply: advice and the sketch. */
  advice: Advice | null;
  model: string | null;
  createdAt: string;
};

const commentSelect = {
  id: true,
  kind: true,
  body: true,
  mentionedMemberIds: true,
  mentionsAi: true,
  answersId: true,
  advice: true,
  model: true,
  createdAt: true,
  author: { select: memberSelect },
} as const;

type CommentRow = {
  id: string;
  kind: CommentKind;
  body: string;
  mentionedMemberIds: string[];
  mentionsAi: boolean;
  answersId: string | null;
  advice: unknown;
  model: string | null;
  createdAt: Date;
  author: Parameters<typeof toMemberSummary>[0] | null;
};

function toCommentView(row: CommentRow): CommentView {
  const author = row.author ? toMemberSummary(row.author) : null;
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    author: author
      ? {
          id: author.id,
          name: author.name,
          initials: author.initials,
          accentToken: author.accentToken,
        }
      : null,
    mentionedMemberIds: row.mentionedMemberIds,
    mentionsAi: row.mentionsAi,
    answersId: row.answersId,
    // Written by this app from a schema-validated model response, so it is
    // cast rather than re-parsed. The renderer still reads it defensively,
    // because a row written by an older shape of that schema outlives it.
    advice: (row.advice as Advice | null) ?? null,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The whole thread, oldest first — it is read as a conversation. */
export async function listComments(taskId: string, workspaceId: string): Promise<CommentView[]> {
  const rows = await db.taskComment.findMany({
    where: { taskId, task: { workspaceId } },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });

  return rows.map(toCommentView);
}

/**
 * One message, confirmed to be on a task in this workspace.
 *
 * The workspace filter goes through the task rather than sitting on the
 * comment, because `task_comments` carries no workspace of its own — the task
 * is what it belongs to, and that is the only tenancy there is to check.
 */
export async function getComment(
  commentId: string,
  workspaceId: string,
): Promise<CommentView | null> {
  const row = await db.taskComment.findFirst({
    where: { id: commentId, task: { workspaceId } },
    select: commentSelect,
  });
  return row ? toCommentView(row) : null;
}

/** Id + title pairs for the dependency picker. */
export async function listTaskOptions(
  workspaceId: string,
  excludeId?: string,
): Promise<{ id: string; title: string; status: TaskView["status"] }[]> {
  return db.task.findMany({
    where: { workspaceId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

/** Recommendation ids the workspace has dismissed. */
export async function listDismissedRecommendationIds(workspaceId: string): Promise<Set<string>> {
  const rows = await db.recommendation.findMany({
    where: { workspaceId, status: { in: ["DISMISSED", "RESOLVED"] } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
