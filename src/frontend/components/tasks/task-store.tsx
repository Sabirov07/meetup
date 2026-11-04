"use client";

import { useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { deleteTask as deleteTaskAction, moveTask, updateTask } from "@/backend/actions/tasks";
import type {
  MemberSummary,
  SortMode,
  SpaceSummary,
  TaskStatusDef,
  TaskView,
} from "@/shared/domain/types";
import { BUILTIN_STATUS_DEFAULTS } from "@/shared/domain/statuses";
import { emptyFilters, type TaskFilters } from "@/shared/domain/filters";

/**
 * Holds the workspace's tasks on the client.
 *
 * Why client-side: filters, sorting and every KPI are derived from one list, so
 * a filter keystroke costs nothing and the numbers can never disagree with the
 * rows on screen. Mutations are optimistic and roll back on failure.
 *
 * `now` starts as the server's clock — so first render matches the HTML and
 * hydration is clean — then ticks every minute so "overdue" stays true on a
 * tab that has been open a while.
 */

/**
 * The query parameter that names the open task.
 *
 * A task has no page of its own: it is a drawer over whichever list you came
 * from, which is the right shape for work you glance at and close. But that
 * left it unlinkable — "look at this one" meant "go to this list and find the
 * row". A parameter keeps both: the drawer stays a drawer, and the address bar
 * always says what is open, so it can be copied, bookmarked and reloaded.
 *
 * Every task surface passes the whole workspace list to the store and filters
 * it on the client, so a link resolves on any of them, not just the one it was
 * copied from.
 */
export const TASK_PARAM = "task";

/**
 * Used only by a provider that was not handed the workspace's list — the
 * four built-ins, so nothing that lists statuses ever sees none.
 */
const FALLBACK_STATUSES: TaskStatusDef[] = BUILTIN_STATUS_DEFAULTS.map((s) => ({
  id: s.key,
  key: s.key,
  label: "",
  tone: s.tone,
  position: s.position,
  builtin: true,
}));

/**
 * A shareable link to one task.
 *
 * It points at All tasks rather than at the page it was copied from: /my-tasks
 * means "assigned to me", and for the person receiving the link that is a
 * different set. All tasks means the same thing for everyone in the workspace.
 */
export function taskLink(taskId: string): string {
  return `/all-tasks?${TASK_PARAM}=${encodeURIComponent(taskId)}`;
}

/**
 * Writes the open task into the address bar.
 *
 * `history.replaceState` rather than the router: the drawer is client state
 * that nothing on the server needs to know about, and a router navigation
 * would re-run the page for a panel that is already open. Replace rather than
 * push, so Back leaves the page the person is on instead of stepping through
 * every task they glanced at.
 */
/** The task the address bar currently names, if any. */
function currentTaskParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(TASK_PARAM);
}

function writeTaskParam(taskId: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(TASK_PARAM) === taskId) return;
  if (taskId) url.searchParams.set(TASK_PARAM, taskId);
  else url.searchParams.delete(TASK_PARAM);
  window.history.replaceState(window.history.state, "", url);
}

type TaskStore = {
  tasks: TaskView[];
  members: MemberSummary[];
  /** The workspace's sections, for the picker and the section facet. */
  spaces: SpaceSummary[];
  /** The workspace's statuses, in the order every surface shows them. */
  statuses: TaskStatusDef[];
  setStatuses: (next: TaskStatusDef[]) => void;
  currentMemberId: string;
  now: Date;

  filters: TaskFilters;
  setFilters: (next: TaskFilters | ((prev: TaskFilters) => TaskFilters)) => void;
  resetFilters: () => void;

  sort: SortMode;
  setSort: (mode: SortMode) => void;

  /** Task currently open in the detail drawer. */
  openTaskId: string | null;
  setOpenTaskId: (id: string | null) => void;

  upsertTask: (task: TaskView) => void;
  /** Optimistic owner / status change, used by drag-and-drop. */
  move: (id: string, change: { status?: TaskView["status"]; ownerMemberId?: string | null }) => void;
  patch: (id: string, change: Parameters<typeof updateTask>[0]) => void;
  remove: (id: string) => void;
};

const StoreContext = createContext<TaskStore | null>(null);

export function useTasks(): TaskStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useTasks must be used inside <TaskStoreProvider>");
  return store;
}

