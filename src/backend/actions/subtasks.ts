"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import {
  assertSubtaskInWorkspace,
  assertTaskInWorkspace,
  requireSessionForAction,
} from "@/backend/auth/guards";
import { getTask } from "@/backend/data/tasks";
import { message } from "@/backend/i18n/message";
import {
  MAX_SUBTASKS_PER_TASK,
  SUBTASK_TITLE_MAX,
  parseSubtaskLines,
} from "@/shared/domain/subtasks";
import type { TaskView } from "@/shared/domain/types";
import { fail, guarded, logActivity, ok, type ActionResult } from "./shared";

/**
 * A task's checklist.
 *
 * Every action returns the whole task, as the task actions do, so the drawer
 * and the board rows reconcile from one shape instead of patching a nested
 * list by hand.
 *
 * Only `addSubtasks` writes to the activity feed. Ticking a step is the most
 * frequent interaction in the app — someone works down a list of eight in a
 * couple of minutes — and a feed that recorded each one would bury the
 * reassignments and deadline changes a colleague actually needs to see.
 */

const addInput = z.object({
  taskId: z.string().min(1),
  /**
   * Raw text, not a parsed array: one typed line, or a pasted list. Splitting
   * it here rather than in the client is what guarantees the number of steps
   * created is the number the button promised.
   */
  text: z.string().max(20_000),
});

export async function addSubtasks(
  raw: z.input<typeof addInput>,
): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = addInput.safeParse(raw);
    if (!parsed.success) return fail(await message("errors.subtask.invalid"));

    const task = await assertTaskInWorkspace(parsed.data.taskId, session.workspace.id);
    const titles = parseSubtaskLines(parsed.data.text);
    if (titles.length === 0) return fail(await message("errors.subtask.empty"));

    const existing = await db.subtask.aggregate({
      where: { taskId: task.id },
      _count: { _all: true },
      _max: { position: true },
    });

    const room = MAX_SUBTASKS_PER_TASK - existing._count._all;
    if (room <= 0) {
      return fail(await message("errors.subtask.tooMany"));
    }

    // Over the ceiling, the first N are kept rather than the whole paste
    // rejected: someone who pasted a hundred and one lines wants the hundred.
    const accepted = titles.slice(0, room);
    const base = existing._max.position ?? 0;

    await db.subtask.createMany({
      data: accepted.map((title, index) => ({
        taskId: task.id,
        title,
        // Sparse, and continuing from the end of the list.
        position: base + (index + 1) * 100,
      })),
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TASK_UPDATED",
      summary:
        accepted.length === 1
          ? `added a step to “${task.title}”: ${accepted[0]}`
          : `added ${accepted.length} steps to “${task.title}”`,
      taskId: task.id,
      metadata: { field: "subtasks", added: accepted.length },
    });

    return respond(task.id, session.workspace.id);
  });
}

const doneInput = z.object({ id: z.string().min(1), done: z.boolean() });

export async function setSubtaskDone(
  raw: z.input<typeof doneInput>,
): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = doneInput.safeParse(raw);
    if (!parsed.success) return fail(await message("errors.subtask.invalid"));

    const subtask = await assertSubtaskInWorkspace(parsed.data.id, session.workspace.id);

    await db.subtask.update({
      where: { id: subtask.id },
      data: {
        done: parsed.data.done,
        // Re-ticking something already ticked keeps the original time; see the
        // note on the column.
        completedAt: parsed.data.done
          ? subtask.done
            ? undefined
            : new Date()
          : null,
      },
    });

    return respond(subtask.taskId, session.workspace.id);
  });
}

const renameInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "errors.subtask.empty").max(SUBTASK_TITLE_MAX),
});

export async function renameSubtask(
  raw: z.input<typeof renameInput>,
): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = renameInput.safeParse(raw);
    if (!parsed.success) return fail(await message("errors.subtask.invalid"));

    const subtask = await assertSubtaskInWorkspace(parsed.data.id, session.workspace.id);
    await db.subtask.update({
      where: { id: subtask.id },
      data: { title: parsed.data.title },
    });

    return respond(subtask.taskId, session.workspace.id);
  });
}

export async function deleteSubtask(id: string): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const subtask = await assertSubtaskInWorkspace(id, session.workspace.id);
    await db.subtask.delete({ where: { id: subtask.id } });
    return respond(subtask.taskId, session.workspace.id);
  });
}

const reorderInput = z.object({
  taskId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).max(MAX_SUBTASKS_PER_TASK),
});

/** Persists a hand-arranged order, the way `reorderTasks` does for the board. */
export async function reorderSubtasks(
  raw: z.input<typeof reorderInput>,
): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = reorderInput.safeParse(raw);
    if (!parsed.success) return fail(await message("errors.subtask.invalid"));

    const task = await assertTaskInWorkspace(parsed.data.taskId, session.workspace.id);

    // Only steps that really are on this task, so a payload naming someone
    // else's list cannot reposition it.
    const owned = await db.subtask.findMany({
      where: { taskId: task.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((subtask) => subtask.id));

    await db.$transaction(
      parsed.data.orderedIds
        .filter((id) => ownedIds.has(id))
        .map((id, index) =>
          db.subtask.update({ where: { id }, data: { position: (index + 1) * 100 } }),
        ),
    );

    return respond(task.id, session.workspace.id);
  });
}

/** The task as every surface reads it, after a write to its checklist. */
async function respond(
  taskId: string,
  workspaceId: string,
): Promise<ActionResult<TaskView>> {
  const task = await getTask(taskId, workspaceId);
  if (!task) return fail(await message("errors.task.goneShort"));
  refresh();
  return ok(task);
}
