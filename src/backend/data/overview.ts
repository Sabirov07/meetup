import "server-only";

import { db } from "@/backend/db";
import type { MemberSummary, SessionContext } from "@/shared/domain/types";

/**
 * Cheap counts for the shell (nav badges and the notification popover).
 *
 * Deliberately separate from `listTasks`: the shell renders on every route, so
 * it must not pull the whole task list just to draw a badge.
 */

/**
 * Which attention-worthy condition fired, and how many rows it covers.
 *
 * Deliberately not a sentence: the wording and the link live in the header,
 * which can re-render in a different language without asking the server for
 * anything. A `title` string built here would be stuck in whatever language
 * this request happened to use.
 */
export type ShellAlert = { id: ShellAlertId; count: number };

export type ShellAlertId = "overdue" | "today" | "review" | "unclear" | "transcripts";

export type ShellData = {
  counts: { pendingReview: number; myOpen: number; theirOpen: number };
  alerts: ShellAlert[];
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

  const alerts: ShellAlert[] = [];

  if (overdue > 0) alerts.push({ id: "overdue", count: overdue });
  if (dueToday > 0) alerts.push({ id: "today", count: dueToday });
  if (pendingReview > 0) alerts.push({ id: "review", count: pendingReview });
  if (needsReview > 0) alerts.push({ id: "unclear", count: needsReview });
  if (awaiting > 0) alerts.push({ id: "transcripts", count: awaiting });

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