export function TaskStoreProvider({
  initialTasks,
  members,
  spaces = [],
  statuses: initialStatuses = FALLBACK_STATUSES,
  currentMemberId,
  serverNow,
  defaultSort = "SMART",
  initialFilters,
  children,
}: {
  initialTasks: TaskView[];
  members: MemberSummary[];
  spaces?: SpaceSummary[];
  statuses?: TaskStatusDef[];
  currentMemberId: string;
  /** ISO string from the server, so the first client render matches. */
  serverNow: string;
  defaultSort?: SortMode;
  initialFilters?: Partial<TaskFilters>;
  children: ReactNode;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [now, setNow] = useState(() => new Date(serverNow));
  const [filters, setFiltersState] = useState<TaskFilters>({
    ...emptyFilters,
    ...initialFilters,
  });
  const [sort, setSort] = useState<SortMode>(defaultSort);
  // Read on the first render, server and client alike, so a link that names a
  // task arrives with the drawer already open rather than popping it after.
  const paramTaskId = useSearchParams().get(TASK_PARAM);
  const [openTaskId, setOpenTaskIdState] = useState<string | null>(paramTaskId);

  /**
   * The URL wins whenever it changes under us.
   *
   * The initialiser alone is not enough. Moving between two task pages, or
   * following a link to the page already on screen, changes the parameter
   * without remounting this provider — so state read once at mount would stay
   * on whatever was open before, and the link would appear to do nothing. This
   * is also what makes Back and Forward work, since `useSearchParams` follows
   * the history entries written below.
   *
   * Adjusting state during render rather than in an effect, as with
   * `seededFrom` above: it re-renders before anything is painted instead of
   * flashing the wrong drawer for a frame.
   */
  const [syncedParam, setSyncedParam] = useState(paramTaskId);
  if (syncedParam !== paramTaskId) {
    setSyncedParam(paramTaskId);
    setOpenTaskIdState(paramTaskId);
  }

  const setOpenTaskId = useCallback((id: string | null) => {
    setOpenTaskIdState(id);
    writeTaskParam(id);
  }, []);

  // A server refresh (after a mutation elsewhere) hands down a new list.
  // Adjusting state during render — rather than in an effect — is React's
  // documented way to sync state with a changed prop: it re-renders before
  // anything is painted, instead of causing a second cascading render.
  const [seededFrom, setSeededFrom] = useState(initialTasks);
  if (seededFrom !== initialTasks) {
    setSeededFrom(initialTasks);
    setTasks(initialTasks);
  }
  const [seededStatuses, setSeededStatuses] = useState(initialStatuses);
  if (seededStatuses !== initialStatuses) {
    setSeededStatuses(initialStatuses);
    setStatuses(initialStatuses);
  }

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const setFilters = useCallback(
    (next: TaskFilters | ((prev: TaskFilters) => TaskFilters)) => {
      setFiltersState((prev) => (typeof next === "function" ? next(prev) : next));
    },
    [],
  );

  const resetFilters = useCallback(() => setFiltersState(emptyFilters), []);

  const upsertTask = useCallback((task: TaskView) => {
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === task.id);
      if (index === -1) return [task, ...prev];
      const next = [...prev];
      next[index] = task;
      return next;
    });
  }, []);

  /**
   * Applies the change immediately, then reconciles with the server. On
   * failure the previous snapshot is restored, so the board never shows a
   * state the database rejected.
   */
  const move = useCallback<TaskStore["move"]>((id, change) => {
    let snapshot: TaskView[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return prev.map((task) => {
        if (task.id !== id) return task;
        const owner =
          change.ownerMemberId === undefined
            ? task.owner
            : (members.find((m) => m.id === change.ownerMemberId) ?? null);
        return {
          ...task,
          status: change.status ?? task.status,
          owner,
          completedAt:
            change.status === "COMPLETED"
              ? (task.completedAt ?? new Date().toISOString())
              : change.status
                ? null
                : task.completedAt,
          updatedAt: new Date().toISOString(),
        };
      });
    });

    void moveTask({ id, ...change }).then((result) => {
      if (result.ok) {
        upsertTask(result.data);
      } else {
        setTasks(snapshot);
        toast.error("Could not move that task", { description: result.error });
      }
    });
    // `members` is stable for the lifetime of a workspace render.
  }, [members, upsertTask]);

  const patch = useCallback<TaskStore["patch"]>(
    (id, change) => {
      void updateTask(change).then((result) => {
        if (result.ok) upsertTask(result.data);
        else toast.error("Could not save that change", { description: result.error });
      });
      void id;
    },
    [upsertTask],
  );

  const remove = useCallback((id: string) => {
    let snapshot: TaskView[] = [];
    setTasks((prev) => {
      snapshot = prev;
      return prev.filter((t) => t.id !== id);
    });
    setOpenTaskIdState((current) => (current === id ? null : current));
    // The address bar is the other half of that state, and it can answer
    // "was this the open one?" without a dependency on the id.
    if (currentTaskParam() === id) writeTaskParam(null);

    void deleteTaskAction(id).then((result) => {
      if (result.ok) {
        toast.success("Task deleted");
      } else {
        setTasks(snapshot);
        toast.error("Could not delete that task", { description: result.error });
      }
    });
  }, []);

  const value = useMemo<TaskStore>(
    () => ({
      tasks,
      members,
      spaces,
      statuses,
      setStatuses,
      currentMemberId,
      now,
      filters,
      setFilters,
      resetFilters,
      sort,
      setSort,
      openTaskId,
      setOpenTaskId,
      upsertTask,
      move,
      patch,
      remove,
    }),
    [
      tasks,
      members,
      spaces,
      statuses,
      currentMemberId,
      now,
      filters,
      setFilters,
      resetFilters,
      sort,
      openTaskId,
      setOpenTaskId,
      upsertTask,
      move,
      patch,
      remove,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
