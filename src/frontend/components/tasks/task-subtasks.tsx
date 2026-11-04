"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronUp, GripVertical, ListChecks, Plus, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addSubtasks,
  assignSubtask,
  deleteSubtask,
  renameSubtask,
  reorderSubtasks,
  setSubtaskDone,
} from "@/backend/actions/subtasks";
import { parseSubtaskLines, subtaskProgress } from "@/shared/domain/subtasks";
import type { MemberSummary, SubtaskRef, TaskView } from "@/shared/domain/types";
import { useT, useTx } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Dot } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Progress } from "@/frontend/components/ui/feedback";
import { Input, Textarea } from "@/frontend/components/ui/field";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/frontend/components/ui/menu";
import { useTasks } from "./task-store";

const UNASSIGNED = "__unassigned__";
/** The row's columns: grip + tick + name, assignee, status, remove. */
const GRID = "grid grid-cols-[minmax(0,1fr)_3.5rem_5rem_1.25rem] items-center gap-x-2";

/**
 * A task's checklist, and the two ways of filling it in.
 *
 * Adding steps is the interaction this section lives or dies by: nobody adds
 * one, they add six. So the field does not close when a step is saved — Enter
 * writes the line and leaves the cursor where it is, ready for the next one,
 * and an empty Enter is what says you are finished. That turns six steps into
 * six lines of typing instead of six round trips through a button.
 *
 * The other half is the list you already have somewhere else: in a brief, in a
 * message, in your notes. "Paste a list" is a textarea where every line
 * becomes a step, with the count on the button so a paste can be checked
 * before it is written. Pasting several lines into the one-by-one field
 * switches to it rather than silently creating them, because a clipboard is
 * the easiest way to create twenty of something by accident.
 *
 * The order is hand-arranged and nothing re-sorts it, because a checklist is
 * a sequence — first this, then that — in a way a board of independent tasks
 * is not. That is also why reordering needs no "manual order" mode the way
 * the board does: there is no automatic order here to override.
 */

type Mode = "ONE" | "RAW";

/** Client-side identity for a step the server has not acknowledged yet. */
let pendingSeq = 0;

