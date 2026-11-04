import type { MemberSummary, TaskView } from "./types";
import { isOverdue, startOfDay, unmetDependencies } from "./priority";
import { isOnTask } from "./filters";

/**
 * Every number the dashboard shows is computed here, from the live task list.
 * Nothing is hard-coded, and nothing is estimated.
 */

export type WorkspaceStats = {
  totalOpen: number;
  byMember: { member: MemberSummary; open: number; overdue: number; completed: number }[];
  unassignedOpen: number;
  inProgress: number;
  waiting: number;
  completed: number;
  overdue: number;
  dueToday: number;
  needsReview: number;
  completionRate: number;
  completedThisWeek: number;
  createdThisWeek: number;
};

function isOpen(task: TaskView): boolean {
  return task.status !== "COMPLETED";
}

export function computeStats(
  tasks: TaskView[],
  members: MemberSummary[],
  now: Date,
): WorkspaceStats {
  const weekAgo = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const open = tasks.filter(isOpen);

  const completedThisWeek = completed.filter(
    (t) => t.completedAt !== null && new Date(t.completedAt) >= weekAgo,
  ).length;

  return {
    totalOpen: open.length,
    byMember: members.map((member) => {
      const mine = tasks.filter((t) => isOnTask(t, member.id));
      return {
        member,
        open: mine.filter(isOpen).length,
        overdue: mine.filter((t) => isOverdue(t, now)).length,
        completed: mine.filter((t) => t.status === "COMPLETED").length,
      };
    }),
    unassignedOpen: open.filter((t) => isOnTask(t, "UNASSIGNED")).length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    waiting: open.filter((t) => t.status === "BLOCKED" || unmetDependencies(t).length > 0).length,
    completed: completed.length,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
    dueToday: open.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length,
    needsReview: open.filter((t) => t.needsReview).length,
    completionRate: tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100),
    completedThisWeek,
    createdThisWeek: tasks.filter((t) => new Date(t.createdAt) >= weekAgo).length,
  };
}

/** Completions per day for the last `days` days, oldest first. */
export function completionTrend(
  tasks: TaskView[],
  now: Date,
  days = 14,
): { date: string; completed: number; created: number }[] {
  const out: { date: string; completed: number; created: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    out.push({
      date: day.toISOString().slice(0, 10),
      completed: tasks.filter(
        (t) =>
          t.completedAt !== null &&
          new Date(t.completedAt) >= day &&
          new Date(t.completedAt) < next,
      ).length,
      created: tasks.filter(
        (t) => new Date(t.createdAt) >= day && new Date(t.createdAt) < next,
      ).length,
    });
  }
  return out;
}
