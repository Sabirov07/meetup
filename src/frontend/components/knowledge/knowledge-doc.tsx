"use client";

import {
  ArrowLeft,
  Check,
  Columns2,
  MoreHorizontal,
  Pencil,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { deleteKnowledgeDoc, updateKnowledgeDoc } from "@/backend/actions/knowledge";
import { docStats, isEmptyDoc, toggleCheckboxLine } from "@/shared/doc/markdown";
import type { KnowledgeDocView } from "@/shared/domain/types";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Button } from "@/frontend/components/ui/button";
import { Tooltip } from "@/frontend/components/ui/feedback";
import { Input } from "@/frontend/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/frontend/components/ui/menu";
import { RelativeTime } from "@/frontend/components/ui/relative-time";
import { DocContent } from "@/frontend/components/doc/doc-content";
import { DocEditor } from "@/frontend/components/doc/doc-editor";
import { DocStatsLine, SaveBadge } from "@/frontend/components/doc/doc-meta";
import { useAutosavedDoc } from "@/frontend/components/doc/use-autosaved-doc";

/**
 * One page of the knowledge library.
 *
 * The same document editor tasks use, given the width a document deserves:
 * a single reading column, the title as an ordinary input rather than a
 * modal, and labels edited in place. Everything saves itself — there is no
 * Save button here, because a page is written over several sittings and a
 * forgotten click would lose all of them.
 */