export function TaskSubtasks({
  task,
  onCapturesEscapeChange,
}: {
  task: TaskView;
  /**
   * Tells the drawer that Escape belongs to the composer — ending the run of
   * steps — rather than to the drawer. Without it the first Escape would close
   * the whole thing, taking the half-typed line with it.
   */
  onCapturesEscapeChange?: (captures: boolean) => void;
}) {
  const { upsertTask, members } = useTasks();
  const t = useT();
  const tx = useTx();

  const [composing, setComposing] = useState(false);
  const [mode, setMode] = useState<Mode>("ONE");
  /** Finished steps fold away under a count, so the list is what is left. */
  const [showClosed, setShowClosed] = useState(false);
  const [line, setLine] = useState("");
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);

  /** Steps typed but not yet written, shown in place so the list never lags. */
  const [pending, setPending] = useState<{ key: number; title: string }[]>([]);
  /** Ticks applied locally, so a checkbox responds to the click, not the server. */
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  /** A hand-arranged order, held until the server has it. */
  const [arranged, setArranged] = useState<string[] | null>(null);

  const lineRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    onCapturesEscapeChange?.(composing);
  }, [composing, onCapturesEscapeChange]);

  useEffect(() => () => onCapturesEscapeChange?.(false), [onCapturesEscapeChange]);

  const rows = task.subtasks.filter((subtask) => !removed.includes(subtask.id));
  const visible = rows.map((subtask) => ({
    ...subtask,
    done: ticks[subtask.id] ?? subtask.done,
  }));
  // A drag reorders the list here first, so it does not snap back to the
  // server's order for the length of a round trip.
  const ordered = arranged
    ? [...visible].sort((a, b) => arranged.indexOf(a.id) - arranged.indexOf(b.id))
    : visible;
  const progress = subtaskProgress(visible);
  const bulkCount = parseSubtaskLines(bulk).length;
  const openRows = ordered.filter((subtask) => !subtask.done);
  const closedRows = ordered.filter((subtask) => subtask.done);
  // Nothing open: the finished list is the list, so it stays in view.
  const listed = showClosed || openRows.length === 0 ? ordered : openRows;

  const sensors = useSensors(
    // Travel before a drag starts, so clicking a title to rename it — or the
    // tick — still reads as a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Writes a batch of steps, which is one typed line or a whole pasted list.
   *
   * The optimistic rows are keyed rather than counted, so two adds in flight
   * at once — easy to do by typing fast — clear the right ones when they land.
   */
  async function add(text: string): Promise<boolean> {
    const titles = parseSubtaskLines(text);
    if (titles.length === 0) return false;

    const batch = titles.map((title) => ({ key: (pendingSeq += 1), title }));
    const keys = new Set(batch.map((row) => row.key));
    setPending((prev) => [...prev, ...batch]);

    const result = await addSubtasks({ taskId: task.id, text });

    setPending((prev) => prev.filter((row) => !keys.has(row.key)));
    if (result.ok) {
      upsertTask(result.data);
      return true;
    }
    toast.error(t("detail.subtasks.addFailed"), { description: result.error });
    return false;
  }

  function open(next: Mode = "ONE") {
    setComposing(true);
    setMode(next);
    // Already open: the header button means "put me back in the field".
    requestAnimationFrame(() => {
      if (next === "ONE") lineRef.current?.focus();
      else bulkRef.current?.focus();
    });
  }

  function close() {
    setComposing(false);
    setLine("");
    setBulk("");
  }

  async function submitBulk() {
    if (bulkCount === 0 || saving) return;
    setSaving(true);
    const added = await add(bulk);
    setSaving(false);
    // The batch was the job: on success the composer closes onto the new list.
    if (added) close();
  }

  function toggle(subtask: SubtaskRef, done: boolean) {
    setTicks((prev) => ({ ...prev, [subtask.id]: done }));
    void setSubtaskDone({ id: subtask.id, done }).then((result) => {
      if (result.ok) upsertTask(result.data);
      else toast.error(t("detail.saveFailed"), { description: result.error });
      setTicks((prev) => {
        const next = { ...prev };
        delete next[subtask.id];
        return next;
      });
    });
  }

  function assign(subtask: SubtaskRef, memberId: string | null) {
    void assignSubtask({ id: subtask.id, memberId }).then((result) => {
      if (result.ok) upsertTask(result.data);
      else toast.error(t("detail.saveFailed"), { description: result.error });
    });
  }

  function remove(subtask: SubtaskRef) {
    setRemoved((prev) => [...prev, subtask.id]);
    void deleteSubtask(subtask.id).then((result) => {
      if (result.ok) upsertTask(result.data);
      else {
        setRemoved((prev) => prev.filter((id) => id !== subtask.id));
        toast.error(t("detail.saveFailed"), { description: result.error });
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = ordered.map((subtask) => subtask.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = arrayMove(ids, from, to);
    setArranged(next);

    void reorderSubtasks({ taskId: task.id, orderedIds: next }).then((result) => {
      if (result.ok) upsertTask(result.data);
      else toast.error(t("tasks.order.saveFailed"), { description: result.error });
      // Cleared in the same tick as the task it belongs to, so the list is
      // never rendered between the two orders. A failure reverts here.
      setArranged(null);
    });
  }

  async function rename(subtask: SubtaskRef, title: string) {
    const result = await renameSubtask({ id: subtask.id, title });
    if (result.ok) upsertTask(result.data);
    else toast.error(t("detail.saveFailed"), { description: result.error });
  }

  return (
    <section className="px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5">
          <ListChecks className="h-3 w-3" />
          {t("detail.subtasks")}
        </p>
        <div className="flex items-center gap-2">
          {progress && (
            <span className="flex items-center gap-2 text-2xs tabular-nums text-text-faint">
              <span className={cn(progress.done === progress.total && "text-success")}>
                {progress.done === progress.total
                  ? t("detail.subtasks.allDone")
                  : t("detail.subtasks.open", { count: progress.total - progress.done })}
              </span>
              <Progress
                value={progress.percent}
                tone={progress.done === progress.total ? "bg-success" : "bg-accent"}
                aria-label={t("detail.subtasks.progress", {
                  done: progress.done,
                  total: progress.total,
                })}
                className="w-12"
              />
            </span>
          )}
          <Button variant="ghost" size="xs" onClick={() => open("ONE")}>
            <Plus className="h-3 w-3" />
            {t("common.add")}
          </Button>
        </div>
      </div>

      {ordered.length > 0 && (
        <div
          className={cn(
            GRID,
            "border-b border-line px-1 pb-1 text-2xs font-medium text-text-faint",
          )}
        >
          <span className="pl-5">{t("detail.subtasks.column.name")}</span>
          <span>{t("tasks.table.column.assignee")}</span>
          <span>{t("tasks.table.column.status")}</span>
          <span />
        </div>
      )}

      {listed.length > 0 && (
        <DndContext
          // The drawer renders inside the board's own context; a stable id of
          // its own keeps the two apart.
          id="meetup-subtasks"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={listed.map((subtask) => subtask.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul>
              {listed.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  members={members}
                  onToggle={(done) => toggle(subtask, done)}
                  onAssign={(memberId) => assign(subtask, memberId)}
                  onRename={(title) => void rename(subtask, title)}
                  onRemove={() => remove(subtask)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {pending.length > 0 && (
        <ul className="space-y-px" aria-hidden>
          {pending.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-2 border-b border-line px-1 py-1.5 pl-5 opacity-50"
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">
                {row.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {ordered.length === 0 && pending.length === 0 && !composing && (
        <>
          <button
            onClick={() => open("ONE")}
            className="-mx-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-hover"
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-text-faint" />
            <span className="text-[13px] text-text-faint">
              {t("detail.subtasks.addFirst")}
            </span>
          </button>
          <p className="mt-1 px-1 text-2xs leading-4 text-text-faint">
            {t("detail.subtasks.empty")}
          </p>
        </>
      )}

      {ordered.length > 0 && !composing && (
        <button
          onClick={() => open("ONE")}
          className="-mx-1 flex w-full items-center gap-2 rounded px-1 py-1.5 pl-6 text-left hover:bg-hover"
        >
          <Plus className="h-3.5 w-3.5 shrink-0 text-text-faint" />
          <span className="text-[13px] text-text-faint">{t("detail.subtasks.addTask")}</span>
        </button>
      )}

      {composing && (
        <div className="mt-1.5 space-y-1.5">

          {mode === "ONE" ? (
            <>
              <Input
                ref={lineRef}
                autoFocus
                value={line}
                placeholder={t("detail.subtasks.placeholder")}
                aria-label={t("detail.subtasks.add")}
                onChange={(event) => setLine(event.target.value)}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text");
                  if (parseSubtaskLines(text).length < 2) return;
                  // A pasted list is a list, whichever field it landed in.
                  event.preventDefault();
                  const carried = [line.trim(), text.trim()]
                    .filter(Boolean)
                    .join("\n");
                  setLine("");
                  setBulk(`${carried}\n`);
                  open("RAW");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                    return;
                  }
                  // `isComposing` guards an IME: the first Enter there commits
                  // the candidate word, and is not a submit.
                  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  // Enter on an empty field is how the run of steps ends.
                  if (!line.trim()) {
                    close();
                    return;
                  }
                  const text = line;
                  setLine("");
                  void add(text);
                }}
                onBlur={() => {
                  // Never lose a typed line to a stray click; the field stays
                  // open, so this reads as the step landing early.
                  if (!line.trim()) return;
                  const text = line;
                  setLine("");
                  void add(text);
                }}
                className="h-8"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xs text-text-faint">
                  {tx("detail.subtasks.hintOne", {
                    enter: <kbd className="font-sans">↵</kbd>,
                    esc: <kbd className="font-sans">Esc</kbd>,
                  })}
                </p>
                <Button variant="ghost" size="xs" onClick={close}>
                  {t("common.done")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Textarea
                ref={bulkRef}
                autoFocus
                value={bulk}
                rows={4}
                placeholder={t("detail.subtasks.rawPlaceholder")}
                aria-label={t("detail.subtasks.mode.raw")}
                onChange={(event) => setBulk(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                    return;
                  }
                  // Enter is a newline here — this field is a list — so the
                  // batch is committed with the platform's save chord.
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void submitBulk();
                  }
                }}
                className="min-h-[5.5rem] leading-5"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xs text-text-faint">
                  {tx("detail.subtasks.hintRaw", {
                    save: <kbd className="font-sans">⌘↵</kbd>,
                    esc: <kbd className="font-sans">Esc</kbd>,
                  })}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="xs" onClick={close}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    size="xs"
                    disabled={bulkCount === 0}
                    loading={saving}
                    loadingLabel={t("common.saving")}
                    onClick={() => void submitBulk()}
                  >
                    {bulkCount > 0
                      ? t("detail.subtasks.addCount", { count: bulkCount })
                      : t("detail.subtasks.add")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {closedRows.length > 0 && openRows.length > 0 && (
        <button
          onClick={() => setShowClosed((prev) => !prev)}
          className="mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-2xs text-text-faint hover:bg-hover hover:text-text"
        >
          {showClosed ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {showClosed
            ? t("detail.subtasks.hideClosed")
            : t("detail.subtasks.showClosed", { count: closedRows.length })}
        </button>
      )}
    </section>
  );
}

function SubtaskRow({
  subtask,
  members,
  onToggle,
  onAssign,
  onRename,
  onRemove,
}: {
  subtask: SubtaskRef & { done: boolean };
  members: MemberSummary[];
  onToggle: (done: boolean) => void;
  onAssign: (memberId: string | null) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id });

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== subtask.title) onRename(next);
    else setDraft(subtask.title);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        GRID,
        "group/subtask border-b border-line px-1 py-1 hover:bg-hover",
        isDragging && "relative z-10 rounded bg-raised shadow-popover",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
      {/* A handle rather than the whole row: the row's other half is a title
          you click to rename and a tick you click to finish. */}
      <button
        {...attributes}
        {...listeners}
        aria-label={t("detail.subtasks.reorder", { title: subtask.title })}
        className="grab -ml-0.5 shrink-0 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-text-muted focus-visible:opacity-100 group-hover/subtask:opacity-100"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <button
        onClick={() => onToggle(!subtask.done)}
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

      {editing ? (
        <Input
          autoFocus
          value={draft}
          aria-label={t("detail.subtasks.rename", { title: subtask.title })}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(subtask.title);
              setEditing(false);
            }
          }}
          className="h-6 flex-1 text-[13px]"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(subtask.title);
            setEditing(true);
          }}
          className="min-w-0 flex-1 truncate text-left text-[13px] leading-5"
        >
          <span className={subtask.done ? "text-text-faint line-through" : "text-text-secondary"}>
            {subtask.title}
          </span>
        </button>
      )}
      </div>

      <Menu>
        <MenuTrigger asChild>
          <button
            aria-label={
              subtask.assignee
                ? t("detail.subtasks.assignedTo", {
                    title: subtask.title,
                    name: subtask.assignee.name,
                  })
                : t("detail.subtasks.assign", { title: subtask.title })
            }
            className="flex h-6 w-fit items-center rounded-md px-0.5 transition-colors hover:bg-raised data-[state=open]:bg-raised"
          >
            {subtask.assignee ? (
              <Avatar member={subtask.assignee} size="sm" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-line-strong text-text-faint group-hover/subtask:border-accent group-hover/subtask:text-accent">
                <UserPlus className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>{t("tasks.table.column.assignee")}</MenuLabel>
          <MenuRadioGroup
            value={subtask.assignee?.id ?? UNASSIGNED}
            onValueChange={(value) => onAssign(value === UNASSIGNED ? null : value)}
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

      <button
        onClick={() => onToggle(!subtask.done)}
        aria-label={t("detail.subtasks.setStatus", { title: subtask.title })}
        className="flex h-6 w-fit items-center rounded-md px-0.5 transition-colors hover:bg-raised"
      >
        <Badge tone={subtask.done ? "tone-success" : "tone-neutral"} className="min-w-0">
          <Dot tone={subtask.done ? "tone-success" : "tone-neutral"} />
          <span className="truncate">
            {t(subtask.done ? "detail.subtasks.status.done" : "detail.subtasks.status.open")}
          </span>
        </Badge>
      </button>

      <button
        onClick={onRemove}
        aria-label={t("detail.subtasks.remove", { title: subtask.title })}
        className="shrink-0 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover/subtask:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
