"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import {
  assertMemberInWorkspace,
  assertSpaceInWorkspace,
  assertTaskInWorkspace,
  requireSessionForAction,
} from "@/backend/auth/guards";
import { getComment, getTask, listComments, type CommentView } from "@/backend/data/tasks";
import { isAiConfigured } from "@/backend/ai/client";
import { adviseOnTask } from "@/backend/ai/advise";
import type { ExtractedAdvice } from "@/backend/ai/schema";
import { mentionsIn } from "@/shared/domain/mentions";
import { hasAdvice, type Advice } from "@/shared/domain/sketch";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type TaskStatus,
  type TaskView,
} from "@/shared/domain/types";
import { priorityMeta, statusMeta } from "@/shared/domain/labels";
import { findStatus, isBuiltinStatus, isValidStatus } from "@/shared/domain/statuses";
import { listStatuses } from "@/backend/data/statuses";
import { MAX_SUBTASKS_PER_TASK, SUBTASK_TITLE_MAX } from "@/shared/domain/subtasks";
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
  /** Everyone else on the task. The owner is dropped from it if present. */
  assigneeMemberIds: z.array(z.string().min(1)).max(20),
  /** The section it is filed under. Null is "No section". */
  spaceId: z.string().nullable(),
  /** A status key; checked against the workspace's list before any write. */
  status: z.string().trim().min(1).max(64),
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
  assigneeMemberIds: taskFields.assigneeMemberIds.default([]),
  spaceId: taskFields.spaceId.optional(),
  status: taskFields.status.default("TODO"),
  priority: taskFields.priority.default("MEDIUM"),
  category: taskFields.category.default("GENERAL"),
  labels: taskFields.labels.default([]),
  dueDate: taskFields.dueDate.optional(),
  estimateMinutes: taskFields.estimateMinutes.optional(),
  sourceMeetingId: taskFields.sourceMeetingId.optional(),
  /**
   * Steps written in the same breath as the task. Only on create: an existing
   * task's checklist is edited one step at a time through the subtask actions.
   */
  subtasks: z
    .array(z.string().trim().min(1).max(SUBTASK_TITLE_MAX))
    .max(MAX_SUBTASKS_PER_TASK)
    .default([]),
});

export type TaskInput = z.input<typeof taskInput>;

/**
 * The status must be one the workspace knows: the key arrives from the
 * browser, and a stale tab can still name a column that was deleted.
 */
async function assertStatusInWorkspace(status: TaskStatus, workspaceId: string) {
  const defs = await listStatuses(workspaceId);
  if (!isValidStatus(defs, status)) throw new Error(await message("errors.status.gone"));
  return defs;
}

