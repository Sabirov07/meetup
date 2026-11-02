"use client";

import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Strikethrough,
  Type,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  rejectionReason,
  UPLOAD_ENDPOINT,
  type UploadedAttachment,
} from "@/shared/doc/attachments";
import {
  activeMarks,
  applyLink,
  blockKindAt,
  continueList,
  imageMarkdown,
  indentLines,
  insertBlock,
  replaceRange,
  setBlockKind,
  slashTrigger,
  toggleMark,
  type BlockKind,
  type InlineMark,
  type TextEdit,
  type TextSelection,
} from "@/shared/doc/transform";
import type { Translate, TranslationKey } from "@/shared/i18n";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/field";
import { Tooltip } from "@/frontend/components/ui/feedback";
import { DocContent } from "./doc-content";

/**
 * The document editor.
 *
 * It edits Markdown source in a textarea rather than driving a contenteditable
 * surface. That is a deliberate trade: a contenteditable WYSIWYG needs a
 * document model and a serialiser (ProseMirror, Lexical) to behave under
 * paste, undo and selection, and half of one behaves worse than a plain text
 * box. What is here instead is the part people actually reach for — a toolbar
 * and shortcuts that write the syntax, a slash menu for blocks, images on
 * paste or drop, and a live preview of the real rendering — with native undo,
 * native selection and a body that is still readable when something goes
 * wrong.
 *
 * Every text operation comes from `lib/doc/transform`, so this component is
 * only wiring: events in, pure edit out, caret restored.
 */

