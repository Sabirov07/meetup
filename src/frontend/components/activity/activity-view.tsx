"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import type { ActivityView as ActivityEvent, MemberSummary, TaskView } from "@/shared/domain/types";
import { activityMeta } from "@/shared/domain/labels";
import { computeStats } from "@/shared/domain/stats";
import { useI18n } from "@/frontend/i18n";
import { useActivityLine } from "./activity-line";

import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Count } from "@/frontend/components/ui/badge";
import { EmptyState, Progress, SegmentBar } from "@/frontend/components/ui/feedback";
import { RelativeTime } from "@/frontend/components/ui/relative-time";

/**
 * Activity and progress.
 *
 * Deliberately metric-and-bar driven rather than chart driven: for a workspace
 * this size, "7 of 19 done, 3 overdue, 2 waiting on someone else" is more
 * actionable than a time series, and every figure here is computed from the
 * same task rows the boards render.
 */
export function ActivityView({
  events,
  tasks,
  members,
}: {
  events: ActivityEvent[];
  tasks: TaskView[];
  members: MemberSummary[];
}) {
  const { t, f } = useI18n();
  // Activity is historical, so a single render-time clock is fine here.
  const [now] = useState(() => new Date());
  const stats = useMemo(() => computeStats(tasks, members, now), [tasks, members, now]);

  const titles = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  const activityLine = useActivityLine(titles);

  const grouped = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>();
    for (const event of events) {
      const key = new Date(event.createdAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()];
  }, [events]);

  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <header className="min-w-0">
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">
          {t("activity.heading")}
        </h1>
        <p className="mt-1 text-[13px] leading-5 text-text-muted">
          {t("activity.description")}
        </p>
      </header>

      {/* Progress */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">{t("activity.completion")}</p>
            <p className="tnum text-base font-semibold text-text">{stats.completionRate}%</p>
          </div>
          <Progress
            value={stats.completionRate}
            tone="bg-success"
            className="mt-2"
            aria-label={t("activity.completionRate")}
          />
          <p className="mt-1.5 text-2xs text-text-muted">
            {t("activity.doneOfTotal", {
              done: stats.completed,
              total: stats.completed + stats.totalOpen,
            })}
            {stats.completedThisWeek > 0 &&
              ` · ${t("activity.doneThisWeek", { count: stats.completedThisWeek })}`}
          </p>

          <div className="mt-3 space-y-1">
            <p className="eyebrow">{t("activity.statusMix")}</p>
            <SegmentBar
              aria-label={t("activity.statusDistribution")}
              segments={[
                { label: t("status.COMPLETED.label"), value: stats.completed, tone: "bg-success" },
                {
                  label: t("status.IN_PROGRESS.label"),
                  value: stats.inProgress,
                  tone: "bg-accent",
                },
                { label: t("status.BLOCKED.short"), value: stats.waiting, tone: "bg-warning" },
                {
                  label: t("status.TODO.label"),
                  value: Math.max(0, stats.totalOpen - stats.inProgress - stats.waiting),
                  tone: "bg-line-strong",
                },
              ]}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-2xs text-text-faint">
              <span>{t("activity.inProgressCount", { count: stats.inProgress })}</span>
              <span>{t("activity.waitingCount", { count: stats.waiting })}</span>
              <span className={stats.overdue > 0 ? "text-danger" : undefined}>
                {t("activity.overdueCount", { count: stats.overdue })}
              </span>
              <span>{t("activity.dueTodayCount", { count: stats.dueToday })}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="eyebrow">{t("activity.openByAssignee")}</p>
          <div className="mt-2.5 space-y-2.5">
            {stats.byMember.map(({ member, open, overdue, completed }) => {
              const total = open + completed;
              return (
                <div key={member.id}>
                  <div className="flex items-center gap-2">
                    <Avatar member={member} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-2xs text-text-secondary">
                      {member.name}
                    </span>
                    <span className="tnum shrink-0 text-2xs text-text">
                      {t("activity.openCount", { count: open })}
                    </span>
                    {overdue > 0 && (
                      <span className="tnum shrink-0 text-2xs text-danger">
                        {t("activity.lateCount", { count: overdue })}
                      </span>
                    )}
                  </div>
                  <Progress
                    value={total === 0 ? 0 : (completed / total) * 100}
                    tone="bg-success"
                    className="mt-1"
                    aria-label={t("activity.memberCompletion", { name: member.name })}
                  />
                </div>
              );
            })}

            {stats.unassignedOpen > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
                <Avatar member={null} size="sm" />
                <span className="min-w-0 flex-1 text-2xs text-text-muted">
                  {t("common.unassigned")}
                </span>
                <span className="tnum text-2xs text-warning">
                  {t("activity.openCount", { count: stats.unassignedOpen })}
                </span>
              </div>
            )}
          </div>

          {stats.needsReview > 0 && (
            <Link
              href="/all-tasks"
              className="mt-3 block text-2xs text-accent-bright hover:underline"
            >
              {t("activity.needsDecision", { count: stats.needsReview })}
            </Link>
          )}
        </div>
      </section>

      {/* Feed */}
      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
          <History className="h-3.5 w-3.5 text-text-faint" />
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
            {t("activity.history")}
          </h2>
          <Count className="ml-auto">{events.length}</Count>
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("activity.empty.title")}
            description={t("activity.empty.description")}
          />
        ) : (
          grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="sticky top-12 z-10 border-b border-line bg-canvas/85 px-3.5 py-1.5 text-2xs font-medium text-text-muted backdrop-blur-sm">
                {f.dayHeading(day, now)}
              </p>
              {dayEvents.map((event) => {
                const meta = activityMeta[event.type];
                const change =
                  event.metadata && typeof event.metadata.from === "string"
                    ? `${String(event.metadata.from)} → ${String(event.metadata.to)}`
                    : null;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 border-b border-line px-3.5 py-2 last:border-b-0"
                  >
                    <Avatar member={event.actor} size="md" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs leading-5 text-text-secondary">
                        <span className="font-medium text-text">
                          {event.actor?.name ?? t("activity.someone")}
                        </span>{" "}
                        {activityLine(event)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs text-text-faint">
                          <RelativeTime value={event.createdAt} />
                        </span>
                        {change && (
                          <span className="rounded-[4px] bg-raised px-1 font-mono text-2xs text-text-faint">
                            {change}
                          </span>
                        )}
                        {event.meetingId && (
                          <Link
                            href={`/meetings/${event.meetingId}`}
                            className="text-2xs text-accent-bright hover:underline"
                          >
                            {t("activity.viewMeeting")}
                          </Link>
                        )}
                      </div>
                    </div>
                    <span className={cn("shrink-0 pt-0.5")}>
                      <Badge tone={meta.tone}>{t(`activity.${event.type}.label`)}</Badge>
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
