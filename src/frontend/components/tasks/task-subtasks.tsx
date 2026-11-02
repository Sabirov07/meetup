"use client";

import { Check, ListChecks, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addSubtasks,
  deleteSubtask,
  renameSubtask,
  setSubtaskDone,
} from "@/backend/actions/subtasks";
import { parseSubtaskLines, subtaskProgress } from "@/shared/domain/subtasks";
import type { SubtaskRef, TaskView } from "@/shared/domain/types";
import { useT, useTx } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Progress, Tooltip } from "@/frontend/components/ui/feedback";
import { Input, Textarea } from "@/frontend/components/ui/field";
import { useTasks } from "./task-store";

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
  const { upsertTask } = useTasks();
  const t = useT();
  const tx = useTx();

  const [composing, setComposing] = useState(false);
  const [mode, setMode] = useState<Mode>("ONE");
  const [line, setLine] = useState("");
  const [bulk, setBulk] = useState("");
  const [saving, setSaving] = useState(false);

  /** Steps typed but not yet written, shown in place so the list never lags. */
  const [pending, setPending] = useState<{ key: number; title: string }[]>([]);
  /** Ticks applied locally, so a checkbox responds to the click, not the server. */
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<string[]>([]);

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
  const progress = subtaskProgress(visible);
  const bulkCount = parseSubtaskLines(bulk).length;

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

  /** Carries whatever is typed across the switch, so neither mode loses it. */
  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "RAW") {
      const carried = [bulk.trimEnd(), line.trim()].filter(Boolean).join("\n");
      setBulk(carried ? `${carried}\n` : "");
      setLine("");
    } else {
      const lines = parseSubtaskLines(bulk);
      // A single line moves into the field; a real list stays where it is, so
      // switching back and forth cannot throw nineteen steps away.
      if (lines.length <= 1) {
        setLine(lines[0] ?? "");
        setBulk("");
      }
    }
    open(next);
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
        <div className="flex items-center gap-1.5">
          {progress && (
            <span className="text-2xs tabular-nums text-text-faint">
              {t("detail.subtasks.progress", {
                done: progress.done,
                total: progress.total,
              })}
            </span>
          )}
          <Button variant="ghost" size="xs" onClick={() => open("ONE")}>
            <Plus className="h-3 w-3" />
            {t("common.add")}
          </Button>
        </div>
      </div>

      {progress && (
        <Progress
          value={progress.percent}
          tone={progress.done === progress.total ? "bg-success" : "bg-accent"}
          aria-label={t("detail.subtasks.progress", {
            done: progress.done,
            total: progress.total,
          })}
          className="mb-2"
        />
      )}

      {visible.length > 0 && (
        <ul className="space-y-px">
          {visible.map((subtask) => (
            <SubtaskRow
              key={subtask.id}
              subtask={subtask}
              onToggle={(done) => toggle(subtask, done)}
              onRename={(title) => void rename(subtask, title)}
              onRemove={() => remove(subtask)}
            />
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="space-y-px" aria-hidden>
          {pending.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-2 px-1 py-1 opacity-50"
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">
                {row.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 && pending.length === 0 && !composing && (
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

      {composing && (
        <div className="mt-1.5 space-y-1.5">
          <ModeSwitch value={mode} onChange={switchMode} />

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
    </section>
  );
}

/** Which way of adding you are looking at. */
function ModeSwitch({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (next: Mode) => void;
}) {
  const t = useT();
  const modes: { mode: Mode; label: string; hint: string }[] = [
    {
      mode: "ONE",
      label: t("detail.subtasks.mode.one"),
      hint: t("detail.subtasks.mode.oneHint"),
    },
    {
      mode: "RAW",
      label: t("detail.subtasks.mode.raw"),
      hint: t("detail.subtasks.mode.rawHint"),
    },
  ];

  return (
    <div
      role="group"
      aria-label={t("detail.subtasks.mode.label")}
      className="flex w-fit items-center gap-0.5 rounded-md border border-line bg-canvas p-0.5"
    >
      {modes.map(({ mode, label, hint }) => (
        // The explanation goes in a tooltip rather than `title`, which would
        // replace the accessible name with it.
        <Tooltip key={mode} content={hint}>
          <button
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={value === mode}
            className={cn(
              "h-5 rounded-[5px] px-2 text-2xs font-medium transition-colors",
              value === mode
                ? "bg-raised text-text"
                : "text-text-muted hover:bg-hover hover:text-text",
            )}
          >
            {label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
  onRename,
  onRemove,
}: {
  subtask: SubtaskRef & { done: boolean };
  onToggle: (done: boolean) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.title);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== subtask.title) onRename(next);
    else setDraft(subtask.title);
  }

  return (
    <li className="group/subtask -mx-1 flex items-center gap-2 rounded px-1 py-1 hover:bg-hover">
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
