"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import {
  assertMemberInWorkspace,
  assertTaskInWorkspace,
  requireSessionForAction,
} from "@/backend/auth/guards";
import { getTask, listComments, type CommentView } from "@/backend/data/tasks";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskView,
} from "@/shared/domain/types";
import { priorityMeta, statusMeta } from "@/shared/domain/labels";
import { message } from "@/backend/i18n/message";
import type { TranslationKey } from "@/shared/i18n";
import {
  fail,
  guarded,
  logActivity,
  ok,
  parseDateInput,
  type ActionResult,
} from "./shared";

/**
 * One definition of each field, with no defaults attached, so the create and
 * update schemas can disagree about what a missing key means.
 */
const taskFields = {
  title: z.string().trim().min(3, "errors.task.titleTooShort").max(200),
  /**
   * The task's document body, in Markdown. The ceiling is generous because
   * this is a document, not a summary field — several screens of brief with
   * embedded image references stays well inside it.
   */
  description: z
    .string()
    .trim()
    .max(50_000, "errors.task.docTooLong")
    .nullable(),
  ownerMemberId: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  category: z.enum(TASK_CATEGORIES),
  labels: z.array(z.string().trim().min(1).max(40)).max(10),
  dueDate: z.string().nullable(),
  estimateMinutes: z.number().int().positive().max(100_000).nullable(),
  sourceMeetingId: z.string().nullable(),
};

/** A new task: the omitted fields fall back to the defaults below. */
const taskInput = z.object({
  title: taskFields.title,
  description: taskFields.description.optional(),
  ownerMemberId: taskFields.ownerMemberId.optional(),
  status: taskFields.status.default("TODO"),
  priority: taskFields.priority.default("MEDIUM"),
  category: taskFields.category.default("GENERAL"),
  labels: taskFields.labels.default([]),
  dueDate: taskFields.dueDate.optional(),
  estimateMinutes: taskFields.estimateMinutes.optional(),
  sourceMeetingId: taskFields.sourceMeetingId.optional(),
});

export type TaskInput = z.input<typeof taskInput>;

export async function createTask(raw: TaskInput): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = taskInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issue(parsed.error.issues[0]?.message, "errors.task.invalid"));
    }
    const input = parsed.data;

    if (input.ownerMemberId) {
      await assertMemberInWorkspace(input.ownerMemberId, session.workspace.id);
    }

    const created = await db.task.create({
      data: {
        workspaceId: session.workspace.id,
        title: input.title,
        description: input.description ?? null,
        ownerMemberId: input.ownerMemberId ?? null,
        creatorMemberId: session.member.id,
        status: input.status,
        priority: input.priority,
        category: input.category,
        labels: input.labels,
        dueDate: parseDateInput(input.dueDate),
        estimateMinutes: input.estimateMinutes ?? null,
        sourceMeetingId: input.sourceMeetingId ?? null,
        // Created by a person, so it is a confirmed commitment from the start.
        confirmedByHuman: true,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      },
      select: { id: true },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_CREATED",
      summary: `created “${input.title}”`,
      taskId: created.id,
    });

    const task = await getTask(created.id, session.workspace.id);
    if (!task) return fail(await message("errors.task.createdNotReadable"));
    refresh();
    return ok(task);
  });
}

/**
 * A change to an existing task, where an absent key means "leave it alone".
 *
 * Built from `taskFields` rather than `taskInput.partial()` on purpose:
 * `partial()` keeps a field's `.default()`, so parsing `{ id, description }`
 * returns status TODO, priority MEDIUM, category GENERAL and an empty label
 * set as well — and this action writes every key it is given. Saving a
 * description would quietly reset four other fields.
 */
const updateInput = z.object({
  id: z.string().min(1),
  title: taskFields.title.optional(),
  description: taskFields.description.optional(),
  ownerMemberId: taskFields.ownerMemberId.optional(),
  status: taskFields.status.optional(),
  priority: taskFields.priority.optional(),
  category: taskFields.category.optional(),
  labels: taskFields.labels.optional(),
  dueDate: taskFields.dueDate.optional(),
  estimateMinutes: taskFields.estimateMinutes.optional(),
  sourceMeetingId: taskFields.sourceMeetingId.optional(),
});

export type TaskUpdateInput = z.input<typeof updateInput>;

/**
 * Partial update. Only the fields present in the payload are written, so the
 * detail drawer can save one control at a time without clobbering the rest.
 */