export function DocEditor({
  value,
  onChange,
  attachTo,
  view = "write",
  autoFocus = false,
  grow = true,
  placeholder,
  minHeight = "min-h-[9rem]",
  toolbarExtras,
  footer,
  onSaveRequest,
  onExitRequest,
  onMenuOpenChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /**
   * The document uploads belong to — a task or a knowledge page. The server
   * authorises against it, so an image can never land somewhere the person
   * cannot already see.
   */
  attachTo: { kind: "task" | "knowledge"; id: string };
  view?: "write" | "split";
  autoFocus?: boolean;
  /** True grows the box with the text; false fills the height it is given. */
  grow?: boolean;
  placeholder?: string;
  minHeight?: string;
  /** Rendered at the right-hand end of the toolbar. */
  toolbarExtras?: ReactNode;
  footer?: ReactNode;
  /** ⌘↵ — "I am done with this". */
  onSaveRequest?: () => void;
  /** Escape. */
  onExitRequest?: () => void;
  /**
   * Fires as the block menu opens and closes. A surrounding dialog needs it:
   * Radix dismisses on Escape from a capture-phase listener, so the only way
   * to let the menu swallow that key is for the dialog to know it is open.
   */
  onMenuOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The parent owns `value`, so async callbacks read it from a ref to avoid
  // writing a stale document back after an upload resolves.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const pendingSelection = useRef<TextSelection | null>(null);

  const [slash, setSlash] = useState<{ from: number; query: string } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const t = useT();
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [uploads, setUploads] = useState<{ key: string; name: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  // Restore the caret after a toolbar edit, which replaces the whole value.
  useEffect(() => {
    const node = textareaRef.current;
    const next = pendingSelection.current;
    if (!node || !next) return;
    pendingSelection.current = null;
    node.focus();
    node.setSelectionRange(next.start, next.end);
    setSelection(next);
  }, [value]);

  // Grow to fit the text; the max height lives in CSS so long docs scroll.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node || !grow) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value, grow]);

  useEffect(() => {
    if (!autoFocus) return;
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    const end = node.value.length;
    node.setSelectionRange(end, end);
    setSelection({ start: end, end });
  }, [autoFocus]);

  useEffect(() => {
    onMenuOpenChange?.(slash !== null);
  }, [slash, onMenuOpenChange]);

  useEffect(() => () => onMenuOpenChange?.(false), [onMenuOpenChange]);

  const readSelection = useCallback((): TextSelection => {
    const node = textareaRef.current;
    if (!node) return selection;
    return { start: node.selectionStart, end: node.selectionEnd };
  }, [selection]);

  const apply = useCallback(
    (edit: TextEdit) => {
      pendingSelection.current = edit.selection;
      latest.current = edit.value;
      onChange(edit.value);
    },
    [onChange],
  );

  const marks = activeMarks(value, selection);
  const block = blockKindAt(value, selection.start);

  // ---------------------------------------------------------------- uploads

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const accepted: File[] = [];
      for (const file of files) {
        const reason = rejectionReason(file, t);
        if (reason) toast.error(t("doc.upload.rejected"), { description: reason });
        else accepted.push(file);
      }
      if (accepted.length === 0) return;

      // Where the image should land, and the text that was there at the time.
      let anchor = readSelection();
      let expected = latest.current;

      for (const file of accepted) {
        const key = `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`;
        setUploads((previous) => [...previous, { key, name: file.name || "image" }]);
        try {
          const form = new FormData();
          form.set(attachTo.kind === "task" ? "taskId" : "docId", attachTo.id);
          form.set("file", file);

          const response = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: form });
          const payload = (await response.json().catch(() => null)) as
            | (UploadedAttachment & { error?: string })
            | null;

          if (!response.ok || !payload?.url) {
            throw new Error(payload?.error ?? t("doc.upload.incomplete"));
          }

          // If the document moved on while this was in flight, append rather
          // than write at an offset that no longer means anything.
          const current = latest.current;
          const at =
            current === expected ? anchor : { start: current.length, end: current.length };
          const edit = insertBlock(
            current,
            at,
            imageMarkdown(payload.url, payload.filename),
          );
          apply(edit);
          expected = edit.value;
          anchor = edit.selection;
        } catch (error) {
          toast.error(t("doc.upload.failed"), {
            description: error instanceof Error ? error.message : undefined,
          });
        } finally {
          setUploads((previous) => previous.filter((item) => item.key !== key));
        }
      }
    },
    [apply, attachTo, readSelection, t],
  );

  // ------------------------------------------------------------------ slash

  const slashItems = slash ? filterSlashItems(slash.query, t) : [];
  const activeSlashItem = slashItems[Math.min(slashIndex, slashItems.length - 1)];

  const closeSlash = useCallback(() => {
    setSlash(null);
    setSlashIndex(0);
  }, []);

  const runSlashItem = useCallback(
    (item: SlashItem) => {
      if (!slash) return;
      const caret = readSelection().start;
      // Swallow the "/query" the person typed, then run the command.
      const cleared = replaceRange(latest.current, slash.from, caret, "");
      closeSlash();

      if (item.action === "image") {
        apply(cleared);
        fileInputRef.current?.click();
        return;
      }
      apply(item.run(cleared.value, cleared.selection));
    },
    [apply, closeSlash, readSelection, slash],
  );

  // ----------------------------------------------------------------- events

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const current = readSelection();

    if (slash && slashItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) => (index + 1) % slashItems.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => (index - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        if (activeSlashItem) runSlashItem(activeSlashItem);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSlash();
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i" || key === "e") {
        event.preventDefault();
        const mark: InlineMark = key === "b" ? "strong" : key === "i" ? "em" : "code";
        apply(toggleMark(value, current, mark));
        return;
      }
      if (key === "k") {
        event.preventDefault();
        setSelection(current);
        setLinkDraft("");
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onSaveRequest?.();
        return;
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const edit = continueList(value, current);
      if (edit) {
        event.preventDefault();
        apply(edit);
        closeSlash();
      }
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      apply(indentLines(value, current, event.shiftKey ? "out" : "in"));
      return;
    }

    if (event.key === "Escape") {
      if (slash) {
        closeSlash();
        return;
      }
      // The first Escape leaves the editor; a second one closes whatever is
      // around it, which is the order people expect.
      onExitRequest?.();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (images.length > 0) {
      event.preventDefault();
      void uploadFiles(images);
      return;
    }

    // A URL pasted over selected words links them, rather than replacing them.
    const text = event.clipboardData.getData("text/plain").trim();
    const current = readSelection();
    if (text && current.end > current.start && /^https?:\/\/\S+$/.test(text)) {
      event.preventDefault();
      apply(applyLink(value, current, text));
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    event.preventDefault();
    setDragging(false);
    void uploadFiles(files);
  }

  function syncSelection() {
    const next = readSelection();
    setSelection(next);
    // The slash menu only lives while the caret is still inside its query.
    if (slash) {
      const line = latest.current.slice(slash.from, next.start);
      if (next.start < slash.from || !/^\/[\w-]*$/.test(line)) closeSlash();
      else setSlash({ from: slash.from, query: line.slice(1) });
    }
  }

  return (
    <div
      className={cn("flex min-h-0 flex-col", className)}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 rounded-t-lg border border-line-strong bg-raised px-1.5 py-1">
        <ToolButton
          label="doc.toolbar.h1"
          icon={Heading1}
          active={block === "h1"}
          onClick={() => apply(setBlockKind(value, readSelection(), "h1"))}
        />
        <ToolButton
          label="doc.toolbar.h2"
          icon={Heading2}
          active={block === "h2"}
          onClick={() => apply(setBlockKind(value, readSelection(), "h2"))}
        />
        <ToolButton
          label="doc.toolbar.h3"
          icon={Heading3}
          active={block === "h3"}
          onClick={() => apply(setBlockKind(value, readSelection(), "h3"))}
        />
        <ToolDivider />
        <ToolButton
          label="doc.toolbar.bold"
          icon={Bold}
          active={marks.strong}
          onClick={() => apply(toggleMark(value, readSelection(), "strong"))}
        />
        <ToolButton
          label="doc.toolbar.italic"
          icon={Italic}
          active={marks.em}
          onClick={() => apply(toggleMark(value, readSelection(), "em"))}
        />
        <ToolButton
          label="doc.toolbar.strikethrough"
          icon={Strikethrough}
          active={marks.strike}
          onClick={() => apply(toggleMark(value, readSelection(), "strike"))}
        />
        <ToolButton
          label="doc.toolbar.code"
          icon={Code}
          active={marks.code}
          onClick={() => apply(toggleMark(value, readSelection(), "code"))}
        />
        <ToolButton
          label="doc.toolbar.link"
          icon={Link2}
          onClick={() => {
            setSelection(readSelection());
            setLinkDraft("");
          }}
        />
        <ToolDivider />
        <ToolButton
          label="doc.toolbar.bullet"
          icon={List}
          active={block === "bullet"}
          onClick={() => apply(setBlockKind(value, readSelection(), "bullet"))}
        />
        <ToolButton
          label="doc.toolbar.ordered"
          icon={ListOrdered}
          active={block === "ordered"}
          onClick={() => apply(setBlockKind(value, readSelection(), "ordered"))}
        />
        <ToolButton
          label="doc.toolbar.check"
          icon={ListChecks}
          active={block === "check"}
          onClick={() => apply(setBlockKind(value, readSelection(), "check"))}
        />
        <ToolButton
          label="doc.toolbar.quote"
          icon={Quote}
          active={block === "quote"}
          onClick={() => apply(setBlockKind(value, readSelection(), "quote"))}
        />
        <ToolButton
          label="doc.toolbar.codeBlock"
          icon={Code2}
          onClick={() => apply(insertBlock(value, readSelection(), "```\n\n```", 4))}
        />
        <ToolButton
          label="doc.toolbar.divider"
          icon={Minus}
          onClick={() => apply(insertBlock(value, readSelection(), "---"))}
        />
        <ToolButton
          label="doc.toolbar.imageDrop"
          icon={ImagePlus}
          onClick={() => fileInputRef.current?.click()}
        />

        {toolbarExtras && (
          <div className="ml-auto flex items-center gap-1 pl-1">{toolbarExtras}</div>
        )}
      </div>

      {/* Link entry, rather than a browser prompt. */}
      {linkDraft !== null && (
        <form
          className="flex shrink-0 items-center gap-1.5 border-x border-line-strong bg-canvas px-1.5 py-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const href = linkDraft.trim();
            setLinkDraft(null);
            if (href) apply(applyLink(latest.current, selection, href));
          }}
        >
          <Input
            autoFocus
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setLinkDraft(null);
                textareaRef.current?.focus();
              }
            }}
            placeholder={t("doc.linkPlaceholder")}
            className="h-7 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary">
            {t("doc.toolbar.link").split("  ")[0]}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("common.cancel")}
            onClick={() => setLinkDraft(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}

      {/* Surface */}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 rounded-b-lg border border-t-0 border-line-strong bg-canvas transition-colors",
          view === "split" ? "divide-x divide-line" : "",
          dragging && "border-accent ring-2 ring-accent/25",
        )}
      >
        <div
          className={cn(
            "relative min-w-0",
            view === "split" ? "w-1/2" : "w-full",
            grow ? "" : "flex min-h-0 flex-col",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              latest.current = next;
              onChange(next);
              // Re-read the trigger from the value the browser just committed.
              const caret = event.target.selectionStart;
              const trigger = slashTrigger(next, caret);
              if (trigger) {
                setSlash(trigger);
                setSlashIndex(0);
              } else if (slash) {
                closeSlash();
              }
              setSelection({ start: caret, end: event.target.selectionEnd });
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={syncSelection}
            onClick={syncSelection}
            onSelect={syncSelection}
            onPaste={handlePaste}
            onBlur={() => window.setTimeout(closeSlash, 120)}
            placeholder={placeholder ?? t("doc.placeholder")}
            spellCheck
            className={cn(
              "block w-full resize-none bg-transparent px-3 py-2.5 font-sans leading-6 text-text outline-none placeholder:text-text-faint",
              grow ? cn("max-h-[60vh] overflow-y-auto text-[13px]", minHeight) : "h-full flex-1 overflow-y-auto text-sm",
            )}
          />

          {slash && slashItems.length > 0 && (
            <SlashMenu
              items={slashItems}
              activeIndex={Math.min(slashIndex, slashItems.length - 1)}
              onPick={runSlashItem}
              onHover={setSlashIndex}
            />
          )}
        </div>

        {view === "split" && (
          <div className="min-w-0 w-1/2 overflow-y-auto px-3 py-2.5">
            {value.trim() ? (
              <DocContent markdown={value} density="relaxed" />
            ) : (
              <p className="text-[13px] text-text-faint">{t("doc.nothingToPreview")}</p>
            )}
          </div>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-b-lg bg-canvas/80">
            <p className="text-xs font-medium text-accent-bright">{t("doc.dropToEmbed")}</p>
          </div>
        )}
      </div>

      {uploads.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 pt-1.5">
          {uploads.map((upload) => (
            <span
              key={upload.key}
              className="flex items-center gap-1.5 rounded-md bg-raised px-1.5 py-1 text-2xs text-text-muted"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              {upload.name}
            </span>
          ))}
        </div>
      )}

      {footer}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void uploadFiles(files);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar pieces
// ---------------------------------------------------------------------------

type IconComponent = typeof Bold;

function ToolButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: TranslationKey;
  icon: IconComponent;
  active?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const text = t(label);

  return (
    <Tooltip content={text}>
      <button
        type="button"
        aria-label={text}
        aria-pressed={active}
        // The textarea must keep its selection, so the button never takes focus.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded transition-colors",
          active
            ? "bg-accent-dim text-accent-bright"
            : "text-text-muted hover:bg-hover hover:text-text",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}

function ToolDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-line-strong" aria-hidden />;
}

