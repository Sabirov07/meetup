"use client";

import { ArrowRight, CalendarClock, Plus, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ActivityView, MeetingView, MemberSummary } from "@/shared/domain/types";
import { activityMeta, meetingStatusMeta } from "@/shared/domain/labels";
import { attentionSummary } from "@/shared/domain/recommendations";
import { formatWhen, greetingFor } from "@/frontend/lib/format";
import { Avatar, AvatarStack } from "@/frontend/components/ui/avatar";
import { Badge, Count } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState, Separator } from "@/frontend/components/ui/feedback";
import { RelativeTime } from "@/frontend/components/ui/relative-time";
import { StartMeetingDialog, type GoogleState } from "@/frontend/components/meetings/start-meeting-dialog";
import { OwnerPanel, TaskDndProvider } from "@/frontend/components/tasks/task-board";
import { TaskDetailSheet } from "@/frontend/components/tasks/task-detail-sheet";
import { TaskFormDialog } from "@/frontend/components/tasks/task-form-dialog";
import { TaskToolbar } from "@/frontend/components/tasks/task-toolbar";
import { useTasks } from "@/frontend/components/tasks/task-store";
import { KpiRow } from "./kpi-row";
import { Recommendations } from "./recommendations";

export function Overview({
  member,
  counterpart,
  meetings,
  activity,
  dismissedRecommendationIds,
  pendingProposals,
  google,
}: {
  member: MemberSummary;
  counterpart: MemberSummary | null;
  meetings: MeetingView[];
  activity: ActivityView[];
  dismissedRecommendationIds: string[];
  pendingProposals: number;
  google: GoogleState;
}) {
  const { tasks, members, now, upsertTask } = useTasks();
  const [newTaskFor, setNewTaskFor] = useState<string | null | undefined>(undefined);
  const [meetingOpen, setMeetingOpen] = useState(false);

  const others = members.filter((m) => m.id !== member.id);
  const nextMeeting = meetings.find(
    (m) => m.status === "SCHEDULED" || m.status === "READY_TO_JOIN" || m.status === "IN_PROGRESS",
  );

  return (
    <TaskDndProvider>
      <div className="mx-auto w-full max-w-[100rem] space-y-4 px-3 py-4 sm:px-4 lg:px-6">
        {/* Welcome */}
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xs text-text-faint">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.025em] text-text">
              {greetingFor(now)}, {member.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-text-muted">
              {attentionSummary(tasks, now)}
              {pendingProposals > 0 && (
                <>
                  {" "}
                  <Link href="/review" className="text-accent-bright hover:underline">
                    {pendingProposals} proposed{" "}
                    {pendingProposals === 1 ? "task is" : "tasks are"} waiting for review.
                  </Link>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="lg" onClick={() => setNewTaskFor(member.id)}>
              <Plus className="h-3.5 w-3.5" />
              Create task
            </Button>
            <Button variant="primary" size="lg" onClick={() => setMeetingOpen(true)}>
              <Video className="h-3.5 w-3.5" />
              Start meeting
            </Button>
          </div>
        </section>

        <KpiRow />

        <TaskToolbar />

        {/* Workspace */}
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <OwnerPanel
              member={member}
              title="My tasks"
              subtitle={member.jobTitle ?? "Assigned to you"}
              onAdd={() => setNewTaskFor(member.id)}
              className="max-h-[38rem]"
            />

            {counterpart ? (
              <OwnerPanel
                member={counterpart}
                title={
                  others.length > 1 ? "Team tasks" : `${counterpart.name.split(" ")[0]}’s tasks`
                }
                subtitle={counterpart.jobTitle ?? "Assigned to them"}
                onAdd={() => setNewTaskFor(counterpart.id)}
                className="max-h-[38rem]"
              />
            ) : (
              <OwnerPanel
                member={null}
                title="Unassigned"
                subtitle="Waiting for an owner"
                onAdd={() => setNewTaskFor(null)}
                className="max-h-[38rem]"
              />
            )}
          </div>

          {/* Side rail */}
          <div className="flex min-w-0 flex-col gap-4">
            <Recommendations
              dismissedIds={dismissedRecommendationIds}
              className="max-h-[22rem]"
            />

            {/* Next meeting */}
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <CalendarClock className="h-3.5 w-3.5 text-text-faint" />
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
                  {nextMeeting ? "Next meeting" : "Meetings"}
                </h2>
                <Link
                  href="/meetings"
                  className="ml-auto text-2xs text-accent-bright hover:underline"
                >
                  All
                </Link>
              </header>

              {nextMeeting ? (
                <Link href={`/meetings/${nextMeeting.id}`} className="block px-3 py-2.5 hover:bg-hover">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-text">
                      {nextMeeting.title}
                    </p>
                    <Badge tone={meetingStatusMeta[nextMeeting.status].tone}>
                      {meetingStatusMeta[nextMeeting.status].label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    {formatWhen(nextMeeting.scheduledAt, now)}
                  </p>
                  {nextMeeting.participants.length > 0 && (
                    <div className="mt-2">
                      <AvatarStack
                        members={nextMeeting.participants.map((p) => ({
                          name: p.member?.name ?? p.displayName,
                          initials:
                            p.member?.initials ?? p.displayName.slice(0, 2).toUpperCase(),
                          accentToken: p.member?.accentToken ?? "slate",
                        }))}
                      />
                    </div>
                  )}
                </Link>
              ) : (
                <EmptyState
                  compact
                  icon={Video}
                  title="Nothing scheduled"
                  description="Start a meeting and its tasks will land here afterwards."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setMeetingOpen(true)}>
                      <Video className="h-3 w-3" />
                      Start meeting
                    </Button>
                  }
                />
              )}

              {pendingProposals > 0 && (
                <>
                  <Separator />
                  <Link
                    href="/review"
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-hover"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-bright" />
                    <span className="min-w-0 flex-1 text-2xs leading-4 text-text-secondary">
                      {pendingProposals} proposed{" "}
                      {pendingProposals === 1 ? "task needs" : "tasks need"} your review
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-text-faint" />
                  </Link>
                </>
              )}
            </section>

            {/* Recent activity */}
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
              <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
                  Recent activity
                </h2>
                <Link
                  href="/activity"
                  className="ml-auto text-2xs text-accent-bright hover:underline"
                >
                  All
                </Link>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="px-3 py-5 text-center text-2xs text-text-faint">
                    Nothing has happened yet.
                  </p>
                ) : (
                  activity.slice(0, 7).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 border-b border-line px-3 py-2 last:border-b-0"
                    >
                      <Avatar member={event.actor} size="sm" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs leading-4 text-text-secondary">
                          <span className="font-medium text-text">
                            {event.actor?.name.split(" ")[0] ?? "Someone"}
                          </span>{" "}
                          {event.summary}
                        </p>
                        <p className="mt-0.5 text-2xs text-text-faint">
                          <RelativeTime value={event.createdAt} />
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <TaskDetailSheet />

      <TaskFormDialog
        open={newTaskFor !== undefined}
        onOpenChange={(open) => !open && setNewTaskFor(undefined)}
        members={members}
        defaultOwnerId={newTaskFor ?? null}
        onSaved={upsertTask}
      />

      <StartMeetingDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        members={members}
        currentMemberId={member.id}
        google={google}
      />
    </TaskDndProvider>
  );
}

/** Used by the activity page header. */
export function ActivityTypeBadge({ type }: { type: ActivityView["type"] }) {
  const meta = activityMeta[type];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export { Count as OverviewCount };
