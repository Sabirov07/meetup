"use client";

import { ListChecks, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { MAX_SUBTASKS_PER_TASK, parseSubtaskLines } from "@/shared/domain/subtasks";
import { useT, useTx } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Label } from "@/frontend/components/ui/field";

/**
 * The checklist of a task that does not exist yet.
 *
 * Nothing here is saved on its own: the rows are plain strings the creation
 * form sends along with the task. That is what lets it feel like typing a
 * list rather than filing requests — every row is an input, Enter opens the
 * next one, Backspace on an empty one closes it, the arrows walk up and down,
 * and a pasted list becomes rows without a mode switch. Steps land as the
 * task is created, so the form never has to leave to add them afterwards.
 */

let seq = 0;
const nextKey = () => (seq += 1);

export type DraftStep = { key: number; title: string };

export function SubtaskDraftList({
  value,
  onChange,
  disabled,
}: {
  value: DraftStep[];
  onChange: (next: DraftStep[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const tx = useTx();
  const [draft, setDraft] = useState("");
  const rowRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const draftRef = useRef<HTMLInputElement>(null);

  const full = value.length >= MAX_SUBTASKS_PER_TASK;

  function focusRow(key: number | "draft", caret: "start" | "end" = "end") {
    requestAnimationFrame(() => {
      const el = key === "draft" ? draftRef.current : rowRefs.current.get(key);
      if (!el) return;
      el.focus();
      const at = caret === "end" ? el.value.length : 0;
      el.setSelectionRange(at, at);
    });
  }

  /** Writes rows in place of `at` (or at the end), and returns the last one. */
  function insert(titles: string[], at: number = value.length): DraftStep | null {
    const room = MAX_SUBTASKS_PER_TASK - value.length;
    const rows = titles.slice(0, Math.max(room, 0)).map((title) => ({ key: nextKey(), title }));
    if (rows.length === 0) return null;
    onChange([...value.slice(0, at), ...rows, ...value.slice(at)]);
    return rows[rows.length - 1];
  }

  function commitDraft() {
    const titles = parseSubtaskLines(draft);
    if (titles.length === 0) return;
    insert(titles);
    setDraft("");
  }

  function removeAt(index: number) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    const previous = next[index - 1];
    if (previous) focusRow(previous.key);
    else if (next[0]) focusRow(next[0].key, "start");
    else focusRow("draft");
  }

  /** A multi-line paste anywhere in the list becomes several rows. */
  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number | null) {
    const text = event.clipboardData.getData("text");
    const titles = parseSubtaskLines(text);
    if (titles.length < 2) return;
    event.preventDefault();

    if (index === null) {
      const merged = [draft.trim(), ...titles].filter(Boolean);
      insert(merged);
      setDraft("");
      focusRow("draft");
      return;
    }

    // The current row keeps what was typed before the caret plus the first
    // pasted line; the rest open underneath it.
    const el = event.currentTarget;
    const head = el.value.slice(0, el.selectionStart ?? el.value.length);
    const tail = el.value.slice(el.selectionEnd ?? el.value.length);
    const [first, ...rest] = titles;
    const updated = value.map((row, i) =>
      i === index ? { ...row, title: `${head}${first}`.trim() } : row,
    );
    const lastTitle = rest.length > 0 ? `${rest[rest.length - 1]}${tail}` : null;
    const extra = lastTitle
      ? [...rest.slice(0, -1), lastTitle]
      : tail.trim()
        ? [tail.trim()]
        : [];
    const room = MAX_SUBTASKS_PER_TASK - updated.length;
    const rows = extra.slice(0, Math.max(room, 0)).map((title) => ({ key: nextKey(), title }));
    onChange([...updated.slice(0, index + 1), ...rows, ...updated.slice(index + 1)]);
    const last = rows[rows.length - 1] ?? updated[index];
    focusRow(last.key);
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    const row = value[index];
    const el = event.currentTarget;
    if (event.nativeEvent.isComposing) return;

    switch (event.key) {
      case "Enter": {
        // Never the form's submit: Enter here means "next step". Splits the
        // row at the caret, so a step can be broken in two.
        event.preventDefault();
        const head = el.value.slice(0, el.selectionStart ?? el.value.length).trim();
        const tail = el.value.slice(el.selectionEnd ?? el.value.length).trim();
        if (!head) {
          // Empty row: nothing to keep, jump straight to the add field.
          if (!tail && index === value.length - 1) {
            onChange(value.filter((_, i) => i !== index));
            focusRow("draft");
          }
          return;
        }
        const updated = value.map((r, i) => (i === index ? { ...r, title: head } : r));
        if (index === value.length - 1 && !tail) {
          onChange(updated);
          focusRow("draft");
          return;
        }
        if (updated.length >= MAX_SUBTASKS_PER_TASK) {
          onChange(updated);
          return;
        }
        const fresh = { key: nextKey(), title: tail };
        onChange([...updated.slice(0, index + 1), fresh, ...updated.slice(index + 1)]);
        focusRow(fresh.key, "start");
        return;
      }
      case "Backspace": {
        if (el.value !== "") return;
        event.preventDefault();
        removeAt(index);
        return;
      }
      case "Escape": {
        // Only an empty row is thrown away; a typed one keeps its text and the
        // dialog stays open either way.
        if (el.value === "") {
          event.preventDefault();
          event.stopPropagation();
          removeAt(index);
        }
        return;
      }
      case "ArrowUp": {
        if (index === 0) return;
        event.preventDefault();
        focusRow(value[index - 1].key);
        return;
      }
      case "ArrowDown": {
        event.preventDefault();
        const below = value[index + 1];
        if (below) focusRow(below.key);
        else focusRow("draft");
        return;
      }
      default:
        void row;
    }
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      // An empty Enter in the add field would otherwise submit the whole form
      // from the middle of a list, which is never what someone meant.
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      focusRow(value[value.length - 1].key);
      return;
    }
    if (event.key === "ArrowUp" && value.length > 0) {
      event.preventDefault();
      focusRow(value[value.length - 1].key);
      return;
    }
    if (event.key === "Escape" && draft !== "") {
      event.preventDefault();
      event.stopPropagation();
      setDraft("");
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <ListChecks className="h-3 w-3 text-text-faint" />
          {t("form.field.subtasks")}
        </Label>
        <span className="text-2xs tabular-nums text-text-faint">
          {value.length > 0
            ? t("form.field.subtasksCount", { count: value.length })
            : t("form.field.subtasksHint")}
        </span>
      </div>

      <div
        className={cn(
          "rounded-md border border-line-strong bg-canvas transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25",
          disabled && "opacity-50",
        )}
      >
        {value.length > 0 && (
          <ol className="py-1">
            {value.map((row, index) => (
              <li
                key={row.key}
                className="group/step flex items-center gap-2 px-2 transition-colors hover:bg-hover/60"
              >
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
                />
                <input
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.key, el);
                    else rowRefs.current.delete(row.key);
                  }}
                  value={row.title}
                  disabled={disabled}
                  aria-label={t("form.field.subtasksStep", { n: index + 1 })}
                  onChange={(event) =>
                    onChange(
                      value.map((r, i) =>
                        i === index ? { ...r, title: event.target.value } : r,
                      ),
                    )
                  }
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  onPaste={(event) => onPaste(event, index)}
                  onBlur={() => {
                    // A row left blank is a row nobody wanted.
                    if (row.title.trim() === "") {
                      onChange(value.filter((_, i) => i !== index));
                    } else if (row.title !== row.title.trim()) {
                      onChange(
                        value.map((r, i) =>
                          i === index ? { ...r, title: r.title.trim() } : r,
                        ),
                      );
                    }
                  }}
                  className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  aria-label={t("form.field.subtasksRemove", { title: row.title })}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => removeAt(index)}
                  className="shrink-0 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover/step:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ol>
        )}

        {!full && (
          <div
            className={cn(
              "flex items-center gap-2 px-2",
              value.length > 0 && "border-t border-line/60",
            )}
          >
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-line-strong"
            />
            <input
              ref={draftRef}
              value={draft}
              disabled={disabled}
              placeholder={t(
                value.length > 0 ? "form.field.subtasksNext" : "form.field.subtasksPlaceholder",
              )}
              aria-label={t("detail.subtasks.add")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onDraftKeyDown}
              onPaste={(event) => onPaste(event, null)}
              onBlur={commitDraft}
              className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
            />
          </div>
        )}
      </div>

      <p className="text-2xs leading-4 text-text-faint">
        {tx("form.field.subtasksHelp", {
          enter: <kbd className="font-sans">↵</kbd>,
          backspace: <kbd className="font-sans">⌫</kbd>,
        })}
      </p>
    </div>
  );
}