/** The name of a status for the activity feed, built-in or custom. */
function statusName(defs: Awaited<ReturnType<typeof listStatuses>>, status: TaskStatus): string {
  return isBuiltinStatus(status) ? statusMeta[status].label : findStatus(defs, status).label;
}

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
    const assigneeIds = await assertAssignees(
      input.assigneeMemberIds,
      input.ownerMemberId ?? null,
      session.workspace.id,
    );
    if (input.spaceId) {
      await assertSpaceInWorkspace(input.spaceId, session.workspace.id);
    }
    await assertStatusInWorkspace(input.status, session.workspace.id);

    const created = await db.task.create({
      data: {
        workspaceId: session.workspace.id,
        title: input.title,
        description: input.description ?? null,
        ownerMemberId: input.ownerMemberId ?? null,
        assignees: { create: assigneeIds.map((memberId) => ({ memberId })) },
        spaceId: input.spaceId ?? null,
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
        // Created together with the task, so they land in one write and the
        // task never exists for a moment without the steps it was typed with.
        subtasks: {
          create: input.subtasks.map((title, index) => ({
            title,
            position: (index + 1) * 100,
          })),
        },
      },
      select: { id: true },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_CREATED",
      summary:
        input.subtasks.length > 0
          ? `created “${input.title}” with ${input.subtasks.length} steps`
          : `created “${input.title}”`,
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
  assigneeMemberIds: taskFields.assigneeMemberIds.optional(),
  spaceId: taskFields.spaceId.optional(),
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
    if (changes.spaceId) {
      await assertSpaceInWorkspace(changes.spaceId, session.workspace.id);
    }

    // The owner is never also a co-assignee. Whichever side of that pair
    // changes, the other side is brought into line here.
    const ownerAfter =
      changes.ownerMemberId !== undefined ? changes.ownerMemberId : before.ownerMemberId;
    const assigneesBefore = before.assignees.map((a) => a.memberId);
    const assigneesAfter =
      changes.assigneeMemberIds !== undefined || changes.ownerMemberId !== undefined
        ? await assertAssignees(
            changes.assigneeMemberIds ?? assigneesBefore,
            ownerAfter,
            session.workspace.id,
          )
        : undefined;
    const assigneesChanged =
      assigneesAfter !== undefined && !sameSet(assigneesAfter, assigneesBefore);

    const data: Record<string, unknown> = {};
    if (assigneesChanged) {
      data.assignees = {
        deleteMany: {},
        create: assigneesAfter.map((memberId) => ({ memberId })),
      };
    }
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.ownerMemberId !== undefined) data.ownerMemberId = changes.ownerMemberId;
    if (changes.spaceId !== undefined) data.spaceId = changes.spaceId;
    if (changes.priority !== undefined) data.priority = changes.priority;
    if (changes.category !== undefined) data.category = changes.category;
    if (changes.labels !== undefined) data.labels = changes.labels;
    if (changes.estimateMinutes !== undefined) data.estimateMinutes = changes.estimateMinutes;
    if (changes.dueDate !== undefined) data.dueDate = parseDateInput(changes.dueDate);
    const statusDefs =
      changes.status !== undefined
        ? await assertStatusInWorkspace(changes.status, session.workspace.id)
        : [];
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
          summary: `reopened “${before.title}” as ${statusName(statusDefs, changes.status)}`,
        });
      } else {
        entries.push({
          type: "TASK_STATUS_CHANGED",
          summary: `moved “${before.title}” to ${statusName(statusDefs, changes.status)}`,
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

    if (assigneesChanged) {
      const added = assigneesAfter.filter((id) => !assigneesBefore.includes(id));
      const removed = assigneesBefore.filter((id) => !assigneesAfter.includes(id));
      const names = await memberNames([...added, ...removed]);
      const parts = [
        added.length ? `added ${added.map((id) => names.get(id) ?? "someone").join(", ")} to` : "",
        removed.length
          ? `took ${removed.map((id) => names.get(id) ?? "someone").join(", ")} off`
          : "",
      ].filter(Boolean);
      entries.push({
        type: "TASK_OWNER_CHANGED",
        summary: `${parts.join(" and ")} “${before.title}”`,
        meta: { field: "assignees", from: assigneesBefore, to: assigneesAfter },
      });
    }

    if (changes.spaceId !== undefined && changes.spaceId !== before.spaceId) {
      // Named rather than recorded as a bare "updated": moving work between
      // sections is the kind of change a colleague notices and asks about.
      const name = changes.spaceId
        ? (await assertSpaceInWorkspace(changes.spaceId, session.workspace.id)).name
        : null;
      entries.push({
        type: "TASK_UPDATED",
        summary: name
          ? `filed “${before.title}” under ${name}`
          : `took “${before.title}” out of its section`,
        meta: { field: "space", from: before.spaceId, to: changes.spaceId },
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
  status?: TaskStatus;
  ownerMemberId?: string | null;
  assigneeMemberIds?: string[];
}): Promise<ActionResult<TaskView>> {
  return updateTask({
    id: input.id,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.ownerMemberId !== undefined ? { ownerMemberId: input.ownerMemberId } : {}),
    ...(input.assigneeMemberIds !== undefined
      ? { assigneeMemberIds: input.assigneeMemberIds }
      : {}),
  });
}

/**
 * Co-assignees, checked and cleaned: each must be in the workspace, the owner
 * is dropped, and duplicates collapse. Order is kept, so the avatars stay in
 * the order people were added.
 */
async function assertAssignees(
  ids: string[],
  ownerMemberId: string | null,
  workspaceId: string,
): Promise<string[]> {
  const unique = [...new Set(ids)].filter((id) => id !== ownerMemberId);
  await Promise.all(unique.map((id) => assertMemberInWorkspace(id, workspaceId)));
  return unique;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

async function memberNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.workspaceMember.findMany({
    where: { id: { in: ids } },
    select: { id: true, user: { select: { name: true } } },
  });
  return new Map(rows.map((r) => [r.id, r.user.name]));
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
// Discussion
// ---------------------------------------------------------------------------

/** The posted thread, plus the message the assistant still owes an answer to. */
export type PostedComment = {
  comments: CommentView[];
  /**
   * The id of the message that mentioned `@ai`, when it did. The client posts
   * first and asks second, so a message appears the moment it is sent instead
   * of waiting behind a model call that takes most of a minute.
   */
  awaitingAiFor: string | null;
};

export async function addComment(input: {
  taskId: string;
  body: string;
}): Promise<ActionResult<PostedComment>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const body = input.body.trim();
    if (body.length === 0) return fail(await message("errors.task.emptyNote"));
    if (body.length > 4000) return fail(await message("errors.task.noteTooLong"));

    const task = await assertTaskInWorkspace(input.taskId, session.workspace.id);

    // Resolved against the roster here rather than trusted from the client:
    // what the message says is what decides who was called in, so a payload
    // claiming a mention nobody typed cannot pull someone into a thread.
    const { memberIds, mentionsAi } = mentionsIn(body, session.workspace.members);

    const created = await db.taskComment.create({
      data: {
        taskId: input.taskId,
        authorMemberId: session.member.id,
        kind: "MESSAGE",
        body,
        mentionedMemberIds: memberIds,
        mentionsAi,
      },
      select: { id: true },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_COMMENTED",
      summary: `commented on “${task.title}”`,
      taskId: input.taskId,
      metadata: memberIds.length > 0 ? { mentioned: memberIds } : undefined,
    });

    refresh();
    return ok({
      comments: await listComments(input.taskId, session.workspace.id),
      awaitingAiFor: mentionsAi && isAiConfigured() ? created.id : null,
    });
  });
}

/**
 * Answers an `@ai` mention, and posts the answer into the thread.
 *
 * Split from `addComment` on purpose. The model call costs tens of seconds, and
 * holding the person's own message hostage to it would make the discussion feel
 * broken every time the assistant is asked something. So the message lands
 * first, this runs second, and a failure here loses the answer rather than what
 * they wrote.
 *
 * Idempotent through the unique `answersId`: a second call for a question that
 * has already been answered returns the thread unchanged instead of answering
 * twice, which is what makes a retry — or a double click — harmless.
 */
export async function answerWithAi(input: {
  taskId: string;
  commentId: string;
}): Promise<ActionResult<CommentView[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await assertTaskInWorkspace(input.taskId, session.workspace.id);

    if (!isAiConfigured()) return fail(await message("errors.discussion.needsKey"));

    const question = await getComment(input.commentId, session.workspace.id);
    if (!question) return fail(await message("errors.discussion.questionGone"));
    if (!question.mentionsAi) return fail(await message("errors.discussion.notForAi"));

    const existing = await db.taskComment.findUnique({
      where: { answersId: question.id },
      select: { id: true },
    });
    if (existing) {
      return ok(await listComments(input.taskId, session.workspace.id));
    }

    const task = await getTask(input.taskId, session.workspace.id);
    if (!task) return fail(await message("errors.task.goneShort"));

    const thread = await listComments(input.taskId, session.workspace.id);
    const result = await adviseOnTask({
      task,
      members: session.workspace.members,
      thread: thread
        .filter((entry) => entry.createdAt < question.createdAt)
        .map((entry) => ({
          authorName: entry.author?.name ?? null,
          isAi: entry.kind === "AI_ANSWER",
          body: entry.body,
        })),
      question: {
        authorName: question.author?.name ?? "Someone",
        body: question.body,
      },
      today: new Date().toISOString().slice(0, 10),
    });

    const advice = toAdvice(result.advice);
    const reply = result.advice.reply.trim();
    if (!reply && !hasAdvice(advice)) {
      return fail(await message("errors.discussion.emptyAnswer"));
    }

    await db.taskComment.create({
      data: {
        taskId: input.taskId,
        // No author: an assistant message belongs to no member, which is what
        // `kind` makes unambiguous against a comment whose author has left.
        authorMemberId: null,
        kind: "AI_ANSWER",
        body: reply,
        answersId: question.id,
        advice: advice as never,
        model: result.model,
      },
    });

    refresh();
    return ok(await listComments(input.taskId, session.workspace.id));
  });
}