export async function updateTask(raw: TaskUpdateInput): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = updateInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issue(parsed.error.issues[0]?.message, "errors.task.changeInvalid"));
    }
    const { id, ...changes } = parsed.data;
    const before = await assertTaskInWorkspace(id, session.workspace.id);

    if (changes.ownerMemberId) {
      await assertMemberInWorkspace(changes.ownerMemberId, session.workspace.id);
    }

    const data: Record<string, unknown> = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.ownerMemberId !== undefined) data.ownerMemberId = changes.ownerMemberId;
    if (changes.priority !== undefined) data.priority = changes.priority;
    if (changes.category !== undefined) data.category = changes.category;
    if (changes.labels !== undefined) data.labels = changes.labels;
    if (changes.estimateMinutes !== undefined) data.estimateMinutes = changes.estimateMinutes;
    if (changes.dueDate !== undefined) data.dueDate = parseDateInput(changes.dueDate);
    if (changes.status !== undefined) {
      data.status = changes.status;
      data.completedAt =
        changes.status === "COMPLETED"
          ? (before.status === "COMPLETED" ? undefined : new Date())
          : null;
    }

    if (Object.keys(data).length === 0) {
      const unchanged = await getTask(id, session.workspace.id);
      return unchanged ? ok(unchanged) : fail(await message("errors.task.goneShort"));
    }

    // A person touched this task, so it is now a confirmed commitment and
    // re-analysis must not silently change it. Clearing needsReview here is
    // deliberate: the review has just happened.
    data.confirmedByHuman = true;
    data.needsReview = false;

    await db.task.update({ where: { id }, data });

    // One activity entry per meaningful field, so the feed reads as history
    // rather than a stream of "updated".
    const entries: { type: Parameters<typeof logActivity>[0]["type"]; summary: string; meta?: Record<string, unknown> }[] = [];

    if (changes.status !== undefined && changes.status !== before.status) {
      if (changes.status === "COMPLETED") {
        entries.push({ type: "TASK_COMPLETED", summary: `completed “${before.title}”` });
      } else if (before.status === "COMPLETED") {
        entries.push({
          type: "TASK_REOPENED",
          summary: `reopened “${before.title}” as ${statusMeta[changes.status].label}`,
        });
      } else {
        entries.push({
          type: "TASK_STATUS_CHANGED",
          summary: `moved “${before.title}” to ${statusMeta[changes.status].label}`,
          meta: { field: "status", from: before.status, to: changes.status },
        });
      }
    }

    if (changes.priority !== undefined && changes.priority !== before.priority) {
      entries.push({
        type: "TASK_PRIORITY_CHANGED",
        summary: `set “${before.title}” to ${priorityMeta[changes.priority].label} priority`,
        meta: { field: "priority", from: before.priority, to: changes.priority },
      });
    }

    if (changes.ownerMemberId !== undefined && changes.ownerMemberId !== before.ownerMemberId) {
      const name = changes.ownerMemberId
        ? (await assertMemberInWorkspace(changes.ownerMemberId, session.workspace.id)).user.name
        : null;
      entries.push({
        type: "TASK_OWNER_CHANGED",
        summary: name
          ? `reassigned “${before.title}” to ${name}`
          : `unassigned “${before.title}”`,
        meta: { field: "owner", from: before.ownerMemberId, to: changes.ownerMemberId },
      });
    }

    if (changes.dueDate !== undefined) {
      const next = parseDateInput(changes.dueDate);
      const changed = (before.dueDate?.getTime() ?? null) !== (next?.getTime() ?? null);
      if (changed) {
        entries.push({
          type: "TASK_DUE_DATE_CHANGED",
          summary: next
            ? `moved “${before.title}” to ${next.toISOString().slice(0, 10)}`
            : `removed the deadline on “${before.title}”`,
          meta: { field: "dueDate", to: next?.toISOString() ?? null },
        });
      }
    }

    if (entries.length === 0) {
      entries.push({ type: "TASK_UPDATED", summary: `updated “${before.title}”` });
    }

    for (const entry of entries) {
      await logActivity({
        workspaceId: session.workspace.id,
        actorMemberId: session.member.id,
        type: entry.type,
        summary: entry.summary,
        taskId: id,
        metadata: entry.meta,
      });
    }

    const task = await getTask(id, session.workspace.id);
    if (!task) return fail(await message("errors.task.goneShort"));
    refresh();
    return ok(task);
  });
}

/**
 * Status and/or owner change from a drag.
 *
 * Moving a task between owner panels reassigns it — it never creates a copy.
 */
