"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronRight,
  CircleDashed,
  Clock,
  FileText,
  Flag,
  GitBranch,
  Inbox,
  Layers,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import { assignSubtask, setSubtaskDone } from "@/backend/actions/subtasks";
import { createTask } from "@/backend/actions/tasks";
import { applyFilters } from "@/shared/domain/filters";
import { priorityMeta } from "@/shared/domain/labels";
import { blockingImpact, sortTasks, unmetDependencies } from "@/shared/domain/priority";
import { subtaskProgress } from "@/shared/domain/subtasks";
import {
  NO_SPACE,
  TASK_PRIORITIES,
  type SubtaskRef,
  type TaskPriority,
  type TaskStatus,
  type TaskView,
} from "@/shared/domain/types";
import type { TranslationKey } from "@/shared/i18n";
import { useI18n, useT } from "@/frontend/i18n";
import { toDateInputValue } from "@/frontend/i18n/format";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Count, Dot } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/field";
import { EmptyState, Tooltip } from "@/frontend/components/ui/feedback";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/frontend/components/ui/menu";
import { ANY_OWNER, UNASSIGNED, zoneId } from "./task-zones";
import { useTasks } from "./task-store";
import { useStatusMeta } from "./status-meta";
import { StatusManagerButton } from "./status-manager-dialog";

/**
 * The list view: every task as a row in a spreadsheet-style table, grouped by
 * status.
 *
 * It exists because a board trades the title for the layout — four columns on
 * a laptop leave ~220px per card, which truncates most real task titles. A row
 * gives the title the full width and still has room for the fields people
 * actually edit, so owner, priority, status and deadline are all one click
 * away instead of hidden behind the drawer.
 *
 * It is not a `<table>`: a drag-and-drop row cannot live inside `<tbody>`
 * without breaking the row's transform, so the columns are a CSS grid that the
 * header and every row share.
 */

const COLUMNS =
  "grid grid-cols-[1.25rem_minmax(14rem,1fr)_4.5rem_6.5rem_9rem_7rem_5.5rem_1.75rem] items-center gap-x-2";

/** Below this the columns would collide, so the table scrolls sideways. */
const MIN_WIDTH = "min-w-[54rem]";

const GROUP_BY = ["STATUS", "ASSIGNEE", "PRIORITY", "NONE"] as const;
type GroupBy = (typeof GROUP_BY)[number];

/**
 * `label` names the dimension for the menu; `trigger` is the whole phrase the
 * button says. They are separate strings because "Group by" + a mode name only
 * reads as a sentence in English.
 */
const groupByMeta: Record<GroupBy, { label: TranslationKey; trigger: TranslationKey }> = {
  STATUS: { label: "tasks.table.group.STATUS", trigger: "tasks.table.groupedBy.STATUS" },
  ASSIGNEE: { label: "tasks.table.group.ASSIGNEE", trigger: "tasks.table.groupedBy.ASSIGNEE" },
  PRIORITY: { label: "tasks.table.group.PRIORITY", trigger: "tasks.table.groupedBy.PRIORITY" },
  NONE: { label: "tasks.table.group.NONE", trigger: "tasks.table.groupedBy.NONE" },
};

/** Fields a quick-add row inherits from the group it sits in. */
type GroupDefaults = {
  status?: TaskStatus;
  ownerMemberId?: string | null;
  priority?: TaskPriority;
};

type Group = {
  key: string;
  label: string;
  /** Rendered before the label — a status dot, an avatar, a priority badge. */
  marker?: ReactNode;
  items: TaskView[];
  defaults: GroupDefaults;
  /**
   * Where a dropped task lands. Only status groups have one: dropping into an
   * "Alice" group would have to leave the status alone, which the board's
   * `zone:<owner>:<status>` targets cannot express.
   */
  zone?: { owner: string; status: TaskStatus };
};