/**
 * Narrows the model's answer to what the thread renders.
 *
 * Everything is trimmed and bounded here rather than in the renderer: a reply
 * with forty recommendations is a reply nobody reads, and the schema can ask
 * for restraint but cannot enforce it.
 */
function toAdvice(extracted: ExtractedAdvice): Advice {
  const text = (value: string, limit: number) => value.trim().slice(0, limit);
  const lines = (values: string[], limit: number) =>
    values.map((value) => text(value, 240)).filter(Boolean).slice(0, limit);

  const screens = extracted.wantsSketch
    ? extracted.sketch.screens.slice(0, 3).map((screen) => ({
        title: text(screen.title, 60),
        caption: text(screen.caption, 140),
        blocks: screen.blocks.slice(0, 6).map((block) => ({
          kind: block.kind,
          label: text(block.label, 48),
          lines: lines(block.lines, 6),
          emphasis: block.emphasis,
        })),
      }))
    : [];

  const flow = extracted.wantsSketch
    ? extracted.sketch.flow.slice(0, 8).map((step) => ({
        actor: step.actor,
        label: text(step.label, 48),
        detail: text(step.detail, 180),
      }))
    : [];

  return {
    recommendations: extracted.recommendations.slice(0, 6).map((item) => ({
      title: text(item.title, 120),
      detail: text(item.detail, 600),
      effort: item.effort,
      tradeoff: text(item.tradeoff, 240),
    })),
    risks: lines(extracted.risks, 5),
    openQuestions: lines(extracted.openQuestions, 5),
    sketch:
      screens.length > 0 || flow.length > 0
        ? {
            title: text(extracted.sketch.title, 80),
            caption: text(extracted.sketch.caption, 160),
            screens,
            flow,
          }
        : null,
  };
}

/** Loads the discussion on demand when the detail drawer opens. */
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