// ---------------------------------------------------------------------------
// Slash menu
// ---------------------------------------------------------------------------

type SlashItem = {
  id: string;
  /** Resolved before the menu renders; the search runs against it. */
  label: string;
  hint: string;
  keywords: string;
  icon: IconComponent;
  action?: "image";
  run: (value: string, selection: TextSelection) => TextEdit;
};

type SlashDefinition = Omit<SlashItem, "label" | "keywords"> & {
  label: TranslationKey;
  keywords: TranslationKey;
};

const blockItem = (
  id: string,
  label: TranslationKey,
  hint: string,
  keywords: TranslationKey,
  icon: IconComponent,
  kind: BlockKind,
): SlashDefinition => ({
  id,
  label,
  hint,
  keywords,
  icon,
  run: (value, selection) => setBlockKind(value, selection, kind),
});

const SLASH_ITEMS: SlashDefinition[] = [
  blockItem("h1", "doc.block.h1", "#", "doc.block.h1.keywords", Heading1, "h1"),
  blockItem("h2", "doc.block.h2", "##", "doc.block.h2.keywords", Heading2, "h2"),
  blockItem("h3", "doc.block.h3", "###", "doc.block.h3.keywords", Heading3, "h3"),
  blockItem("text", "doc.block.text", "¶", "doc.block.text.keywords", Type, "text"),
  blockItem("bullet", "doc.block.bullet", "-", "doc.block.bullet.keywords", List, "bullet"),
  blockItem(
    "ordered",
    "doc.block.ordered",
    "1.",
    "doc.block.ordered.keywords",
    ListOrdered,
    "ordered",
  ),
  blockItem("check", "doc.block.check", "[ ]", "doc.block.check.keywords", ListChecks, "check"),
  blockItem("quote", "doc.block.quote", ">", "doc.block.quote.keywords", Quote, "quote"),
  {
    id: "code",
    label: "doc.block.code",
    hint: "```",
    keywords: "doc.block.code.keywords",
    icon: Code2,
    run: (value, selection) => insertBlock(value, selection, "```\n\n```", 4),
  },
  {
    id: "divider",
    label: "doc.block.divider",
    hint: "---",
    keywords: "doc.block.divider.keywords",
    icon: Minus,
    run: (value, selection) => insertBlock(value, selection, "---"),
  },
  {
    id: "image",
    label: "doc.block.image",
    hint: "doc.block.image.hint",
    keywords: "doc.block.image.keywords",
    icon: ImagePlus,
    action: "image",
    run: (value, selection) => ({ value, selection }),
  },
];

