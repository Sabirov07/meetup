"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  CircleDashed,
  Clock,
  FileText,
  GitBranch,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { docStats, plainText } from "@/shared/doc/markdown";
import type { TaskView } from "@/shared/domain/types";
import { priorityMeta } from "@/shared/domain/labels";
import { blockingImpact, smartExplanation, unmetDependencies } from "@/shared/domain/priority";
import { subtaskProgress } from "@/shared/domain/subtasks";
import { useI18n, useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Dot } from "@/frontend/components/ui/badge";
import { Tooltip } from "@/frontend/components/ui/feedback";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/frontend/components/ui/menu";
import { TASK_PRIORITIES } from "@/shared/domain/types";
import { spaceDot } from "@/frontend/components/spaces/space-color";
import { useTasks } from "./task-store";
import { useStatusMeta } from "./status-meta";

/**
 * One task, as a dense row rather than a card. Cards everywhere make a long
 * list unreadable; a row keeps twenty tasks scannable and still has room for
 * the signals that matter — priority, deadline, owner, what is blocked.
 */
export function TaskRow({
  task,
  showOwner = true,
  draggable = true,
}: {
  task: TaskView;
  showOwner?: boolean;
  draggable?: boolean;
}) {
  const { now, members, move, remove, setOpenTaskId } = useTasks();
  const { meta: statusOf, all: allStatuses } = useStatusMeta();
  const { t, f } = useI18n();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
    data: { type: "task", task },
  });

  const due = f.dueDate(task.dueDate, now);
  const done = task.status === "COMPLETED";

  // A document is a signal in its own right: it says this task has a brief,
  // and a checklist inside it says how far through that brief the work is.
  const doc = useMemo(() => {
    if (!task.description?.trim()) return null;
    const stats = docStats(task.description);
    if (stats.words === 0 && stats.images === 0) return null;
    const excerpt = plainText(task.description).slice(0, 180);
    return {
      label: stats.checklist
        ? `${stats.checklist.done}/${stats.checklist.total}`
        : stats.images > 0
          ? String(stats.images)
          : null,
      excerpt,
    };
  }, [task.description]);
  const steps = subtaskProgress(task.subtasks);
  const blocks = blockingImpact(task);
  const unmet = unmetDependencies(task);
  const effort = f.effort(task.estimateMinutes);

  function toggleComplete(event: React.MouseEvent) {
    event.stopPropagation();
    move(task.id, { status: done ? "TODO" : "COMPLETED" });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => setOpenTaskId(task.id)}
      onKeyDown={(event) => {
        // Enter opens the task. Space is deliberately NOT handled here: it is
        // how dnd-kit's keyboard sensor picks a task up, so intercepting it
        // would make the board undraggable without a mouse.
        if (event.key === "Enter") {
          event.preventDefault();
          setOpenTaskId(task.id);
        }
      }}
      aria-label={task.title}
      className={cn(
        // A container, not a viewport breakpoint: the same row renders in a
        // half-width dashboard panel and a full-width board, and only the row's
        // own width should decide how many signals it can afford to show.
        "@container/row group relative flex items-center gap-2.5 border-b border-line px-2.5 py-2 text-left transition-colors last:border-b-0",
        "hover:bg-hover focus-visible:bg-hover",
        draggable && "grab",
        isDragging && "z-10 rounded-md border-b-transparent bg-raised opacity-90 shadow-popover",
      )}
    >
      {/* Completion toggle. Hit area is deliberately larger than the glyph. */}
      <Tooltip
        content={done ? t("tasks.row.markTodo") : t("tasks.row.markComplete")}
        delay={500}
      >
        <button
          onClick={toggleComplete}
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
          {done ? (
            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
          ) : (
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          )}
        </button>
      </Tooltip>

      {/* Title + secondary line */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className={cn(
              "truncate text-[13px] leading-5",
              done ? "text-text-faint line-through" : "font-medium text-text",
            )}
          >
            {task.title}
          </p>

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
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-2 text-2xs text-text-faint">
          <span className="flex shrink-0 items-center gap-1">
            <Dot tone={statusOf(task.status).tone} />
            {statusOf(task.status).short}
          </span>

          {/* The section comes before the category: on a board that spans
              several areas it is the first thing someone scans for. */}
          {task.space && (
            <span className="hidden min-w-0 shrink items-center gap-2 @[20rem]/row:flex">
              <span aria-hidden className="shrink-0">
                ·
              </span>
              <span className="flex min-w-0 shrink items-center gap-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    spaceDot(task.space.colorToken),
                  )}
                />
                <span className="min-w-0 shrink truncate">{task.space.name}</span>
              </span>
            </span>
          )}

          {task.category !== "GENERAL" && (
            <span className="hidden min-w-0 shrink items-center gap-2 @[20rem]/row:flex">
              <span aria-hidden className="shrink-0">
                ·
              </span>
              {/* The one item allowed to shrink, so the signals after it stay
                  whole rather than all degrading together. */}
              <span className="min-w-0 shrink truncate">
                {t(`category.${task.category}.label`)}
              </span>
            </span>
          )}

          {unmet.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <Tooltip
                content={t("tasks.row.waitingOnTip", {
                  titles: unmet.map((d) => d.title).join(", "),
                })}
              >
                <span className="flex shrink-0 items-center gap-1 text-warning">
                  <Clock className="h-2.5 w-2.5" />
                  {t("tasks.row.waitingOn", { count: unmet.length })}
                </span>
              </Tooltip>
            </>
          )}

          {blocks > 0 && (
            <>
              <span aria-hidden>·</span>
              <Tooltip content={t("tasks.row.blocksTip", { count: blocks })}>
                <span className="flex shrink-0 items-center gap-1 text-info">
                  <GitBranch className="h-2.5 w-2.5" />
                  {t("tasks.row.blocks", { count: blocks })}
                </span>
              </Tooltip>
            </>
          )}

          {doc && (
            <span className="hidden shrink-0 items-center gap-2 @[26rem]/row:flex">
              <span aria-hidden>·</span>
              <Tooltip content={doc.excerpt}>
                <span className="flex items-center gap-1">
                  <FileText className="h-2.5 w-2.5" />
                  {doc.label}
                </span>
              </Tooltip>
            </span>
          )}

          {steps && (
            <span className="hidden shrink-0 items-center gap-2 @[26rem]/row:flex">
              <span aria-hidden>·</span>
              <Tooltip
                content={t("tasks.row.subtasksTip", {
                  done: steps.done,
                  total: steps.total,
                })}
              >
                <span
                  className={cn(
                    "flex items-center gap-1 tabular-nums",
                    steps.done === steps.total && "text-success",
                  )}
                >
                  <ListChecks className="h-2.5 w-2.5" />
                  {steps.done}/{steps.total}
                </span>
              </Tooltip>
            </span>
          )}

          {task.commentCount > 0 && (
            <span className="hidden shrink-0 items-center gap-2 @[26rem]/row:flex">
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-2.5 w-2.5" />
                {task.commentCount}
              </span>
            </span>
          )}

          {effort && (
            <span className="hidden shrink-0 items-center gap-2 @[26rem]/row:flex">
              <span aria-hidden>·</span>
              <span>{effort}</span>
            </span>
          )}

          {/* Labels are the first thing to go: a chip truncated to "unbl…"
              is noise, not information. */}
          {task.labels.length > 0 && (
            <span className="hidden shrink-0 items-center gap-1 @[32rem]/row:flex">
              {task.labels.slice(0, 2).map((label) => (
                <span
                  key={label}
                  className="rounded-[4px] bg-raised px-1 text-2xs text-text-muted"
                >
                  {label}
                </span>
              ))}
            </span>
          )}

          {/* Deadline sits on the secondary line so the title keeps the full
              width of the row — in a two-panel layout that is ~90px back. */}
          <span
            className={cn(
              "ml-auto shrink-0 pl-2 tabular-nums",
              due.overdue && !done
                ? "font-medium text-danger"
                : due.imminent && !done
                  ? "text-warning"
                  : "text-text-faint",
            )}
          >
            {due.text}
          </span>
        </div>
      </div>

      {/* Priority */}
      <Tooltip content={smartExplanation(task, now, t)}>
        <span className="shrink-0">
          <Badge tone={priorityMeta[task.priority].tone}>
            {t(`priority.${task.priority}.label`)}
          </Badge>
        </span>
      </Tooltip>

      {/* Owner */}
      {showOwner && (
        <span className="shrink-0">
          <Avatar member={task.owner} size="md" />
        </span>
      )}

      {/* Row actions */}
      <Menu>
        <MenuTrigger asChild>
          <button
            onClick={(event) => event.stopPropagation()}
            aria-label={t("tasks.row.actionsFor", { title: task.title })}
            className="shrink-0 rounded-md p-1 text-text-faint opacity-0 transition-opacity hover:bg-raised hover:text-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </MenuTrigger>
        <MenuContent onClick={(event) => event.stopPropagation()}>
          <MenuLabel>{t("tasks.facet.status")}</MenuLabel>
          <MenuRadioGroup
            value={task.status}
            onValueChange={(value) =>
              move(task.id, { status: value as TaskView["status"] })
            }
          >
            {allStatuses.map((status) => (
              <MenuRadioItem key={status.key} value={status.key}>
                <Dot tone={status.tone} />
                {status.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>

          <MenuSeparator />
          <MenuLabel>{t("tasks.facet.priority")}</MenuLabel>
          <MenuRadioGroup
            value={task.priority}
            onValueChange={(value) =>
              void (async () => {
                const { updateTask } = await import("@/backend/actions/tasks");
                const result = await updateTask({
                  id: task.id,
                  priority: value as TaskView["priority"],
                });
                if (!result.ok) {
                  toast.error(t("tasks.row.changePriorityFailed"), {
                    description: result.error,
                  });
                }
              })()
            }
          >
            {TASK_PRIORITIES.map((priority) => (
              <MenuRadioItem key={priority} value={priority}>
                <Dot tone={priorityMeta[priority].tone} />
                {t(`priority.${priority}.label`)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>

          <MenuSeparator />
          <MenuLabel>{t("tasks.facet.assignee")}</MenuLabel>
          <MenuRadioGroup
            value={task.owner?.id ?? "UNASSIGNED"}
            onValueChange={(value) =>
              move(task.id, { ownerMemberId: value === "UNASSIGNED" ? null : value })
            }
          >
            {members.map((member) => (
              <MenuRadioItem key={member.id} value={member.id}>
                <Avatar member={member} size="xs" />
                {member.name}
              </MenuRadioItem>
            ))}
            <MenuRadioItem value="UNASSIGNED">{t("common.unassigned")}</MenuRadioItem>
          </MenuRadioGroup>

          <MenuSeparator />
          <MenuItem onSelect={() => setOpenTaskId(task.id)}>
            {t("tasks.row.openDetails")}
          </MenuItem>
          <MenuItem destructive onSelect={() => remove(task.id)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t("common.delete")}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

/** Rendered under the cursor while dragging. */
export function TaskDragPreview({ task }: { task: TaskView }) {
  const t = useT();
  const { meta: statusOf } = useStatusMeta();

  return (
    <div className="flex w-[22rem] max-w-[80vw] items-center gap-2.5 rounded-lg border border-line-accent bg-overlay px-2.5 py-2 shadow-popover">
      <Dot tone={statusOf(task.status).tone} />
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{task.title}</p>
      <Badge tone={priorityMeta[task.priority].tone}>
        {t(`priority.${task.priority}.label`)}
      </Badge>
      <Avatar member={task.owner} size="md" />
    </div>
  );
}
