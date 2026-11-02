"use client";

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
  TaskView,
} from "@/shared/domain/types";
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

type TaskStore = {
  tasks: TaskView[];
  members: MemberSummary[];
  /** The workspace's sections, for the picker and the section facet. */
  spaces: SpaceSummary[];
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
  currentMemberId,
  serverNow,
  defaultSort = "SMART",
  initialFilters,
  children,
}: {
  initialTasks: TaskView[];
  members: MemberSummary[];
  spaces?: SpaceSummary[];
  currentMemberId: string;
  /** ISO string from the server, so the first client render matches. */
  serverNow: string;
  defaultSort?: SortMode;
  initialFilters?: Partial<TaskFilters>;
  children: ReactNode;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [now, setNow] = useState(() => new Date(serverNow));
  const [filters, setFiltersState] = useState<TaskFilters>({
    ...emptyFilters,
    ...initialFilters,
  });
  const [sort, setSort] = useState<SortMode>(defaultSort);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // A server refresh (after a mutation elsewhere) hands down a new list.
  // Adjusting state during render — rather than in an effect — is React's
  // documented way to sync state with a changed prop: it re-renders before
  // anything is painted, instead of causing a second cascading render.
  const [seededFrom, setSeededFrom] = useState(initialTasks);
  if (seededFrom !== initialTasks) {
    setSeededFrom(initialTasks);
    setTasks(initialTasks);
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
    setOpenTaskId((current) => (current === id ? null : current));

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
      currentMemberId,
      now,
      filters,
      setFilters,
      resetFilters,
      sort,
      openTaskId,
      upsertTask,
      move,
      patch,
      remove,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
