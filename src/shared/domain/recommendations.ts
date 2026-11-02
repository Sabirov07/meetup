import type { RecommendationKind, RecommendationView, TaskView } from "./types";
import { blockingImpact, daysUntil, isOverdue, unmetDependencies } from "./priority";

/**
 * Deterministic recommendation engine.
 *
 * These are derived entirely from live workspace state, so every one of them
 * cites the tasks it came from and none is invented. They are computed rather
 * than stored; the `recommendations` table only records dismissals, keyed by
 * the stable id generated here.
 *
 * Model-written recommendations are a separate, clearly-labelled source — see
 * `lib/ai`. Deterministic ones carry `isDeterministic: true`.
 */

/** djb2 — stable across processes, so ids survive a restart. */
function stableId(kind: RecommendationKind, taskIds: string[]): string {
  const input = `${kind}:${[...taskIds].sort().join(",")}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return `rec_${(hash >>> 0).toString(36)}`;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "up",
  "at", "by", "from", "into", "about", "set", "get", "make", "do", "add",
]);

function tokenise(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function similarity(a: string, b: string): number {
  const ta = tokenise(a);
  const tb = tokenise(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / new Set([...ta, ...tb]).size;
}

const ACCESS_CATEGORIES = new Set(["FINANCE", "ADMINISTRATION", "BUSINESS_OPS"]);

export function buildRecommendations(
  tasks: TaskView[],
  now: Date,
  options: { currentMemberId: string; dismissedIds?: Set<string> } ,
): RecommendationView[] {
  const dismissed = options.dismissedIds ?? new Set<string>();
  const open = tasks.filter((t) => t.status !== "COMPLETED");
  const out: RecommendationView[] = [];

  const push = (
    kind: RecommendationKind,
    title: string,
    body: string,
    relatedTaskIds: string[],
    evidence: RecommendationView["evidence"] = "CONFIRMED",
  ) => {
    const id = stableId(kind, relatedTaskIds);
    if (dismissed.has(id)) return;
    out.push({
      id,
      kind,
      title,
      body,
      relatedTaskIds,
      evidence,
      isDeterministic: true,
      createdAt: now.toISOString(),
    });
  };

  // 1. A task is waiting on work that has not finished.
  for (const task of open) {
    const unmet = unmetDependencies(task);
    if (unmet.length === 0) continue;
    const first = unmet[0]!;
    push(
      "UNBLOCK_DEPENDENCY",
      `Finish “${first.title}” before “${task.title}”`,
      unmet.length === 1
        ? `“${task.title}” is waiting on “${first.title}”, which is still ${first.status === "IN_PROGRESS" ? "in progress" : "open"}.`
        : `“${task.title}” is waiting on ${unmet.length} unfinished tasks, starting with “${first.title}”.`,
      [task.id, ...unmet.map((d) => d.id)],
    );
  }

  // 2. One task holding up several others.
  for (const task of open) {
    const blocks = blockingImpact(task);
    if (blocks < 2) continue;
    push(
      "HIGH_IMPACT_BLOCKER",
      `“${task.title}” is blocking ${blocks} tasks`,
      `Clearing this one unblocks ${blocks} other pieces of work${
        task.status === "TODO" ? ", and it has not been started yet" : ""
      }. It is the highest-leverage thing on the board.`,
      [task.id, ...task.dependents.filter((d) => d.status !== "COMPLETED").map((d) => d.id)],
    );
  }

  // 3. Something needed from another person.
  for (const task of open) {
    if (task.owner === null) continue;
    if (task.owner.id === options.currentMemberId) continue;
    const blocksMine = task.dependents.filter((d) => d.status !== "COMPLETED").length > 0;
    const isAccessWork = ACCESS_CATEGORIES.has(task.category);
    if (!blocksMine && !isAccessWork) continue;
    if (task.status !== "TODO" && task.status !== "BLOCKED") continue;
    push(
      "REQUEST_ACCESS",
      `Follow up with ${task.owner.name} on “${task.title}”`,
      blocksMine
        ? `This sits with ${task.owner.name} and other work is waiting behind it.`
        : `This sits with ${task.owner.name} and has not moved. A nudge may be all it needs.`,
      [task.id],
      blocksMine ? "CONFIRMED" : "RECOMMENDED",
    );
  }

  // 4. High-priority work with no deadline.
  for (const task of open) {
    if (task.dueDate !== null) continue;
    if (task.priority !== "URGENT" && task.priority !== "HIGH") continue;
    push(
      "CLARIFY_DEADLINE",
      `Agree a date for “${task.title}”`,
      `This is marked ${task.priority.toLowerCase()} but has no deadline, so it cannot be scheduled or tracked against anything.`,
      [task.id],
      "RECOMMENDED",
    );
  }

  // 5. Likely duplicates.
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const a = open[i]!;
      const b = open[j]!;
      if (similarity(a.title, b.title) < 0.6) continue;
      push(
        "POSSIBLE_DUPLICATE",
        `“${a.title}” and “${b.title}” look like the same work`,
        `Both are open and their titles overlap heavily. Worth merging one into the other${
          a.owner && b.owner && a.owner.id !== b.owner.id
            ? ` — they are currently owned by different people.`
            : "."
        }`,
        [a.id, b.id],
        "RECOMMENDED",
      );
    }
  }

  // 6. Started but untouched.
  for (const task of open) {
    if (task.status !== "IN_PROGRESS") continue;
    const idleDays = Math.floor((now.getTime() - new Date(task.updatedAt).getTime()) / 86_400_000);
    if (idleDays < 7) continue;
    push(
      "STALE_TASK",
      `“${task.title}” has not moved in ${idleDays} days`,
      `It is still marked in progress. Either it is actually blocked, or it is done and needs closing.`,
      [task.id],
      "CONFIRMED",
    );
  }

  // 7. An owner with a pile of overdue work.
  const overdueByOwner = new Map<string, TaskView[]>();
  for (const task of open) {
    if (!isOverdue(task, now)) continue;
    const key = task.owner?.id ?? "UNASSIGNED";
    overdueByOwner.set(key, [...(overdueByOwner.get(key) ?? []), task]);
  }
  for (const [, group] of overdueByOwner) {
    if (group.length < 3) continue;
    const ownerName = group[0]!.owner?.name ?? "Unassigned";
    push(
      "OVERDUE_CLUSTER",
      `${group.length} overdue tasks for ${ownerName}`,
      `Dates have slipped on ${group.length} tasks. Rather than working through them, it is usually faster to re-date them honestly and drop what no longer matters.`,
      group.map((t) => t.id),
      "CONFIRMED",
    );
  }

  // Most actionable first: confirmed evidence, then larger blast radius.
  const evidenceRank = { CONFIRMED: 0, INFERRED: 1, RECOMMENDED: 2 } as const;
  const kindRank: Record<RecommendationKind, number> = {
    HIGH_IMPACT_BLOCKER: 0,
    UNBLOCK_DEPENDENCY: 1,
    REQUEST_ACCESS: 2,
    OVERDUE_CLUSTER: 3,
    STALE_TASK: 4,
    AWAITING_OTHER_PERSON: 5,
    CLARIFY_DEADLINE: 6,
    POSSIBLE_DUPLICATE: 7,
  };

  return out
    .sort(
      (a, b) =>
        evidenceRank[a.evidence] - evidenceRank[b.evidence] ||
        kindRank[a.kind] - kindRank[b.kind] ||
        b.relatedTaskIds.length - a.relatedTaskIds.length,
    )
    .slice(0, 12);
}

/** Exposed so a dismiss action can recompute the same id. */
export { stableId as recommendationId };

/** Used by the dashboard's "what needs attention" line. */
export function attentionSummary(tasks: TaskView[], now: Date): string {
  const open = tasks.filter((t) => t.status !== "COMPLETED");
  const overdue = open.filter((t) => isOverdue(t, now)).length;
  const today = open.filter((t) => daysUntil(t.dueDate, now) === 0).length;
  const blocked = open.filter((t) => t.status === "BLOCKED").length;

  const parts: string[] = [];
  if (overdue) parts.push(`${overdue} overdue`);
  if (today) parts.push(`${today} due today`);
  if (blocked) parts.push(`${blocked} waiting`);

  if (parts.length === 0) {
    return open.length === 0
      ? "Nothing open. A good moment to plan the next block of work."
      : `${open.length} open ${open.length === 1 ? "task" : "tasks"}, none overdue. The board is in good shape.`;
  }
  return `${parts.join(" · ")}.`;
}