export function TaskTable({
  ownerFilter,
  spaceFilter,
  onAdd,
}: {
  /** Member id, `UNASSIGNED`, or undefined for every task. */
  ownerFilter?: string;
  /** Section id, `NO_SPACE`, or undefined for every section. */
  spaceFilter?: string;
  /** Opens the full new-task form, pre-filled from the group. */
  onAdd?: (defaults: GroupDefaults) => void;
}) {
  const { tasks, members, filters, sort, now } = useTasks();
  const { all: allStatuses } = useStatusMeta();
  const t = useT();
  const [groupBy, setGroupBy] = useState<GroupBy>("STATUS");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const visible = useMemo(() => {
    let scoped =
      ownerFilter === undefined
        ? tasks
        : tasks.filter((task) => (task.owner?.id ?? UNASSIGNED) === ownerFilter);
    if (spaceFilter !== undefined) {
      scoped = scoped.filter((task) => (task.space?.id ?? NO_SPACE) === spaceFilter);
    }
    // Grouped by status, "Completed" is a group of its own, so hiding completed
    // tasks would leave an empty heading. Any other grouping would interleave
    // them with live work, so there the filter is honoured.
    return sortTasks(
      applyFilters(
        scoped,
        groupBy === "STATUS" ? { ...filters, includeCompleted: true } : filters,
        now,
      ),
      sort,
      now,
    );
  }, [tasks, filters, sort, now, ownerFilter, spaceFilter, groupBy]);

  const groups = useMemo<Group[]>(() => {
    switch (groupBy) {
      case "STATUS":
        return allStatuses.map((status) => ({
          key: status.key,
          label: status.label,
          marker: <Dot tone={status.tone} />,
          items: visible.filter((task) => task.status === status.key),
          defaults: { status: status.key },
          zone: { owner: ownerFilter ?? ANY_OWNER, status: status.key },
        }));

      case "ASSIGNEE": {
        const byMember = members.map((member) => ({
          key: member.id,
          label: member.name,
          marker: <Avatar member={member} size="sm" />,
          items: visible.filter((task) => task.owner?.id === member.id),
          defaults: { ownerMemberId: member.id },
        }));
        return [
          ...byMember,
          {
            key: UNASSIGNED,
            label: t("common.unassigned"),
            marker: <Avatar member={null} size="sm" />,
            items: visible.filter((task) => !task.owner),
            defaults: { ownerMemberId: null },
          },
        ];
      }

      case "PRIORITY":
        return TASK_PRIORITIES.map((priority) => ({
          key: priority,
          label: t(`priority.${priority}.label`),
          marker: <Dot tone={priorityMeta[priority].tone} />,
          items: visible.filter((task) => task.priority === priority),
          defaults: { priority },
        }));

      case "NONE":
        return [
          {
            key: "ALL",
            label: t("tasks.table.allTasks"),
            items: visible,
            defaults: {},
          },
        ];
    }
  }, [groupBy, visible, members, ownerFilter, t, allStatuses]);

  // Empty groups stay for statuses — a board you cannot drop into is not a
  // board, and the heading is also where a new task of that status is added.
  const shown = groups.filter((group) => group.items.length > 0 || groupBy === "STATUS");

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-2.5 py-2">
        <h2 className="text-[13px] font-medium text-text">
          {t("common.tasks", { count: visible.length })}
        </h2>

        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto">
              <Layers className="h-3.5 w-3.5" />
              {t(groupByMeta[groupBy].trigger)}
            </Button>
          </MenuTrigger>
          <MenuContent className="w-[13rem]">
            <MenuLabel>{t("tasks.table.groupBy")}</MenuLabel>
            <MenuRadioGroup
              value={groupBy}
              onValueChange={(value) => setGroupBy(value as GroupBy)}
            >
              {GROUP_BY.map((mode) => (
                <MenuRadioItem key={mode} value={mode}>
                  {t(groupByMeta[mode].label)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            {groupBy !== "STATUS" && (
              <>
                <MenuSeparator />
                <MenuItem className="text-2xs text-text-faint" disabled>
                  {t("tasks.table.dragOnlyByStatus")}
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>

        <StatusManagerButton />
      </header>

      {visible.length === 0 && groupBy !== "STATUS" ? (
        <EmptyState
          icon={Inbox}
          title={t("tasks.list.empty.title")}
          description={t("tasks.list.empty.description")}
        />
      ) : (
        <div className="overflow-x-auto">
          <div className={MIN_WIDTH}>
            <TableHead />
            {shown.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                collapsed={collapsed.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                onAdd={onAdd}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Header and groups
// ---------------------------------------------------------------------------

function TableHead() {
  const t = useT();

  return (
    <div
      className={cn(
        COLUMNS,
        "border-b border-line bg-canvas/40 px-2.5 py-1.5 text-2xs font-medium text-text-faint",
      )}
    >
      <span />
      <span>{t("tasks.table.column.task")}</span>
      <span>{t("tasks.table.column.assignee")}</span>
      <span>{t("tasks.table.column.priority")}</span>
      <span>{t("tasks.table.column.status")}</span>
      <span>{t("tasks.table.column.dueDate")}</span>
      <span>{t("tasks.table.column.estimate")}</span>
      <span />
    </div>
  );
}

function GroupSection({
  group,
  collapsed,
  onToggle,
  onAdd,
}: {
  group: Group;
  collapsed: boolean;
  onToggle: () => void;
  onAdd?: (defaults: GroupDefaults) => void;
}) {
  const t = useT();
  const [quickAdd, setQuickAdd] = useState(false);
  const draggable = Boolean(group.zone);

  // One droppable over the whole group, so a task can be dropped on the
  // heading, between rows, or onto the empty state — all the same target.
  const { setNodeRef, isOver } = useDroppable({
    id: group.zone ? zoneId(group.zone.owner, group.zone.status) : `group:${group.key}`,
    disabled: !group.zone,
    data: group.zone ? { ownerScope: group.zone.owner, status: group.zone.status } : undefined,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("transition-colors", isOver && "bg-accent-dim/35")}
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-canvas/60 px-2.5 py-1.5">
        <button
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
          className="flex items-center gap-1.5 rounded-md px-0.5 py-0.5 text-text-secondary hover:bg-hover hover:text-text"
        >
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", !collapsed && "rotate-90")}
          />
          {group.marker}
          <span className="text-2xs font-semibold uppercase tracking-[0.04em]">
            {group.label}
          </span>
        </button>
        <Count>{group.items.length}</Count>

        {onAdd && (
          <Tooltip content={t("tasks.table.addFull")}>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              onClick={() => onAdd(group.defaults)}
              aria-label={t("tasks.table.addToGroup", { group: group.label })}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>

      {!collapsed && (
        <>
          <SortableContext
            items={group.items.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {group.items.map((task) => (
              <TaskTableRow
                key={task.id}
                task={task}
                draggable={draggable}
                ownerScope={group.zone?.owner}
              />
            ))}
          </SortableContext>

          {group.items.length === 0 && !quickAdd && (
            <p
              className={cn(
                "border-b border-line px-2.5 py-2 text-2xs",
                isOver ? "text-accent-bright" : "text-text-faint",
              )}
            >
              {t(isOver ? "tasks.zone.dropHere" : "tasks.table.nothingYet")}
            </p>
          )}

          {quickAdd ? (
            <QuickAddRow defaults={group.defaults} onClose={() => setQuickAdd(false)} />
          ) : (
            <button
              onClick={() => setQuickAdd(true)}
              className="flex w-full items-center gap-1.5 border-b border-line px-2.5 py-1.5 text-2xs text-text-faint transition-colors hover:bg-hover hover:text-text"
            >
              <Plus className="h-3 w-3" />
              {t("tasks.table.addTask")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Type a title, press Enter, type the next one. The full form is still a click
 * away in the group heading — this is for the ten tasks someone has in their
 * head right now, where opening a dialog ten times is the whole friction.
 */
function QuickAddRow({
  defaults,
  onClose,
}: {
  defaults: GroupDefaults;
  onClose: () => void;
}) {
  const { upsertTask } = useTasks();
  const t = useT();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (trimmed.length < 3 || saving) return;

    setSaving(true);
    const result = await createTask({ title: trimmed, ...defaults });
    setSaving(false);

    if (result.ok) {
      upsertTask(result.data);
      setTitle("");
    } else {
      toast.error(t("tasks.table.createFailed"), { description: result.error });
    }
  }

  return (
    <div className="flex items-center gap-1.5 border-b border-line bg-raised/40 px-2.5 py-1.5">
      <Input
        autoFocus
        value={title}
        disabled={saving}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") onClose();
        }}
        // Blurring with nothing typed means they changed their mind; blurring
        // mid-title would otherwise throw the title away.
        onBlur={() => !title.trim() && onClose()}
        placeholder={t("tasks.table.quickAddPlaceholder")}
        aria-label={t("tasks.table.quickAddLabel")}
        className="h-7"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
        aria-label={t("tasks.table.quickAddStop")}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function TaskTableRow({
  task,
  draggable,
  ownerScope,
}: {
  task: TaskView;
  draggable: boolean;
  ownerScope?: string;
}) {
  const { move, remove, setOpenTaskId } = useTasks();
  const { t, f } = useI18n();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
    data: { type: "task", task, ownerScope },
  });

  const done = task.status === "COMPLETED";
  const effort = f.effort(task.estimateMinutes);
  const blocks = blockingImpact(task);
  const unmet = unmetDependencies(task);
  const steps = subtaskProgress(task.subtasks);
  // Unfolded steps live under the row, the way a tree does. Folded by default:
  // a list where every task spills its checklist is no longer scannable.
  const [expanded, setExpanded] = useState(false);
  const showSteps = expanded && !isDragging && task.subtasks.length > 0;

  return (
    <>
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => setOpenTaskId(task.id)}
      onKeyDown={(event) => {
        // Enter opens the task; Space belongs to dnd-kit's keyboard sensor.
        if (event.key === "Enter") {
          event.preventDefault();
          setOpenTaskId(task.id);
        }
      }}
      aria-label={task.title}
      className={cn(
        COLUMNS,
        "group border-b border-line px-2.5 py-1.5 text-left transition-colors hover:bg-hover focus-visible:bg-hover",
        draggable && "grab",
        isDragging && "z-10 border-b-transparent bg-raised opacity-90 shadow-popover",
      )}
    >
      <Tooltip
        content={done ? t("tasks.row.markTodo") : t("tasks.row.markComplete")}
        delay={500}
      >
        <button
          onClick={(event) => {
            event.stopPropagation();
            move(task.id, { status: done ? "TODO" : "COMPLETED" });
          }}
          aria-label={
            done
              ? t("tasks.row.markTodoNamed", { title: task.title })
              : t("tasks.row.markCompleteNamed", { title: task.title })
          }
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            done
              ? "border-success bg-success text-canvas"
              : "border-line-strong text-transparent hover:border-accent hover:text-accent",
          )}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={done ? 3.5 : 3} />
        </button>
      </Tooltip>

      {/* Title. The whole point of this view: one line, full width, no clipping
          until the row genuinely runs out of room. */}
      <div className="flex min-w-0 items-center gap-1.5">
        {/* The fold sits in the gutter before the title, so rows with and
            without steps keep their titles on the same line. */}
        <span className="-ml-1 flex w-4 shrink-0 items-center justify-center">
          {task.subtasks.length > 0 && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-expanded={expanded}
              aria-label={t(
                expanded ? "tasks.table.collapseSubtasks" : "tasks.table.expandSubtasks",
                { title: task.title },
              )}
              className="rounded p-0.5 text-text-faint transition-colors hover:bg-raised hover:text-text"
            >
              <ChevronRight
                className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
              />
            </button>
          )}
        </span>
        <span
          className={cn(
            "truncate text-[13px] leading-5",
            done ? "text-text-faint line-through" : "font-medium text-text",
          )}
        >
          {task.title}
        </span>

        {task.needsReview && (
          <Tooltip content={t("tasks.row.reviewTip")}>
            <span className="shrink-0">
              <Badge tone="tone-warning">
                <CircleDashed className="h-2.5 w-2.5" />
                {t("tasks.row.reviewBadge")}
              </Badge>
            </span>
          </Tooltip>
        )}

        {task.isAiGenerated && !task.needsReview && (
          <Tooltip
            content={
              task.sourceMeeting
                ? t("tasks.row.fromMeeting", { title: task.sourceMeeting.title })
                : t("tasks.row.fromConversation")
            }
          >
            <span className="shrink-0">
              <Sparkles className="h-3 w-3 text-text-faint" />
            </span>
          </Tooltip>
        )}

        {unmet.length > 0 && (
          <Tooltip
            content={t("tasks.row.waitingOnTip", {
              titles: unmet.map((d) => d.title).join(", "),
            })}
          >
            <span className="flex shrink-0 items-center gap-1 text-2xs text-warning">
              <Clock className="h-2.5 w-2.5" />
              {unmet.length}
            </span>
          </Tooltip>
        )}

        {blocks > 0 && (
          <Tooltip content={t("tasks.row.blocksTip", { count: blocks })}>
            <span className="flex shrink-0 items-center gap-1 text-2xs text-info">
              <GitBranch className="h-2.5 w-2.5" />
              {blocks}
            </span>
          </Tooltip>
        )}

        {task.description?.trim() && (
          <FileText className="h-2.5 w-2.5 shrink-0 text-text-faint" aria-hidden />
        )}

        {steps && (
          <Tooltip
            content={t("tasks.row.subtasksTip", { done: steps.done, total: steps.total })}
          >
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 text-2xs tabular-nums",
                steps.done === steps.total ? "text-success" : "text-text-faint",
              )}
            >
              <ListChecks className="h-2.5 w-2.5" />
              {steps.done}/{steps.total}
            </span>
          </Tooltip>
        )}

        {task.commentCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-2xs text-text-faint">
            <MessageSquare className="h-2.5 w-2.5" />
            {task.commentCount}
          </span>
        )}
      </div>

      <AssigneeCell task={task} />
      <PriorityCell task={task} />
      <StatusCell task={task} />
      <DueDateCell task={task} />

      <span className="truncate text-2xs tabular-nums text-text-faint">
        {effort ?? t("common.emptyValue")}
      </span>

      <Menu>
        <MenuTrigger asChild>
          <button
            onClick={(event) => event.stopPropagation()}
            aria-label={t("tasks.row.actionsFor", { title: task.title })}
            className="rounded-md p-1 text-text-faint opacity-0 transition-opacity hover:bg-raised hover:text-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </MenuTrigger>
        <MenuContent onClick={(event) => event.stopPropagation()}>
          <MenuItem onSelect={() => setOpenTaskId(task.id)}>
            {t("tasks.row.openDetails")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onSelect={() => remove(task.id)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t("common.delete")}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>

    {showSteps &&
      task.subtasks.map((subtask) => (
        <SubtaskTableRow key={subtask.id} task={task} subtask={subtask} />
      ))}
    </>
  );
}

/**
 * One step of a task, as a nested row under it.
 *
 * It shares the parent's grid so the assignee and status land in their own
 * columns, and leaves the columns a step does not have — priority, deadline,
 * estimate — empty rather than inventing values for them.
 */
function SubtaskTableRow({ task, subtask }: { task: TaskView; subtask: SubtaskRef }) {
  const { members, upsertTask, setOpenTaskId } = useTasks();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function run(action: () => ReturnType<typeof setSubtaskDone>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) upsertTask(result.data);
    else toast.error(t("detail.saveFailed"), { description: result.error });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setOpenTaskId(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setOpenTaskId(task.id);
        }
      }}
      aria-label={subtask.title}
      className={cn(
        COLUMNS,
        "group border-b border-line bg-canvas/30 px-2.5 py-1 text-left transition-colors hover:bg-hover focus-visible:bg-hover",
        busy && "opacity-60",
      )}
    >
      <span />

      <div className="flex min-w-0 items-center gap-2 pl-7">
        <button
          onClick={(event) => {
            event.stopPropagation();
            void run(() => setSubtaskDone({ id: subtask.id, done: !subtask.done }));
          }}
          aria-label={t(
            subtask.done ? "detail.subtasks.markTodo" : "detail.subtasks.markDone",
            { title: subtask.title },
          )}
          aria-pressed={subtask.done}
          className={cn(
            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
            subtask.done
              ? "border-success bg-success text-canvas"
              : "border-line-strong text-transparent hover:border-accent hover:text-accent",
          )}
        >
          <Check className="h-2 w-2" strokeWidth={3.5} />
        </button>
        <span
          className={cn(
            "truncate text-[13px] leading-5",
            subtask.done ? "text-text-faint line-through" : "text-text-secondary",
          )}
        >
          {subtask.title}
        </span>
      </div>

      <Menu>
        <MenuTrigger asChild>
          <CellButton
            label={
              subtask.assignee
                ? t("detail.subtasks.assignedTo", {
                    title: subtask.title,
                    name: subtask.assignee.name,
                  })
                : t("detail.subtasks.assign", { title: subtask.title })
            }
          >
            {subtask.assignee ? (
              <Avatar member={subtask.assignee} size="sm" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-line-strong text-text-faint group-hover:border-accent group-hover:text-accent">
                <UserPlus className="h-2.5 w-2.5" />
              </span>
            )}
          </CellButton>
        </MenuTrigger>
        <MenuContent align="start" onClick={(event) => event.stopPropagation()}>
          <MenuLabel>{t("tasks.table.column.assignee")}</MenuLabel>
          <MenuRadioGroup
            value={subtask.assignee?.id ?? UNASSIGNED}
            onValueChange={(value) =>
              void run(() =>
                assignSubtask({ id: subtask.id, memberId: value === UNASSIGNED ? null : value }),
              )
            }
          >
            {members.map((member) => (
              <MenuRadioItem key={member.id} value={member.id}>
                <Avatar member={member} size="xs" />
                {member.name}
              </MenuRadioItem>
            ))}
            <MenuRadioItem value={UNASSIGNED}>
              <Avatar member={null} size="xs" />
              {t("common.unassigned")}
            </MenuRadioItem>
          </MenuRadioGroup>
        </MenuContent>
      </Menu>

      <span />

      <CellButton
        label={t("detail.subtasks.setStatus", { title: subtask.title })}
        onClick={() => void run(() => setSubtaskDone({ id: subtask.id, done: !subtask.done }))}
      >
        <Badge tone={subtask.done ? "tone-success" : "tone-neutral"} className="min-w-0">
          <Dot tone={subtask.done ? "tone-success" : "tone-neutral"} />
          <span className="truncate">
            {t(subtask.done ? "detail.subtasks.status.done" : "detail.subtasks.status.open")}
          </span>
        </Badge>
      </CellButton>

      <span />
      <span />
      <span />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cells — every one of them editable in place
// ---------------------------------------------------------------------------

/**
 * Shared trigger: quiet until hovered, and never opens the task behind it.
 *
 * Every prop is forwarded, because this is what `MenuTrigger asChild` and
 * `PopoverTrigger asChild` clone — swallowing their props leaves a button that
 * looks right and opens nothing.
 */
function CellButton({
  label,
  className,
  onClick,
  children,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      {...props}
      onClick={(event) => {
        // The row behind opens the task on click; a field editor must not.
        event.stopPropagation();
        onClick?.(event);
      }}
      aria-label={label}
      className={cn(
        "flex h-6 min-w-0 items-center gap-1 rounded-md px-1 text-2xs transition-colors hover:bg-raised data-[state=open]:bg-raised",
        className,
      )}
    >
      {children}
    </button>
  );
}

function AssigneeCell({ task }: { task: TaskView }) {
  const { members, move } = useTasks();
  const t = useT();

  return (
    <Menu>
      <MenuTrigger asChild>
        <CellButton
          label={
            task.owner
              ? t("tasks.table.assignedTo", { title: task.title, name: task.owner.name })
              : t("tasks.table.assignTo", { title: task.title })
          }
        >
          {task.owner ? (
            <Avatar member={task.owner} size="md" />
          ) : (
            // A dashed "add person" target, so an unassigned task advertises
            // that assigning one is a click here — not a trip to the drawer.
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line-strong text-text-faint group-hover:border-accent group-hover:text-accent">
              <UserPlus className="h-3 w-3" />
            </span>
          )}
        </CellButton>
      </MenuTrigger>
      <MenuContent align="start" onClick={(event) => event.stopPropagation()}>
        <MenuLabel>{t("tasks.table.column.assignee")}</MenuLabel>
        <MenuRadioGroup
          value={task.owner?.id ?? UNASSIGNED}
          onValueChange={(value) =>
            move(task.id, { ownerMemberId: value === UNASSIGNED ? null : value })
          }
        >
          {members.map((member) => (
            <MenuRadioItem key={member.id} value={member.id}>
              <Avatar member={member} size="xs" />
              {member.name}
            </MenuRadioItem>
          ))}
          <MenuRadioItem value={UNASSIGNED}>
            <Avatar member={null} size="xs" />
            {t("common.unassigned")}
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function PriorityCell({ task }: { task: TaskView }) {
  const { patch } = useTasks();
  const t = useT();
  const meta = priorityMeta[task.priority];
  const label = t(`priority.${task.priority}.label`);

  return (
    <Menu>
      <MenuTrigger asChild>
        <CellButton
          label={t("tasks.table.priorityIs", { title: task.title, value: label })}
        >
          <span className={cn(meta.tone, "flex min-w-0 items-center gap-1 text-[var(--tone-fg)]")}>
            <Flag className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        </CellButton>
      </MenuTrigger>
      <MenuContent align="start" onClick={(event) => event.stopPropagation()}>
        <MenuLabel>{t("tasks.table.column.priority")}</MenuLabel>
        <MenuRadioGroup
          value={task.priority}
          onValueChange={(value) =>
            patch(task.id, { id: task.id, priority: value as TaskPriority })
          }
        >
          {TASK_PRIORITIES.map((priority) => (
            <MenuRadioItem key={priority} value={priority}>
              <Dot tone={priorityMeta[priority].tone} />
              {t(`priority.${priority}.label`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function StatusCell({ task }: { task: TaskView }) {
  const { move } = useTasks();
  const { meta: statusOf, all: allStatuses } = useStatusMeta();
  const t = useT();
  const meta = statusOf(task.status);
  const label = meta.label;

  return (
    <Menu>
      <MenuTrigger asChild>
        <CellButton
          label={t("tasks.table.statusIs", { title: task.title, value: label })}
          className="w-full"
        >
          <Badge tone={meta.tone} className="min-w-0 max-w-full shrink">
            <Dot tone={meta.tone} />
            <span className="truncate" title={label}>
              {label}
            </span>
          </Badge>
        </CellButton>
      </MenuTrigger>
      <MenuContent align="start" onClick={(event) => event.stopPropagation()}>
        <MenuLabel>{t("tasks.table.column.status")}</MenuLabel>
        <MenuRadioGroup
          value={task.status}
          onValueChange={(value) => move(task.id, { status: value as TaskStatus })}
        >
          {allStatuses.map((status) => (
            <MenuRadioItem key={status.key} value={status.key}>
              <Dot tone={status.tone} />
              {status.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function DueDateCell({ task }: { task: TaskView }) {
  const { now, patch } = useTasks();
  const { t, f } = useI18n();
  const due = f.dueDate(task.dueDate, now);
  const done = task.status === "COMPLETED";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <CellButton
          label={t("tasks.table.dueIs", { title: task.title, value: due.text })}
          className={cn(
            "tabular-nums",
            due.overdue && !done
              ? "font-medium text-danger"
              : due.imminent && !done
                ? "text-warning"
                : "text-text-faint",
          )}
        >
          <span className="truncate">{due.text}</span>
        </CellButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[13rem] space-y-2 p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <Input
          type="date"
          value={toDateInputValue(task.dueDate)}
          onChange={(event) =>
            patch(task.id, { id: task.id, dueDate: event.target.value || null })
          }
          aria-label={t("tasks.table.deadlineFor", { title: task.title })}
          className="h-7"
        />
        {task.dueDate && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => patch(task.id, { id: task.id, dueDate: null })}
          >
            <X className="h-3 w-3" />
            {t("tasks.table.clearDeadline")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
