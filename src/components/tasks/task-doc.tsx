"use client";

import {
  Check,
  FileText,
  Loader2,
  Maximize2,
  Pencil,
  PenLine,
  Columns2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { updateTask } from "@/lib/actions/tasks";
import { docStats, isEmptyDoc, toggleCheckboxLine } from "@/lib/doc/markdown";
import type { TaskView } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/feedback";
import { DocContent } from "@/components/doc/doc-content";
import { DocEditor } from "@/components/doc/doc-editor";
import { useTasks } from "./task-store";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/** How long to sit on a keystroke before writing the body back. */
const AUTOSAVE_DELAY = 900;

/**
 * A task's document body: the drawer section, and the full-width view behind
 * the expand button.
 *
 * Saving is on a timer rather than a button, because a document is written in
 * passes and nobody should have to remember to commit one — the only explicit
 * save is ⌘↵, which also closes the editor. The draft is flushed when the
 * section unmounts (the drawer closing, or another task opening), so an
 * in-flight paragraph is never lost to a click elsewhere.
 */
export function TaskDoc({
  task,
  onCapturesEscapeChange,
}: {
  task: TaskView;
  /**
   * Tells the drawer around this section that Escape belongs to the editor —
   * to close its block menu, or to leave the editor — rather than to the
   * drawer. Without it the first Escape would close the whole thing.
   */
  onCapturesEscapeChange?: (captures: boolean) => void;
}) {
  const { upsertTask } = useTasks();

  const [draft, setDraft] = useState(task.description ?? "");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedView, setExpandedView] = useState<"write" | "split">("split");
  const [state, setState] = useState<SaveState>("idle");

  // Refs so the debounce, ⌘↵ and the unmount flush all read the same truth
  // without re-arming effects on every keystroke.
  const draftRef = useRef(draft);
  const savedRef = useRef(task.description ?? "");
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const save = useCallback(
    async (next: string) => {
      if (next === savedRef.current) return;
      setState("saving");
      const result = await updateTask({
        id: task.id,
        description: next.trim() ? next : null,
      });
      if (result.ok) {
        savedRef.current = next;
        upsertTask(result.data);
        setState("saved");
      } else {
        setState("error");
        toast.error("Could not save the document", { description: result.error });
      }
    },
    [task.id, upsertTask],
  );

  // Debounced autosave.
  useEffect(() => {
    if (draft === savedRef.current) return;
    setState("dirty");
    const timer = window.setTimeout(() => void save(draft), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [draft, save]);

  // "Saved" is a confirmation, not a status; it fades back out.
  useEffect(() => {
    if (state !== "saved") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Flush on the way out — the drawer can close mid-sentence.
  useEffect(
    () => () => {
      if (draftRef.current !== savedRef.current) void save(draftRef.current);
    },
    [save],
  );

  // The block menu inside the expanded dialog has the same claim on Escape.
  const menuOpen = useRef(false);

  useEffect(() => {
    onCapturesEscapeChange?.(editing && !expanded);
  }, [editing, expanded, onCapturesEscapeChange]);

  useEffect(() => () => onCapturesEscapeChange?.(false), [onCapturesEscapeChange]);

  const stats = docStats(draft);
  const empty = isEmptyDoc(draft);

  /** A checkbox clicked in the read view writes straight through. */
  const toggleCheckbox = useCallback(
    (line: number) => {
      const next = toggleCheckboxLine(draftRef.current, line);
      if (next === draftRef.current) return;
      setDraft(next);
      void save(next);
    },
    [save],
  );

  function finish() {
    setEditing(false);
    setExpanded(false);
    void save(draftRef.current);
  }

  return (
    <section className="px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          Document
        </p>
        <div className="flex items-center gap-1.5">
          <SaveBadge state={state} />
          {!empty && <DocStatsLine stats={stats} />}
          {!editing && (
            <Tooltip content="Edit">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit document"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Open full width">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Open the document full width"
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {editing ? (
        <DocEditor
          value={draft}
          onChange={setDraft}
          taskId={task.id}
          autoFocus
          onSaveRequest={finish}
          onExitRequest={finish}
          onMenuOpenChange={(open) => {
            menuOpen.current = open;
          }}
          footer={
            <div className="flex items-center justify-between gap-2 pt-1.5">
              <p className="text-2xs text-text-faint">
                <kbd className="font-sans">/</kbd> for blocks · paste or drop an image ·{" "}
                <kbd className="font-sans">⌘↵</kbd> when done
              </p>
              <Button size="sm" variant="secondary" onClick={finish}>
                Done
              </Button>
            </div>
          }
        />
      ) : empty ? (
        <button
          onClick={() => setEditing(true)}
          className="-mx-1 flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-hover"
        >
          <PenLine className="h-3.5 w-3.5 shrink-0 text-text-faint" />
          <span className="text-[13px] text-text-faint">
            Write the brief — headings, checklists, screenshots.
          </span>
        </button>
      ) : (
        <div
          // Clicking the prose opens the editor, but not when the click landed
          // on something that already does its own thing.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a,button,input,label")) return;
            setEditing(true);
          }}
          className="-mx-1 cursor-text rounded px-1 py-0.5"
        >
          <DocContent markdown={draft} onToggleCheckbox={toggleCheckbox} />
        </div>
      )}

      {/* Full-width doc view: the same editor with room to work. */}
      <Dialog
        open={expanded}
        onOpenChange={(open) => {
          if (!open) finish();
        }}
      >
        {expanded && (
          <DialogContent
            showClose={false}
            aria-describedby={undefined}
            onEscapeKeyDown={(event) => {
              // Escape closes the block menu first, this view second.
              if (menuOpen.current) event.preventDefault();
            }}
            className="h-[88vh] max-h-[88vh] max-w-[min(66rem,calc(100%-3rem))]"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">{task.title}</DialogTitle>
                <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-faint">
                  <FileText className="h-3 w-3" />
                  Document
                  {!empty && (
                    <>
                      <span aria-hidden>·</span>
                      <DocStatsLine stats={stats} />
                    </>
                  )}
                </p>
              </div>
              <SaveBadge state={state} />
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip content={expandedView === "split" ? "Hide the preview" : "Show the preview"}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Toggle the preview"
                    aria-pressed={expandedView === "split"}
                    onClick={() =>
                      setExpandedView((view) => (view === "split" ? "write" : "split"))
                    }
                    className={cn(expandedView === "split" && "text-accent-bright")}
                  >
                    <Columns2 className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
                <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={finish}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-5 py-4">
              <DocEditor
                value={draft}
                onChange={setDraft}
                taskId={task.id}
                autoFocus
                grow={false}
                view={expandedView}
                onSaveRequest={finish}
                onMenuOpenChange={(open) => {
                  menuOpen.current = open;
                }}
                className="h-full"
                footer={
                  <p className="shrink-0 pt-2 text-2xs text-text-faint">
                    Autosaves as you write. <kbd className="font-sans">/</kbd> inserts a block,{" "}
                    <kbd className="font-sans">⌘K</kbd> links the selection, and images can be
                    pasted or dropped anywhere in the text.
                  </p>
                }
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}

function DocStatsLine({ stats }: { stats: ReturnType<typeof docStats> }) {
  const parts = [`${stats.words} ${stats.words === 1 ? "word" : "words"}`];
  if (stats.images > 0) parts.push(`${stats.images} ${stats.images === 1 ? "image" : "images"}`);
  if (stats.checklist) parts.push(`${stats.checklist.done}/${stats.checklist.total} done`);
  if (stats.words > 120) parts.push(`~${stats.readingMinutes} min`);
  return <span className="text-2xs text-text-faint">{parts.join(" · ")}</span>;
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-2xs text-text-faint">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-2xs text-success">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-2xs text-danger">Not saved</span>;
  }
  return <span className="text-2xs text-text-faint">Unsaved</span>;
}