export function KnowledgeDocPage({ doc: initial }: { doc: KnowledgeDocView }) {
  const router = useRouter();

  const [doc, setDoc] = useState(initial);
  const [editing, setEditing] = useState(isEmptyDoc(initial.body));
  const [view, setView] = useState<"write" | "split">("write");
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [addingLabel, setAddingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  const saveBody = useCallback(async (next: string) => {
    const result = await updateKnowledgeDoc({ id: initial.id, body: next.trim() ? next : null });
    if (!result.ok) return result.error;
    setDoc(result.data);
    return null;
  }, [initial.id]);

  const { draft, setDraft, replace, state, flush } = useAutosavedDoc({
    initial: initial.body ?? "",
    save: saveBody,
    errorTitle: "Could not save this page",
  });

  const stats = docStats(draft);
  const empty = isEmptyDoc(draft);

  async function patch(change: Parameters<typeof updateKnowledgeDoc>[0]) {
    const result = await updateKnowledgeDoc(change);
    if (result.ok) setDoc(result.data);
    else toast.error("Could not save that change", { description: result.error });
    return result.ok;
  }

  function commitTitle() {
    const next = titleDraft.trim();
    if (!next || next === doc.title) {
      setTitleDraft(doc.title);
      return;
    }
    void patch({ id: doc.id, title: next });
  }

  function addLabel() {
    const label = labelDraft.trim().toLowerCase();
    setLabelDraft("");
    setAddingLabel(false);
    if (!label || doc.labels.includes(label)) return;
    void patch({ id: doc.id, labels: [...doc.labels, label] });
  }

  async function remove() {
    const result = await deleteKnowledgeDoc(doc.id);
    if (!result.ok) {
      toast.error("Could not delete this page", { description: result.error });
      return;
    }
    toast.success("Page deleted", { description: doc.title });
    router.push("/knowledge");
  }

  return (
    <div className="mx-auto w-full max-w-[52rem] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href="/knowledge"
          className="flex items-center gap-1.5 text-2xs text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-3 w-3" />
          Knowledge
        </Link>

        <div className="flex items-center gap-1.5">
          <SaveBadge state={state} />
          <Tooltip content={doc.isPinned ? "Unpin from the top" : "Pin to the top"}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={doc.isPinned ? "Unpin this page" : "Pin this page"}
              aria-pressed={doc.isPinned}
              onClick={() => void patch({ id: doc.id, isPinned: !doc.isPinned })}
              className={cn(doc.isPinned && "text-accent-bright")}
            >
              <Pin className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Page actions">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setEditing((value) => !value)}>
                <Pencil className="h-3.5 w-3.5" />
                {editing ? "Stop editing" : "Edit page"}
              </MenuItem>
              <MenuItem onSelect={() => void patch({ id: doc.id, isPinned: !doc.isPinned })}>
                {doc.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                {doc.isPinned ? "Unpin" : "Pin to the top"}
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={remove}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete page
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      {/* Title. An input rather than a dialog: a page is renamed far more
          often than it is created, and a rename should cost one click. */}
      <input
        value={titleDraft}
        onChange={(event) => setTitleDraft(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setTitleDraft(doc.title);
            event.currentTarget.blur();
          }
        }}
        aria-label="Page title"
        placeholder="Untitled page"
        className="-mx-2 w-[calc(100%+1rem)] rounded-md bg-transparent px-2 py-1 text-xl font-semibold tracking-[-0.02em] text-text outline-none transition-colors placeholder:text-text-faint hover:bg-hover focus:bg-hover"
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-0.5 text-2xs text-text-faint">
        {doc.updatedBy && <Avatar member={doc.updatedBy} size="xs" />}
        <span>
          {doc.updatedBy ? `${doc.updatedBy.name} edited ` : "Edited "}
          <RelativeTime value={doc.updatedAt} />
        </span>
        {!empty && (
          <>
            <span aria-hidden>·</span>
            <DocStatsLine stats={stats} />
          </>
        )}
      </div>

      {/* Labels — the library's only filing system. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Tag className="h-3 w-3 shrink-0 text-text-faint" />
        {doc.labels.map((label) => (
          <span
            key={label}
            className="group/label flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-2xs text-text-muted"
          >
            {label}
            <button
              onClick={() =>
                void patch({ id: doc.id, labels: doc.labels.filter((l) => l !== label) })
              }
              aria-label={`Remove the ${label} label`}
              className="text-text-faint opacity-0 transition-opacity hover:text-danger group-hover/label:opacity-100"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {addingLabel ? (
          <Input
            autoFocus
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            onBlur={addLabel}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setLabelDraft("");
                setAddingLabel(false);
              }
            }}
            placeholder="onboarding"
            className="h-6 w-32 text-2xs"
          />
        ) : (
          <button
            onClick={() => setAddingLabel(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-2xs text-text-faint transition-colors hover:border-accent hover:text-accent-bright"
          >
            <Plus className="h-2.5 w-2.5" />
            Label
          </button>
        )}
      </div>

      <hr className="my-4 border-0 border-t border-line" />

      {editing ? (
        <DocEditor
          value={draft}
          onChange={setDraft}
          attachTo={{ kind: "knowledge", id: doc.id }}
          autoFocus
          view={view}
          minHeight="min-h-[24rem]"
          placeholder="Write it down. Paste a screenshot, or type / for a block."
          onSaveRequest={() => {
            setEditing(false);
            flush();
          }}
          onExitRequest={() => {
            setEditing(false);
            flush();
          }}
          toolbarExtras={
            <>
              <Tooltip content={view === "split" ? "Hide the preview" : "Show the preview"}>
                <button
                  type="button"
                  aria-label="Toggle the preview"
                  aria-pressed={view === "split"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setView((current) => (current === "split" ? "write" : "split"))}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded transition-colors",
                    view === "split"
                      ? "bg-accent-dim text-accent-bright"
                      : "text-text-muted hover:bg-hover hover:text-text",
                  )}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  flush();
                }}
              >
                <Check className="h-3 w-3" />
                Done
              </Button>
            </>
          }
          footer={
            <p className="pt-1.5 text-2xs text-text-faint">
              Autosaves as you write. <kbd className="font-sans">/</kbd> inserts a block,{" "}
              <kbd className="font-sans">⌘K</kbd> links the selection, and images can be pasted or
              dropped anywhere in the text.
            </p>
          }
        />
      ) : empty ? (
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-6 text-left transition-colors hover:border-accent hover:bg-hover"
        >
          <PenLine className="h-4 w-4 shrink-0 text-text-faint" />
          <span className="text-[13px] text-text-faint">
            This page is empty. Write the thing everyone keeps asking about.
          </span>
        </button>
      ) : (
        <div
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a,button,input,label")) return;
            setEditing(true);
          }}
          className="-mx-2 cursor-text rounded-md px-2 py-1"
        >
          <DocContent
            markdown={draft}
            density="relaxed"
            onToggleCheckbox={(line) => {
              const next = toggleCheckboxLine(draft, line);
              if (next !== draft) replace(next);
            }}
          />
        </div>
      )}
    </div>
  );
}
