"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import type { ActivityView as ActivityEvent, MemberSummary, TaskView } from "@/lib/domain/types";
import { activityMeta } from "@/lib/domain/labels";
import { computeStats } from "@/lib/domain/stats";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Count } from "@/components/ui/badge";
import { EmptyState, Progress, SegmentBar } from "@/components/ui/feedback";
import { RelativeTime } from "@/components/ui/relative-time";

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
  // Activity is historical, so a single render-time clock is fine here.
  const [now] = useState(() => new Date());
  const stats = useMemo(() => computeStats(tasks, members, now), [tasks, members, now]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>();
    for (const event of events) {
      const key = new Date(event.createdAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()];
  }, [events]);

  function dayLabel(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date(now).toDateString();
    const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
    if (dateString === today) return "Today";
    if (dateString === yesterday) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
      <header className="min-w-0">
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">Activity</h1>
        <p className="mt-1 text-[13px] leading-5 text-text-muted">
          Everything that has changed, and how the workspace is tracking.
        </p>
      </header>

      {/* Progress */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Completion</p>
            <p className="tnum text-base font-semibold text-text">{stats.completionRate}%</p>
          </div>
          <Progress
            value={stats.completionRate}
            tone="bg-success"
            className="mt-2"
            aria-label="Overall completion rate"
          />
          <p className="mt-1.5 text-2xs text-text-muted">
            {stats.completed} of {stats.completed + stats.totalOpen} tasks done
            {stats.completedThisWeek > 0 && ` · ${stats.completedThisWeek} this week`}
          </p>

          <div className="mt-3 space-y-1">
            <p className="eyebrow">Status mix</p>
            <SegmentBar
              aria-label="Status distribution"
              segments={[
                { label: "Completed", value: stats.completed, tone: "bg-success" },
                { label: "In progress", value: stats.inProgress, tone: "bg-accent" },
                { label: "Waiting", value: stats.waiting, tone: "bg-warning" },
                {
                  label: "To do",
                  value: Math.max(0, stats.totalOpen - stats.inProgress - stats.waiting),
                  tone: "bg-line-strong",
                },
              ]}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-2xs text-text-faint">
              <span>{stats.inProgress} in progress</span>
              <span>{stats.waiting} waiting</span>
              <span className={stats.overdue > 0 ? "text-danger" : undefined}>
                {stats.overdue} overdue
              </span>
              <span>{stats.dueToday} due today</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="eyebrow">Open work by owner</p>
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
                    <span className="tnum shrink-0 text-2xs text-text">{open} open</span>
                    {overdue > 0 && (
                      <span className="tnum shrink-0 text-2xs text-danger">{overdue} late</span>
                    )}
                  </div>
                  <Progress
                    value={total === 0 ? 0 : (completed / total) * 100}
                    tone="bg-success"
                    className="mt-1"
                    aria-label={`${member.name} completion`}
                  />
                </div>
              );
            })}

            {stats.unassignedOpen > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
                <Avatar member={null} size="sm" />
                <span className="min-w-0 flex-1 text-2xs text-text-muted">Unassigned</span>
                <span className="tnum text-2xs text-warning">{stats.unassignedOpen} open</span>
              </div>
            )}
          </div>

          {stats.needsReview > 0 && (
            <Link
              href="/all-tasks"
              className="mt-3 block text-2xs text-accent-bright hover:underline"
            >
              {stats.needsReview} {stats.needsReview === 1 ? "task needs" : "tasks need"} an
              owner or deadline decision
            </Link>
          )}
        </div>
      </section>

      {/* Feed */}
      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
          <History className="h-3.5 w-3.5 text-text-faint" />
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">History</h2>
          <Count className="ml-auto">{events.length}</Count>
        </div>

        {events.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing has happened yet"
            description="Task changes, meetings and approved proposals all show up here."
          />
        ) : (
          grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="sticky top-12 z-10 border-b border-line bg-canvas/85 px-3.5 py-1.5 text-2xs font-medium text-text-muted backdrop-blur-sm">
                {dayLabel(day)}
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
                          {event.actor?.name ?? "Someone"}
                        </span>{" "}
                        {event.summary}
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
                            View meeting
                          </Link>
                        )}
                      </div>
                    </div>
                    <span className={cn("shrink-0 pt-0.5")}>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
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
