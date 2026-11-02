import "server-only";

import { db } from "@/backend/db";
import type { MemberSummary, SessionContext } from "@/shared/domain/types";

/**
 * Cheap counts for the shell (nav badges and the notification popover).
 *
 * Deliberately separate from `listTasks`: the shell renders on every route, so
 * it must not pull the whole task list just to draw a badge.
 */

export type ShellData = {
  counts: { pendingReview: number; myOpen: number; theirOpen: number };
  alerts: {
    id: string;
    href: string;
    title: string;
    detail: string;
    tone: string;
  }[];
  counterpart: MemberSummary | null;
};

export async function getShellData(
  session: SessionContext,
  now: Date,
): Promise<ShellData> {
  const workspaceId = session.workspace.id;

  const counterpart =
    session.workspace.members.find((m) => m.id !== session.member.id) ?? null;

  const [pendingReview, myOpen, theirOpen, overdue, dueToday, needsReview, awaiting] =
    await Promise.all([
      db.taskProposal.count({ where: { status: "PENDING", meeting: { workspaceId } } }),
      db.task.count({
        where: { workspaceId, ownerMemberId: session.member.id, status: { not: "COMPLETED" } },
      }),
      counterpart
        ? db.task.count({
            where: { workspaceId, ownerMemberId: counterpart.id, status: { not: "COMPLETED" } },
          })
        : Promise.resolve(0),
      db.task.count({
        where: {
          workspaceId,
          ownerMemberId: session.member.id,
          status: { not: "COMPLETED" },
          dueDate: { lt: startOfToday(now) },
        },
      }),
      db.task.count({
        where: {
          workspaceId,
          ownerMemberId: session.member.id,
          status: { not: "COMPLETED" },
          dueDate: { gte: startOfToday(now), lt: endOfToday(now) },
        },
      }),
      db.task.count({ where: { workspaceId, needsReview: true, status: { not: "COMPLETED" } } }),
      db.meeting.count({
        where: { workspaceId, status: { in: ["AWAITING_TRANSCRIPT", "FAILED"] } },
      }),
    ]);

  const alerts: ShellData["alerts"] = [];

  if (overdue > 0) {
    alerts.push({
      id: "overdue",
      href: "/my-tasks",
      title: `${overdue} of your tasks ${overdue === 1 ? "is" : "are"} overdue`,
      detail: "Re-date what still matters and drop what does not.",
      tone: "tone-danger",
    });
  }
  if (dueToday > 0) {
    alerts.push({
      id: "today",
      href: "/my-tasks",
      title: `${dueToday} ${dueToday === 1 ? "task is" : "tasks are"} due today`,
      detail: "Assigned to you.",
      tone: "tone-warning",
    });
  }
  if (pendingReview > 0) {
    alerts.push({
      id: "review",
      href: "/review",
      title: `${pendingReview} proposed ${pendingReview === 1 ? "task" : "tasks"} awaiting review`,
      detail: "Approve, edit or reject them before they become commitments.",
      tone: "tone-accent",
    });
  }
  if (needsReview > 0) {
    alerts.push({
      id: "unclear",
      href: "/all-tasks",
      title: `${needsReview} ${needsReview === 1 ? "task needs" : "tasks need"} a decision`,
      detail: "The owner or deadline was left unclear.",
      tone: "tone-warning",
    });
  }
  if (awaiting > 0) {
    alerts.push({
      id: "transcripts",
      href: "/meetings",
      title: `${awaiting} ${awaiting === 1 ? "meeting is" : "meetings are"} waiting on a transcript`,
      detail: "Add one manually, or check the Google connection.",
      tone: "tone-info",
    });
  }

  return {
    counts: { pendingReview, myOpen, theirOpen },
    alerts,
    counterpart,
  };
}

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(now: Date): Date {
  const d = startOfToday(now);
  d.setDate(d.getDate() + 1);
  return d;
}
