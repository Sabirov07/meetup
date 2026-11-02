import type { Translate } from "../i18n";
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
 *
 * The wording is handed in as `t` rather than written here, because these
 * sentences are read on screen: a recommendation computed in one language and
 * shown in another would be the one piece of the dashboard that ignores the
 * language switch.
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
  options: { currentMemberId: string; dismissedIds?: Set<string>; t: Translate },
): RecommendationView[] {
  const { t } = options;
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
      t("rec.dependency.title", { blocker: first.title, task: task.title }),
      unmet.length === 1
        ? t("rec.dependency.body.single", {
            task: task.title,
            blocker: first.title,
            state: t(
              first.status === "IN_PROGRESS" ? "rec.state.inProgress" : "rec.state.open",
            ),
          })
        : t("rec.dependency.body.many", {
            task: task.title,
            blocker: first.title,
            count: unmet.length,
          }),
      [task.id, ...unmet.map((d) => d.id)],
    );
  }

  // 2. One task holding up several others.
  for (const task of open) {
    const blocks = blockingImpact(task);
    if (blocks < 2) continue;
    push(
      "HIGH_IMPACT_BLOCKER",
      t("rec.blocker.title", { task: task.title, count: blocks }),
      t("rec.blocker.body", {
        notStarted: task.status === "TODO" ? t("rec.blocker.notStarted") : "",
      }),
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
      t("rec.followUp.title", { name: task.owner.name, task: task.title }),
      t(blocksMine ? "rec.followUp.body.blocking" : "rec.followUp.body.nudge", {
        name: task.owner.name,
      }),
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
      t("rec.deadline.title", { task: task.title }),
      t("rec.deadline.body", { priority: t(`priority.${task.priority}.label`) }),
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
        t("rec.duplicate.title", { a: a.title, b: b.title }),
        t(
          a.owner && b.owner && a.owner.id !== b.owner.id
            ? "rec.duplicate.body.differentOwners"
            : "rec.duplicate.body.same",
        ),
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
      t("rec.stale.title", { task: task.title, count: idleDays }),
      t("rec.stale.body"),
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
    const ownerName = group[0]!.owner?.name ?? t("rec.overdueCluster.noOwner");
    push(
      "OVERDUE_CLUSTER",
      t("rec.overdueCluster.title", { count: group.length, name: ownerName }),
      t("rec.overdueCluster.body"),
      group.map((task) => task.id),
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
export function attentionSummary(tasks: TaskView[], now: Date, t: Translate): string {
  const open = tasks.filter((task) => task.status !== "COMPLETED");
  const overdue = open.filter((task) => isOverdue(task, now)).length;
  const today = open.filter((task) => daysUntil(task.dueDate, now) === 0).length;
  const blocked = open.filter((task) => task.status === "BLOCKED").length;

  const parts: string[] = [];
  if (overdue) parts.push(t("attention.overdue", { count: overdue }));
  if (today) parts.push(t("attention.dueToday", { count: today }));
  if (blocked) parts.push(t("attention.waiting", { count: blocked }));

  if (parts.length === 0) {
    return open.length === 0
      ? t("attention.allClear")
      : t("attention.noneOverdue", { count: open.length });
  }
  return t("attention.summary", { parts: parts.join(" · ") });
}
