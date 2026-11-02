import { NO_SPACE } from "./types";
import type { TaskCategory, TaskPriority, TaskStatus, TaskView } from "./types";
import { isOverdue, unmetDependencies } from "./priority";

export type DueWindow = "ANY" | "OVERDUE" | "TODAY" | "THIS_WEEK" | "NO_DATE";

export type TaskFilters = {
  search: string;
  /** Member ids. Empty means every owner. `"UNASSIGNED"` matches no owner. */
  owners: string[];
  /** Section ids. Empty means every section. `NO_SPACE` matches unfiled work. */
  spaces: string[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  categories: TaskCategory[];
  dueWindow: DueWindow;
  /** Meeting id, or null for any source. */
  meetingId: string | null;
  needsReviewOnly: boolean;
  waitingOnSomeoneOnly: boolean;
  /** Completed tasks are hidden unless asked for. */
  includeCompleted: boolean;
};

export const emptyFilters: TaskFilters = {
  search: "",
  owners: [],
  spaces: [],
  statuses: [],
  priorities: [],
  categories: [],
  dueWindow: "ANY",
  meetingId: null,
  needsReviewOnly: false,
  waitingOnSomeoneOnly: false,
  includeCompleted: false,
};

export function countActiveFilters(f: TaskFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.owners.length) n++;
  if (f.spaces.length) n++;
  if (f.statuses.length) n++;
  if (f.priorities.length) n++;
  if (f.categories.length) n++;
  if (f.dueWindow !== "ANY") n++;
  if (f.meetingId) n++;
  if (f.needsReviewOnly) n++;
  if (f.waitingOnSomeoneOnly) n++;
  if (f.includeCompleted) n++;
  return n;
}

function matchesDueWindow(task: TaskView, window: DueWindow, now: Date): boolean {
  switch (window) {
    case "ANY":
      return true;
    case "NO_DATE":
      return task.dueDate === null;
    case "OVERDUE":
      return isOverdue(task, now);
    case "TODAY": {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate()
      );
    }
    case "THIS_WEEK": {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate).getTime();
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      return due <= end.getTime();
    }
  }
}

/**
 * All predicates combine with AND; values within one predicate combine with OR.
 * That is the behaviour people expect from a filter bar: narrowing with each
 * additional facet, broadening within a facet.
 */
export function applyFilters(tasks: TaskView[], f: TaskFilters, now: Date): TaskView[] {
  const needle = f.search.trim().toLowerCase();

  return tasks.filter((task) => {
    if (!f.includeCompleted && !f.statuses.includes("COMPLETED") && task.status === "COMPLETED") {
      return false;
    }

    if (needle) {
      const haystack = [
        task.title,
        task.description ?? "",
        task.labels.join(" "),
        task.owner?.name ?? "",
        task.space?.name ?? "",
        task.sourceMeeting?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (f.owners.length) {
      const key = task.owner?.id ?? "UNASSIGNED";
      if (!f.owners.includes(key)) return false;
    }

    if (f.spaces.length) {
      const key = task.space?.id ?? NO_SPACE;
      if (!f.spaces.includes(key)) return false;
    }

    if (f.statuses.length && !f.statuses.includes(task.status)) return false;
    if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
    if (f.categories.length && !f.categories.includes(task.category)) return false;
    if (!matchesDueWindow(task, f.dueWindow, now)) return false;
    if (f.meetingId && task.sourceMeeting?.id !== f.meetingId) return false;
    if (f.needsReviewOnly && !task.needsReview) return false;

    if (f.waitingOnSomeoneOnly) {
      const waiting = task.status === "BLOCKED" || unmetDependencies(task).length > 0;
      if (!waiting) return false;
    }

    return true;
  });
}
