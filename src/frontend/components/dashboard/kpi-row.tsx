"use client";

import Link from "next/link";
import { useMemo } from "react";
import { computeStats } from "@/shared/domain/stats";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { SegmentBar } from "@/frontend/components/ui/feedback";
import { useTasks } from "@/frontend/components/tasks/task-store";

/**
 * KPI strip.
 *
 * One bordered container with divided cells rather than seven separate cards —
 * at this density the numbers read as a single dashboard instead of a grid of
 * boxes. Every figure is derived from the live client task list, so it can
 * never disagree with the rows below it, and it updates the moment a task
 * moves.
 */
export function KpiRow() {
  const { tasks, members, currentMemberId, now, setFilters } = useTasks();
  const t = useT();

  const stats = useMemo(() => computeStats(tasks, members, now), [tasks, members, now]);

  const mine = stats.byMember.find((m) => m.member.id === currentMemberId);
  const others = stats.byMember.filter((m) => m.member.id !== currentMemberId);
  const theirs = others.length === 1 ? others[0] : null;

  const cells: {
    /** Already translated: several are a person's name rather than a key. */
    label: string;
    value: number;
    hint?: string;
    tone?: string;
    onClick?: () => void;
    /** Hidden on narrow screens to keep the strip to one line. */
    secondary?: boolean;
  }[] = [
    {
      label: t("kpi.open"),
      value: stats.totalOpen,
      hint: t("kpi.completeHint", { percent: stats.completionRate }),
      onClick: () => setFilters((prev) => ({ ...prev, statuses: [], includeCompleted: false })),
    },
    {
      label: t("kpi.mine"),
      value: mine?.open ?? 0,
      hint:
        mine && mine.overdue > 0 ? t("kpi.overdueHint", { count: mine.overdue }) : undefined,
      tone: mine && mine.overdue > 0 ? "text-danger" : undefined,
      onClick: () => setFilters((prev) => ({ ...prev, owners: [currentMemberId] })),
    },
    ...(theirs
      ? [
          {
            label: theirs.member.name.split(" ")[0] ?? t("kpi.theirs"),
            value: theirs.open,
            hint:
              theirs.overdue > 0 ? t("kpi.overdueHint", { count: theirs.overdue }) : undefined,
            tone: theirs.overdue > 0 ? "text-danger" : undefined,
            onClick: () => setFilters((prev) => ({ ...prev, owners: [theirs.member.id] })),
          },
        ]
      : [
          {
            label: t("kpi.others"),
            value: others.reduce((sum, o) => sum + o.open, 0),
            onClick: () =>
              setFilters((prev) => ({ ...prev, owners: others.map((o) => o.member.id) })),
          },
        ]),
    // The four above are always visible; the four below appear from `sm`.
    // Keeping both counts a multiple of the column count is what stops the
    // grid ending in a half-empty row.
    {
      label: t("kpi.overdue"),
      value: stats.overdue,
      tone: stats.overdue > 0 ? "text-danger" : undefined,
      onClick: () => setFilters((prev) => ({ ...prev, dueWindow: "OVERDUE" })),
    },
    {
      label: t("kpi.inProgress"),
      value: stats.inProgress,
      onClick: () => setFilters((prev) => ({ ...prev, statuses: ["IN_PROGRESS"] })),
      secondary: true,
    },
    {
      label: t("kpi.waiting"),
      value: stats.waiting,
      tone: stats.waiting > 0 ? "text-warning" : undefined,
      onClick: () => setFilters((prev) => ({ ...prev, waitingOnSomeoneOnly: true })),
      secondary: true,
    },
    {
      label: t("kpi.dueToday"),
      value: stats.dueToday,
      onClick: () => setFilters((prev) => ({ ...prev, dueWindow: "TODAY" })),
      secondary: true,
    },
    {
      label: t("kpi.completed"),
      value: stats.completed,
      hint:
        stats.completedThisWeek > 0
          ? t("kpi.thisWeek", { count: stats.completedThisWeek })
          : undefined,
      onClick: () =>
        setFilters((prev) => ({ ...prev, statuses: ["COMPLETED"], includeCompleted: true })),
      secondary: true,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* The negative margins push the trailing row/column borders under the
          container's own rounded border, so no cell ends in a stray hairline. */}
      <div className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-4 lg:m-0 lg:flex lg:divide-x lg:divide-line">
        {cells.map((cell) => (
          <button
            key={cell.label}
            onClick={cell.onClick}
            className={cn(
              "group min-w-0 flex-1 border-b border-r border-line px-3 py-2.5 text-left transition-colors hover:bg-hover lg:border-0",
              cell.secondary && "hidden sm:block",
            )}
          >
            <p className="truncate text-2xs text-text-muted">{cell.label}</p>
            <p
              className={cn(
                "tnum mt-0.5 text-lg font-semibold leading-6 tracking-[-0.02em]",
                cell.tone ?? "text-text",
              )}
            >
              {cell.value}
            </p>
            <p
              className={cn(
                "truncate text-2xs",
                cell.tone ? cell.tone : "text-text-faint",
              )}
            >
              {cell.hint ?? " "}
            </p>
          </button>
        ))}
      </div>

      {/* Status mix across the whole workspace. */}
      <div className="border-t border-line px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between text-2xs">
          <span className="text-text-muted">{t("kpi.workspaceProgress")}</span>
          <Link href="/activity" className="text-accent-bright hover:underline">
            {t("kpi.completeHint", { percent: stats.completionRate })}
          </Link>
        </div>
        <SegmentBar
          aria-label={t("kpi.statusDistribution")}
          segments={[
            { label: t("status.COMPLETED.label"), value: stats.completed, tone: "bg-success" },
            { label: t("status.IN_PROGRESS.label"), value: stats.inProgress, tone: "bg-accent" },
            { label: t("status.BLOCKED.short"), value: stats.waiting, tone: "bg-warning" },
            {
              label: t("status.TODO.label"),
              value: Math.max(0, stats.totalOpen - stats.inProgress - stats.waiting),
              tone: "bg-line-strong",
            },
          ]}
        />
      </div>
    </div>
  );
}
