import "server-only";

import { db } from "@/backend/db";
import { toMemberSummary } from "@/backend/auth/guards";
import type { TaskView } from "@/shared/domain/types";

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
  owner: { select: memberSelect },
  creator: { select: memberSelect },
  sourceMeeting: { select: { id: true, title: true } },
  dependencies: {
    select: { dependsOnTask: { select: { id: true, title: true, status: true } } },
  },
  dependents: {
    select: { task: { select: { id: true, title: true, status: true } } },
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
  owner: Parameters<typeof toMemberSummary>[0] | null;
  creator: Parameters<typeof toMemberSummary>[0] | null;
  sourceMeeting: { id: string; title: string } | null;
  dependencies: { dependsOnTask: { id: string; title: string; status: TaskView["status"] } }[];
  dependents: { task: { id: string; title: string; status: TaskView["status"] } }[];
  _count: { comments: number };
};

/** Dates become ISO strings here so the row can cross the client boundary. */
export function toTaskView(row: TaskRow): TaskView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    owner: row.owner ? toMemberSummary(row.owner) : null,
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

export type CommentView = {
  id: string;
  body: string;
  author: { id: string; name: string; initials: string; accentToken: string } | null;
  createdAt: string;
};

export async function listComments(taskId: string, workspaceId: string): Promise<CommentView[]> {
  const rows = await db.taskComment.findMany({
    where: { taskId, task: { workspaceId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: memberSelect },
    },
  });

  return rows.map((row) => {
    const author = row.author ? toMemberSummary(row.author) : null;
    return {
      id: row.id,
      body: row.body,
      author: author
        ? {
            id: author.id,
            name: author.name,
            initials: author.initials,
            accentToken: author.accentToken,
          }
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  });
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
