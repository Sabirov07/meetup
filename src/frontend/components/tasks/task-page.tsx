"use client";

import { LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { applyFilters } from "@/shared/domain/filters";
import { isOverdue } from "@/shared/domain/priority";
import type {
  MemberSummary,
  TaskPriority,
  TaskStatus,
} from "@/shared/domain/types";
import type { TranslationKey } from "@/shared/i18n";
import { useT } from "@/frontend/i18n";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Button } from "@/frontend/components/ui/button";
import { Tooltip } from "@/frontend/components/ui/feedback";
import { cn } from "@/frontend/lib/utils";
import { StatusColumns, TaskDndProvider } from "./task-board";
import { TaskDetailSheet } from "./task-detail-sheet";
import { useCreateActions } from "@/frontend/components/shell/create-actions";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskTable } from "./task-table";
import { TaskToolbar } from "./task-toolbar";
import { useTasks } from "./task-store";

/**
 * Shared layout for the three task surfaces (mine, theirs, everyone).
 *
 * The same tasks are shown either as a kanban over the four statuses or as a
 * table grouped by status. The list is the default: a board column is about
 * 220px wide on a laptop, which clips most real titles, and people scanning a
 * backlog read titles first. The board is a click away for anyone who plans by
 * dragging.
 *
 * The owner scope is fixed per page, so dragging between columns changes
 * status and never silently reassigns — reassignment happens in the list's
 * assignee cell, the row menu, or the drawer.
 */

const VIEWS = ["LIST", "BOARD"] as const;
type View = (typeof VIEWS)[number];

const STORAGE_KEY = "meetup.tasks.view";

/** The list wins by default: see the note on `TaskPage`. */
const DEFAULT_VIEW: View = "LIST";

/** Fields a new task inherits from wherever the "+" was clicked. */
type NewTaskDefaults = {
  status?: TaskStatus;
  ownerMemberId?: string | null;
  priority?: TaskPriority;
};

export function TaskPage({
  heading,
  headingName,
  description,
  /** Member id, `UNASSIGNED`, or undefined for every task. */
  ownerFilter,
  owner,
  meetings,
}: {
  /**
   * Keys rather than text: the page above is a server component, so a sentence
   * chosen there would be frozen in the language of that request and would sit
   * out the next language switch.
   */
  heading: TranslationKey;
  headingName?: string;
  description: TranslationKey;
  ownerFilter?: string;
  owner?: MemberSummary | null;
  meetings: { id: string; title: string }[];
}) {
  const { tasks, members, now, filters, upsertTask } = useTasks();
  const t = useT();
  const createActions = useCreateActions();
  const [newTask, setNewTask] = useState<NewTaskDefaults | null>(null);
  const [view, setView] = useView();

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
                {t(heading, headingName ? { name: headingName } : undefined)}
              </h1>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-text-muted">{t(description)}</p>
            {/* Global counts stay distinct from the filtered count. */}
            <p className="mt-1 text-2xs text-text-faint">
              {t("tasks.counts.open", { count: open.length })} ·{" "}
              {t("tasks.counts.total", { count: scoped.length })}
              {overdue > 0 && (
                <span className="text-danger">
                  {" "}
                  · {t("tasks.counts.overdue", { count: overdue })}
                </span>
              )}
              {isFiltered && (
                <span className="text-accent-bright">
                  {" "}
                  · {t("tasks.counts.matching", { count: matching.length })}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ViewSwitch value={view} onChange={setView} />
            <Button
              variant="primary"
              size="lg"
              onClick={() => setNewTask({ status: "TODO" })}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("header.newTask")}
            </Button>
          </div>
        </header>

        <TaskToolbar meetings={meetings} showOwnerFilter={ownerFilter === undefined} />

        {view === "LIST" ? (
          <TaskTable ownerFilter={ownerFilter} onAdd={setNewTask} />
        ) : (
          <StatusColumns
            ownerFilter={ownerFilter}
            showOwner={ownerFilter === undefined}
            onAdd={(status) => setNewTask({ status })}
          />
        )}
      </div>

      <TaskDetailSheet />

      <TaskFormDialog
        open={newTask !== null}
        onOpenChange={(value) => !value && setNewTask(null)}
        members={members}
        defaultOwnerId={
          newTask?.ownerMemberId !== undefined
            ? newTask.ownerMemberId
            : ownerFilter === "UNASSIGNED"
              ? null
              : (ownerFilter ?? null)
        }
        defaultStatus={newTask?.status}
        defaultPriority={newTask?.priority}
        onSaved={upsertTask}
        onDescribeTasks={createActions?.describeTasks}
      />
    </TaskDndProvider>
  );
}

/**
 * The choice is a preference, not a route: it follows the person across the
 * three task pages and survives a reload.
 *
 * `localStorage` is an external store, so it is read through
 * `useSyncExternalStore`: the server has no access to it, and reading it
 * during the first client render would contradict the HTML. This hydrates
 * with the default and swaps in the stored view immediately afterwards,
 * without the cascading render an effect would cost.
 */
const viewStore = (() => {
  const listeners = new Set<() => void>();
  let cached: View | null = null;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    read(): View {
      if (cached) return cached;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        cached = stored === "LIST" || stored === "BOARD" ? stored : DEFAULT_VIEW;
      } catch {
        // Private browsing, or storage disabled. The default is fine.
        cached = DEFAULT_VIEW;
      }
      return cached;
    },
    readOnServer: (): View => DEFAULT_VIEW,
    write(next: View) {
      cached = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not being able to remember the choice must not break making it.
      }
      for (const listener of listeners) listener();
    },
  };
})();

function useView(): [View, (next: View) => void] {
  const view = useSyncExternalStore(
    viewStore.subscribe,
    viewStore.read,
    viewStore.readOnServer,
  );
  return [view, viewStore.write];
}

const viewMeta: Record<
  View,
  { label: TranslationKey; icon: typeof List; hint: TranslationKey }
> = {
  LIST: { label: "tasks.view.list", icon: List, hint: "tasks.view.listHint" },
  BOARD: { label: "tasks.view.board", icon: LayoutGrid, hint: "tasks.view.boardHint" },
};

function ViewSwitch({ value, onChange }: { value: View; onChange: (next: View) => void }) {
  const t = useT();

  return (
    <div
      role="group"
      aria-label={t("tasks.view.label")}
      className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
    >
      {VIEWS.map((option) => {
        const { label, icon: Icon, hint } = viewMeta[option];
        const active = value === option;
        return (
          // The hint goes in a tooltip rather than a `title`: `title` replaces
          // the accessible name, so the button would announce the explanation
          // instead of "List" or "Board".
          <Tooltip key={option} content={t(hint)}>
            <button
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
                active
                  ? "bg-raised text-text"
                  : "text-text-muted hover:bg-hover hover:text-text",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(label)}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