export async function moveTask(input: {
  id: string;
  status?: (typeof TASK_STATUSES)[number];
  ownerMemberId?: string | null;
}): Promise<ActionResult<TaskView>> {
  return updateTask({
    id: input.id,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.ownerMemberId !== undefined ? { ownerMemberId: input.ownerMemberId } : {}),
  });
}

/** Persists a hand-arranged order. */
export async function reorderTasks(
  orderedIds: string[],
): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = z.array(z.string().min(1)).max(500).safeParse(orderedIds);
    if (!parsed.success) return fail(await message("errors.task.orderInvalid"));

    const owned = await db.task.findMany({
      where: { id: { in: parsed.data }, workspaceId: session.workspace.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((t) => t.id));

    await db.$transaction(
      parsed.data
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          db.task.update({ where: { id }, data: { manualOrder: (index + 1) * 100 } }),
        ),
    );

    return ok(undefined);
  });
}

export async function deleteTask(id: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const before = await assertTaskInWorkspace(id, session.workspace.id);

    await db.task.delete({ where: { id } });

    // taskId is intentionally omitted: the row is gone and the FK cascades.
    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_DELETED",
      summary: `deleted “${before.title}”`,
    });

    refresh();
    return ok(undefined);
  });
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

/** Rejects self-links and cycles, which would deadlock the priority engine. */
export async function addDependency(input: {
  taskId: string;
  dependsOnTaskId: string;
}): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    if (input.taskId === input.dependsOnTaskId) {
      return fail(await message("errors.task.selfDependency"));
    }
    await assertTaskInWorkspace(input.taskId, session.workspace.id);
    await assertTaskInWorkspace(input.dependsOnTaskId, session.workspace.id);

    // Walk the existing graph from the proposed blocker; if we can reach the
    // task being blocked, this edge would close a cycle.
    const edges = await db.taskDependency.findMany({
      where: { task: { workspaceId: session.workspace.id } },
      select: { taskId: true, dependsOnTaskId: true },
    });
    const blockedBy = new Map<string, string[]>();
    for (const edge of edges) {
      blockedBy.set(edge.taskId, [...(blockedBy.get(edge.taskId) ?? []), edge.dependsOnTaskId]);
    }
    const seen = new Set<string>();
    const stack = [input.dependsOnTaskId];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === input.taskId) {
        return fail(await message("errors.task.circularDependency"));
      }
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(blockedBy.get(current) ?? []));
    }

    await db.taskDependency.upsert({
      where: {
        taskId_dependsOnTaskId: {
          taskId: input.taskId,
          dependsOnTaskId: input.dependsOnTaskId,
        },
      },
      create: { taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId },
      update: {},
    });

    const task = await getTask(input.taskId, session.workspace.id);
    if (!task) return fail(await message("errors.task.goneShort"));
    refresh();
    return ok(task);
  });
}

export async function removeDependency(input: {
  taskId: string;
  dependsOnTaskId: string;
}): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await assertTaskInWorkspace(input.taskId, session.workspace.id);

    await db.taskDependency.deleteMany({
      where: { taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId },
    });

    const task = await getTask(input.taskId, session.workspace.id);
    if (!task) return fail(await message("errors.task.goneShort"));
    refresh();
    return ok(task);
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addComment(input: {
  taskId: string;
  body: string;
}): Promise<ActionResult<CommentView[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const body = input.body.trim();
    if (body.length === 0) return fail(await message("errors.task.emptyNote"));
    if (body.length > 4000) return fail(await message("errors.task.noteTooLong"));

    const task = await assertTaskInWorkspace(input.taskId, session.workspace.id);

    await db.taskComment.create({
      data: { taskId: input.taskId, authorMemberId: session.member.id, body },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_COMMENTED",
      summary: `commented on “${task.title}”`,
      taskId: input.taskId,
    });

    refresh();
    return ok(await listComments(input.taskId, session.workspace.id));
  });
}

/** Loads comments on demand when the detail drawer opens. */
export async function fetchComments(taskId: string): Promise<ActionResult<CommentView[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await assertTaskInWorkspace(taskId, session.workspace.id);
    return ok(await listComments(taskId, session.workspace.id));
  });
}

/** Resolves a Zod issue's key, falling back to a generic message. */
async function issue(key: string | undefined, fallback: TranslationKey): Promise<string> {
  return message((key ?? fallback) as TranslationKey);
}
