import type { Translate, TranslationKey, Vars } from "../i18n";
import type { SortMode, TaskPriority, TaskView } from "./types";
import { priorityMeta } from "./labels";

/**
 * Prioritisation and ordering.
 *
 * Every function here takes `now` explicitly rather than calling `new Date()`.
 * Two reasons:
 *  1. The functions stay pure and testable.
 *  2. `cacheComponents` is enabled, and synchronous clock reads during
 *     prerender are a build error. Keeping the clock at the edge of the system
 *     means this module can be used from anywhere.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` until `due`. Negative means overdue. */
export function daysUntil(due: string | null, now: Date): number | null {
  if (!due) return null;
  const dueMs = startOfDay(new Date(due)).getTime();
  const nowMs = startOfDay(now).getTime();
  return Math.round((dueMs - nowMs) / DAY_MS);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isOverdue(task: Pick<TaskView, "dueDate" | "status">, now: Date): boolean {
  if (task.status === "COMPLETED") return false;
  const days = daysUntil(task.dueDate, now);
  return days !== null && days < 0;
}

/** Tasks that cannot be actioned by their owner right now. */
export function isWaiting(task: Pick<TaskView, "status">): boolean {
  return task.status === "BLOCKED";
}

/** How many not-yet-done tasks are waiting on this one. */
export function blockingImpact(task: Pick<TaskView, "dependents">): number {
  return task.dependents.filter((d) => d.status !== "COMPLETED").length;
}

/** Unfinished tasks this one is waiting on. */
export function unmetDependencies(task: Pick<TaskView, "dependencies">) {
  return task.dependencies.filter((d) => d.status !== "COMPLETED");
}

export type SmartFactor = {
  /**
   * What the factor is, not what it says. Scoring runs wherever it is needed —
   * including on the server — while the wording belongs to whatever language
   * the reader has chosen, so the two are kept apart.
   */
  key: TranslationKey;
  vars?: Vars;
  /** Negative weights raise a task; positive weights lower it. */
  weight: number;
};

export type SmartScore = {
  score: number;
  factors: SmartFactor[];
};

/** Resolves a factor to the language on screen. */
export function factorLabel(factor: SmartFactor, t: Translate): string {
  return t(factor.key, factor.vars);
}

/**
 * Smart priority.
 *
 * Priority is the dominant term (1000 per level), so adjustments reorder tasks
 * *within* a priority band and only rarely across one. In particular an
 * overdue LOW task scores 2750 and still sits below every MEDIUM task at 2000
 * — overdue raises urgency without declaring everything an emergency.
 */
export function smartScore(task: TaskView, now: Date): SmartScore {
  const factors: SmartFactor[] = [];
  let score = priorityMeta[task.priority].rank * 1000;

  if (task.status === "COMPLETED") {
    return {
      score: score + 100_000,
      factors: [{ key: "priority.factor.completed", weight: 100_000 }],
    };
  }

  const days = daysUntil(task.dueDate, now);

  if (days === null) {
    score += 40;
    factors.push({ key: "priority.factor.noDeadline", weight: 40 });
  } else if (days < 0) {
    const overdueBy = Math.abs(days);
    // Caps at -250 so a stale low-priority task can never outrank real work.
    const weight = -Math.min(250, 150 + overdueBy * 10);
    score += weight;
    factors.push({
      key: "priority.factor.overdueBy",
      vars: { count: overdueBy },
      weight,
    });
  } else if (days === 0) {
    score -= 150;
    factors.push({ key: "priority.factor.dueToday", weight: -150 });
  } else if (days === 1) {
    score -= 120;
    factors.push({ key: "priority.factor.dueTomorrow", weight: -120 });
  } else if (days <= 3) {
    score -= 80;
    factors.push({ key: "priority.factor.dueInDays", vars: { count: days }, weight: -80 });
  } else if (days <= 7) {
    score -= 30;
    factors.push({ key: "priority.factor.dueThisWeek", weight: -30 });
  }

  const blocks = blockingImpact(task);
  if (blocks > 0) {
    const weight = -Math.min(4, blocks) * 60;
    score += weight;
    factors.push({ key: "priority.factor.blocks", vars: { count: blocks }, weight });
  }

  if (task.status === "IN_PROGRESS") {
    score -= 40;
    factors.push({ key: "priority.factor.inProgress", weight: -40 });
  }

  if (task.status === "BLOCKED") {
    // Can't be acted on, so it drops — but a blocked urgent task still ranks
    // above an unblocked medium one, which is the point.
    score += 120;
    factors.push({ key: "priority.factor.waitingOnSomething", weight: 120 });
  }

  const unmet = unmetDependencies(task).length;
  if (unmet > 0 && task.status !== "BLOCKED") {
    score += 60;
    factors.push({
      key: "priority.factor.waitingOnDeps",
      vars: { count: unmet },
      weight: 60,
    });
  }

  if (task.needsReview) {
    score -= 30;
    factors.push({ key: "priority.factor.needsReview", weight: -30 });
  }

  return { score, factors };
}

/** One line on why a task sits where it does, in the language on screen. */
export function smartExplanation(task: TaskView, now: Date, t: Translate): string {
  const { factors } = smartScore(task, now);
  const ranked = [...factors].sort((a, b) => a.weight - b.weight);
  const raising = ranked.filter((f) => f.weight < 0).slice(0, 2);
  const base = t("priority.explanation", { priority: t(`priority.${task.priority}.label`) });

  // Factor labels are written as standalone phrases ("Due today"), so they are
  // lower-cased to read as a continuation. That holds for Cyrillic too.
  const phrase = (factor: SmartFactor) => factorLabel(factor, t).toLowerCase();

  if (raising.length === 0) {
    const lowering = ranked.filter(
      (f) => f.weight > 0 && f.key !== "priority.factor.completed",
    );
    return lowering.length
      ? t("priority.explanationWith", { base, factors: phrase(lowering[0]!) })
      : base;
  }
  return t("priority.explanationWith", { base, factors: raising.map(phrase).join(" · ") });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function byDueDate(a: TaskView, b: TaskView): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1; // undated last
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

const statusOrder: Record<TaskView["status"], number> = {
  IN_PROGRESS: 0,
  TODO: 1,
  BLOCKED: 2,
  COMPLETED: 3,
};

/**
 * Order tasks for display.
 *
 * MANUAL returns the user's hand-arranged order and applies no heuristics —
 * a drag is never silently undone by re-sorting.
 */
export function sortTasks(tasks: TaskView[], mode: SortMode, now: Date): TaskView[] {
  const list = [...tasks];

  switch (mode) {
    case "MANUAL":
      return list.sort((a, b) => {
        const ao = a.manualOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.manualOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.createdAt.localeCompare(b.createdAt);
      });

    case "PRIORITY":
      return list.sort(
        (a, b) =>
          priorityMeta[a.priority].rank - priorityMeta[b.priority].rank ||
          byDueDate(a, b) ||
          a.title.localeCompare(b.title),
      );

    case "DUE_DATE":
      return list.sort((a, b) => byDueDate(a, b) || a.title.localeCompare(b.title));

    case "STATUS":
      return list.sort(
        (a, b) =>
          statusOrder[a.status] - statusOrder[b.status] ||
          priorityMeta[a.priority].rank - priorityMeta[b.priority].rank ||
          byDueDate(a, b),
      );

    case "CREATED_AT":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    case "UPDATED_AT":
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    case "ALPHABETICAL":
      return list.sort((a, b) => a.title.localeCompare(b.title));

    case "SMART":
    default: {
      const scored = list.map((task) => ({ task, score: smartScore(task, now).score }));
      scored.sort(
        (a, b) =>
          a.score - b.score ||
          byDueDate(a.task, b.task) ||
          a.task.createdAt.localeCompare(b.task.createdAt),
      );
      return scored.map((s) => s.task);
    }
  }
}

/**
 * The priority the system would choose, given live task state.
 * Used to surface "AI suggested Urgent" style hints without ever overwriting
 * a human decision.
 */
export function suggestedPriority(task: TaskView, now: Date): TaskPriority | null {
  const days = daysUntil(task.dueDate, now);
  const blocks = blockingImpact(task);

  if (task.status === "COMPLETED") return null;

  // Blocking several deliverables with a deadline inside two days is the one
  // case strong enough to argue for Urgent on its own.
  if (blocks >= 2 && days !== null && days <= 2) return "URGENT";
  if (days !== null && days < -2 && task.priority === "LOW") return "MEDIUM";
  if (blocks >= 1 && task.priority === "LOW") return "MEDIUM";
  return null;
}