/**
 * Matched against the translated label and keywords, so "/заг" finds the
 * heading block when the interface is in Russian.
 */
function filterSlashItems(query: string, t: Translate): SlashItem[] {
  const items: SlashItem[] = SLASH_ITEMS.map((item) => ({
    ...item,
    label: t(item.label),
    hint: item.id === "image" ? t("doc.block.image.hint") : item.hint,
    keywords: t(item.keywords),
  }));

  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.keywords.toLowerCase().includes(needle),
  );
}

function SlashMenu({
  items,
  activeIndex,
  onPick,
  onHover,
}: {
  items: SlashItem[];
  activeIndex: number;
  onPick: (item: SlashItem) => void;
  onHover: (index: number) => void;
}) {
  const t = useT();

  return (
    <div
      role="listbox"
      aria-label={t("doc.block.insert")}
      className="absolute bottom-2 left-2 z-20 w-56 overflow-hidden rounded-lg border border-line-strong bg-overlay p-1 shadow-popover"
    >
      <p className="px-2 py-1 text-2xs text-text-faint">{t("doc.block.insert")}</p>
      <div className="max-h-56 overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(item)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
              index === activeIndex
                ? "bg-hover text-text"
                : "text-text-secondary hover:bg-hover hover:text-text",
            )}
          >
            <item.icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 font-mono text-2xs text-text-faint">{item.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
