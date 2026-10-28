"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Inbox, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { reorderTasks } from "@/lib/actions/tasks";
import { TASK_STATUSES, type MemberSummary, type TaskStatus, type TaskView } from "@/lib/domain/types";
import { statusMeta } from "@/lib/domain/labels";
import { applyFilters } from "@/lib/domain/filters";
import { sortTasks } from "@/lib/domain/priority";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Count, Dot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { useTasks } from "./task-store";
import { TaskDragPreview, TaskRow } from "./task-row";

/**
 * Drag-and-drop model.
 *
 * Every drop target is a zone identified by `zone:<owner>:<status>`, where
 * `owner` is a member id, `UNASSIGNED`, or `ANY` (meaning "do not touch the
 * owner"). Owner panels emit zones with a concrete owner; status columns emit
 * `ANY`. One drop handler therefore covers reassignment, status changes, and
 * manual reordering, and a move is always an update — never a copy.
 */

const ANY_OWNER = "ANY";
const UNASSIGNED = "UNASSIGNED";

function zoneId(owner: string, status: TaskStatus): string {
  return `zone:${owner}:${status}`;
}

function parseZone(id: string): { owner: string; status: TaskStatus } | null {
  if (!id.startsWith("zone:")) return null;
  const [, owner, status] = id.split(":");
  if (!owner || !status) return null;
  if (!TASK_STATUSES.includes(status as TaskStatus)) return null;
  return { owner, status: status as TaskStatus };
}

// ---------------------------------------------------------------------------
// Context provider
// ---------------------------------------------------------------------------

