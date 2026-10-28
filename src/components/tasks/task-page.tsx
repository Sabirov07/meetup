"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { applyFilters } from "@/lib/domain/filters";
import { isOverdue } from "@/lib/domain/priority";
import type { MemberSummary, TaskStatus } from "@/lib/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusColumns, TaskDndProvider } from "./task-board";
import { TaskDetailSheet } from "./task-detail-sheet";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskToolbar } from "./task-toolbar";
import { useTasks } from "./task-store";

/**
 * Shared layout for the three task surfaces (mine, theirs, everyone).
 *
 * Each is a kanban over the four statuses. The owner scope is fixed per page,
 * so dragging between columns changes status and never silently reassigns —
 * reassignment happens on the dashboard, in the row menu, or in the drawer.
 */
export function TaskPage({
  heading,
  description,
  /** Member id, `UNASSIGNED`, or undefined for every task. */
  ownerFilter,
  owner,
  meetings,
}: {
  heading: string;
  description: string;
  ownerFilter?: string;
  owner?: MemberSummary | null;
  meetings: { id: string; title: string }[];
}) {
  const { tasks, members, now, filters, upsertTask } = useTasks();
  const [newTask, setNewTask] = useState<{ status: TaskStatus } | null>(null);

  const scoped = useMemo(
    () =>
      ownerFilter === undefined
        ? tasks
        : tasks.filter((t) => (t.owner?.id ?? "UNASSIGNED") === ownerFilter),
    [tasks, ownerFilter],
  );

  const open = scoped.filter((t) => t.status !== "COMPLETED");
  const overdue = scoped.filter((t) => isOverdue(t, now)).length;
  const matching = useMemo(
    () => applyFilters(scoped, { ...filters, includeCompleted: true }, now),
    [scoped, filters, now],
  );
  const isFiltered = matching.length !== scoped.length;

  return (
    <TaskDndProvider>
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {owner && <Avatar member={owner} size="lg" />}
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-text">
                {heading}
              </h1>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-text-muted">
              {description}
            </p>
            {/* Global counts stay distinct from the filtered count. */}
            <p className="mt-1 text-2xs text-text-faint">
              {open.length} open · {scoped.length} total
              {overdue > 0 && <span className="text-danger"> · {overdue} overdue</span>}
              {isFiltered && (
                <span className="text-accent-bright">
                  {" "}
                  · {matching.length} match the current filters
                </span>
              )}
            </p>
          </div>

          <Button variant="primary" size="lg" onClick={() => setNewTask({ status: "TODO" })}>
            <Plus className="h-3.5 w-3.5" />
            New task
          </Button>
        </header>

        <TaskToolbar meetings={meetings} showOwnerFilter={ownerFilter === undefined} />

        <StatusColumns
          ownerFilter={ownerFilter}
          showOwner={ownerFilter === undefined}
          onAdd={(status) => setNewTask({ status })}
        />
      </div>

      <TaskDetailSheet />

      <TaskFormDialog
        open={newTask !== null}
        onOpenChange={(value) => !value && setNewTask(null)}
        members={members}
        defaultOwnerId={ownerFilter === "UNASSIGNED" ? null : (ownerFilter ?? null)}
        defaultStatus={newTask?.status}
        onSaved={upsertTask}
      />
    </TaskDndProvider>
  );
}