export function TaskDndProvider({ children }: { children: ReactNode }) {
  const { tasks, move, sort, upsertTask } = useTasks();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    // 5px of travel before a drag starts, so a click still selects the row.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const dragging = draggingId ? tasks.find((t) => t.id === draggingId) : null;

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = String(over.id);
    const zone = parseZone(overId);

    // Dropped onto another task: inherit that task's group.
    const overTask = zone ? null : tasks.find((t) => t.id === overId);
    if (!zone && !overTask) return;

    const targetStatus = zone?.status ?? overTask!.status;
    const targetOwnerRaw = zone
      ? zone.owner
      : // A task target only implies an owner inside owner panels, which is
        // signalled by the active item's own container data.
        (over.data.current?.ownerScope as string | undefined) ?? ANY_OWNER;

    const currentOwnerId = task.owner?.id ?? UNASSIGNED;
    const statusChanged = targetStatus !== task.status;
    const ownerChanged =
      targetOwnerRaw !== ANY_OWNER && targetOwnerRaw !== currentOwnerId;

    // Pure reorder inside the same group, and only while the user has chosen
    // manual order — otherwise a drag would be silently undone by re-sorting.
    if (!statusChanged && !ownerChanged) {
      if (sort !== "MANUAL" || !overTask || overTask.id === task.id) return;

      const siblings = tasks
        .filter(
          (t) =>
            t.status === task.status &&
            (t.owner?.id ?? UNASSIGNED) === currentOwnerId,
        )
        .sort((a, b) => (a.manualOrder ?? Infinity) - (b.manualOrder ?? Infinity));

      const from = siblings.findIndex((t) => t.id === task.id);
      const to = siblings.findIndex((t) => t.id === overTask.id);
      if (from === -1 || to === -1) return;

      const ordered = arrayMove(siblings, from, to);
      ordered.forEach((t, index) => {
        upsertTask({ ...t, manualOrder: (index + 1) * 100 });
      });

      void reorderTasks(ordered.map((t) => t.id)).then((result) => {
        if (!result.ok) toast.error("Could not save that order", { description: result.error });
      });
      return;
    }

    move(task.id, {
      ...(statusChanged ? { status: targetStatus } : {}),
      ...(ownerChanged
        ? { ownerMemberId: targetOwnerRaw === UNASSIGNED ? null : targetOwnerRaw }
        : {}),
    });
  }

  return (
    <DndContext
      // Without a stable id, dnd-kit generates a different `aria-describedby`
      // on the server than on the client and React reports a hydration
      // mismatch on every board.
      id="meetup-task-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging ? <TaskDragPreview task={dragging} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

function Zone({
  owner,
  status,
  tasks,
  showOwner,
  emptyHint,
  onAdd,
  className,
  children,
}: {
  owner: string;
  status: TaskStatus;
  tasks: TaskView[];
  showOwner: boolean;
  emptyHint?: string;
  onAdd?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const id = zoneId(owner, status);
  const { setNodeRef, isOver } = useDroppable({ id, data: { ownerScope: owner, status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors",
        isOver && "bg-accent-dim/35 ring-1 ring-inset ring-line-accent",
        className,
      )}
    >
      {children}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} showOwner={showOwner} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 px-3 py-4 text-2xs",
            isOver ? "text-accent-bright" : "text-text-faint",
          )}
        >
          {isOver ? (
            "Drop here"
          ) : (
            <>
              <span>{emptyHint ?? "Nothing here"}</span>
              {onAdd && (
                <button
                  onClick={onAdd}
                  className="rounded-[4px] px-1 text-accent-bright hover:bg-hover"
                >
                  Add one
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusHeading({ status, count }: { status: TaskStatus; count: number }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-line bg-canvas/40 px-2.5 py-1.5">
      <Dot tone={statusMeta[status].tone} />
      <span className="text-2xs font-medium text-text-secondary">{statusMeta[status].label}</span>
      <Count className="ml-auto">{count}</Count>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner panel — one person's board, grouped by status
// ---------------------------------------------------------------------------

export function OwnerPanel({
  member,
  title,
  subtitle,
  onAdd,
  /** Only these statuses get a section; others are hidden when empty. */
  className,
}: {
  member: MemberSummary | null;
  title?: string;
  subtitle?: string;
  onAdd?: () => void;
  className?: string;
}) {
  const { tasks, filters, sort, now } = useTasks();
  const ownerKey = member?.id ?? UNASSIGNED;

  const visible = useMemo(() => {
    const mine = tasks.filter((t) => (t.owner?.id ?? UNASSIGNED) === ownerKey);
    return sortTasks(applyFilters(mine, filters, now), sort, now);
  }, [tasks, filters, sort, now, ownerKey]);

  const openCount = visible.filter((t) => t.status !== "COMPLETED").length;

  const grouped = TASK_STATUSES.map((status) => ({
    status,
    items: visible.filter((t) => t.status === status),
  }));

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        {member ? <Avatar member={member} size="lg" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
              {title ?? member?.name ?? "Unassigned"}
            </h2>
            <Count>{openCount}</Count>
          </div>
          <p className="truncate text-2xs text-text-faint">
            {subtitle ?? member?.jobTitle ?? "No owner yet"}
          </p>
        </div>
        {onAdd && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onAdd}
            aria-label={`Add a task for ${title ?? member?.name ?? "nobody"}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <Zone owner={ownerKey} status="TODO" tasks={[]} showOwner={false}>
            <EmptyState
              compact
              icon={Inbox}
              title="Nothing to show"
              description={
                tasks.some((t) => (t.owner?.id ?? UNASSIGNED) === ownerKey)
                  ? "Every task here is filtered out. Clear the filters to see them."
                  : "No tasks assigned yet. Drag one here, or add one."
              }
              action={
                onAdd ? (
                  <Button size="sm" variant="secondary" onClick={onAdd}>
                    <Plus className="h-3 w-3" />
                    New task
                  </Button>
                ) : undefined
              }
            />
          </Zone>
        ) : (
          grouped.map(({ status, items }) =>
            // Keep empty sections mounted for To do and In progress so there is
            // always somewhere to drop; hide the quieter two when empty.
            items.length === 0 && status !== "TODO" && status !== "IN_PROGRESS" ? null : (
              <Zone
                key={status}
                owner={ownerKey}
                status={status}
                tasks={items}
                showOwner={false}
                emptyHint={`No ${statusMeta[status].label.toLowerCase()} tasks`}
                onAdd={status === "TODO" ? onAdd : undefined}
              >
                <StatusHeading status={status} count={items.length} />
              </Zone>
            ),
          )
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Status columns — one owner's (or everyone's) board as a kanban
// ---------------------------------------------------------------------------

export function StatusColumns({
  ownerFilter,
  showOwner = true,
  onAdd,
}: {
  /** Member id, `UNASSIGNED`, or undefined for every task. */
  ownerFilter?: string;
  showOwner?: boolean;
  onAdd?: (status: TaskStatus) => void;
}) {
  const { tasks, filters, sort, now } = useTasks();

  const visible = useMemo(() => {
    const scoped =
      ownerFilter === undefined
        ? tasks
        : tasks.filter((t) => (t.owner?.id ?? UNASSIGNED) === ownerFilter);
    // Completed is a column here, so it must not be filtered away by default.
    return sortTasks(
      applyFilters(scoped, { ...filters, includeCompleted: true }, now),
      sort,
      now,
    );
  }, [tasks, filters, sort, now, ownerFilter]);

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const items = visible.filter((t) => t.status === status);
        return (
          <section
            key={status}
            className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface"
          >
            <header className="flex shrink-0 items-center gap-1.5 border-b border-line px-2.5 py-2">
              <Dot tone={statusMeta[status].tone} />
              <h2 className="text-[13px] font-medium text-text">{statusMeta[status].label}</h2>
              <Count className="ml-auto">{items.length}</Count>
              {onAdd && status !== "COMPLETED" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onAdd(status)}
                  aria-label={`Add a ${statusMeta[status].label} task`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </header>
            <Zone
              owner={ownerFilter ?? ANY_OWNER}
              status={status}
              tasks={items}
              showOwner={showOwner}
              emptyHint="Drop a task here"
              className="min-h-[7rem] flex-1 overflow-y-auto"
            />
          </section>
        );
      })}
    </div>
  );
}

/** Flat list, used where columns would be overkill (filtered views, search). */
export function TaskList({
  scopedTasks,
  showOwner = true,
  empty,
}: {
  scopedTasks?: TaskView[];
  showOwner?: boolean;
  empty?: ReactNode;
}) {
  const { tasks, filters, sort, now } = useTasks();

  const visible = useMemo(
    () => sortTasks(applyFilters(scopedTasks ?? tasks, filters, now), sort, now),
    [scopedTasks, tasks, filters, sort, now],
  );

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        {empty ?? (
          <EmptyState
            icon={Inbox}
            title="No tasks match these filters"
            description="Try clearing a filter or widening the deadline window."
          />
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {visible.map((task) => (
          <TaskRow key={task.id} task={task} showOwner={showOwner} draggable={false} />
        ))}
      </SortableContext>
    </div>
  );
}
