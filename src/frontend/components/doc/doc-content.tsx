"use client";

import { Check, Copy, Download, Maximize2, Paperclip } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { isAttachmentHref } from "@/shared/doc/attachments";
import {
  parseDoc,
  type DocBlock,
  type HeadingLevel,
  type DocListItem,
  type InlineNode,
} from "@/shared/doc/markdown";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Checkbox } from "@/frontend/components/ui/feedback";
import { Dialog, DialogContent } from "@/frontend/components/ui/dialog";

/**
 * Renders a task document.
 *
 * The block tree comes from `lib/doc/markdown`, and every node becomes a React
 * element — there is no `dangerouslySetInnerHTML` on this path, so markup
 * pasted into a task body is text, not markup.
 *
 * Two things here are interactive rather than decorative:
 *  * checklist rows, which write straight back to the Markdown through
 *    `onToggleCheckbox`, so a doc can be worked through without opening the
 *    editor; and
 *  * images, which open full size, because a screenshot pasted into a sidebar
 *    column is otherwise unreadable.
 *
 * An attached file is a link like any other in the Markdown; it is only drawn
 * differently — as a chip that downloads — so the eye finds it in a long brief.
 */
/** Type scale per heading level; the compact one is for sidebars and previews. */
const HEADING_SIZE_RELAXED: Record<HeadingLevel, string> = {
  1: "text-xl",
  2: "text-lg",
  3: "text-base",
  4: "text-[15px]",
  5: "text-[13px] tracking-[0.04em]",
  6: "text-xs tracking-[0.06em]",
};

const HEADING_SIZE_COMPACT: Record<HeadingLevel, string> = {
  1: "text-base",
  2: "text-sm",
  3: "text-[13px]",
  4: "text-xs",
  5: "text-2xs tracking-[0.04em]",
  6: "text-2xs tracking-[0.06em]",
};

export function DocContent({
  markdown,
  density = "compact",
  onToggleCheckbox,
  className,
}: {
  markdown: string | null | undefined;
  /** `compact` for the detail drawer, `relaxed` for the full-width doc view. */
  density?: "compact" | "relaxed";
  onToggleCheckbox?: (line: number) => void;
  className?: string;
}) {
  const t = useT();
  const blocks = parseDoc(markdown);
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);

  if (blocks.length === 0) return null;

  const relaxed = density === "relaxed";

  return (
    <>
      <div
        className={cn(
          relaxed ? "space-y-4 text-[15px] leading-7" : "space-y-3 text-[13px] leading-6",
          "text-text-secondary",
          className,
        )}
      >
        {blocks.map((block, index) => (
          <Block
            key={index}
            block={block}
            relaxed={relaxed}
            onToggleCheckbox={onToggleCheckbox}
            onZoom={setZoomed}
          />
        ))}
      </div>

      <Dialog open={Boolean(zoomed)} onOpenChange={(open) => !open && setZoomed(null)}>
        {zoomed && (
          <DialogContent className="max-h-[92vh] max-w-[min(72rem,calc(100%-3rem))] bg-canvas p-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- the bytes
                come from an authenticated route, which the image optimiser
                cannot fetch on the user's behalf. */}
            <img
              src={zoomed.src}
              alt={zoomed.alt}
              className="max-h-[88vh] w-full object-contain"
            />
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
              <span className="truncate text-2xs text-text-muted">
                {zoomed.alt || t("doc.image")}
              </span>
              <a
                href={zoomed.src}
                download
                className="flex shrink-0 items-center gap-1.5 text-2xs text-accent-bright hover:underline"
              >
                <Download className="h-3 w-3" />
                {t("doc.download")}
              </a>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function Block({
  block,
  relaxed,
  onToggleCheckbox,
  onZoom,
}: {
  block: DocBlock;
  relaxed: boolean;
  onToggleCheckbox?: (line: number) => void;
  onZoom: (image: { src: string; alt: string }) => void;
}) {
  switch (block.type) {
    case "heading": {
      const size = (relaxed ? HEADING_SIZE_RELAXED : HEADING_SIZE_COMPACT)[block.level];
      // The document title is the page's h1, so a level-1 heading renders as
      // h2 and the rest shift down with it, bottoming out at h6.
      const Tag = `h${Math.min(block.level + 1, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag
          className={cn(
            "tracking-[-0.01em] text-text",
            size,
            block.level === 1 ? "mt-1 pt-1" : "",
            // h5–h6 are body-sized, so they read as headings by weight and
            // tone rather than by size.
            block.level >= 5 ? "font-semibold uppercase text-text-muted" : "font-semibold",
          )}
        >
          <Inline nodes={block.content} onZoom={onZoom} />
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p>
          <Inline nodes={block.content} onZoom={onZoom} />
        </p>
      );

    case "figure":
      return <Figure src={block.src} alt={block.alt} relaxed={relaxed} onZoom={onZoom} />;

    case "list":
      return (
        <ul className="space-y-1">
          {block.items.map((item) =>
            item.marker === "check" ? (
              <ChecklistRow
                key={item.line}
                item={item}
                onToggle={onToggleCheckbox}
                onZoom={onZoom}
              />
            ) : (
              <li
                key={item.line}
                className="flex gap-2"
                style={{ marginInlineStart: `${item.depth * LIST_INDENT_REM}rem` }}
              >
                <span className="mt-[0.1rem] shrink-0 select-none text-text-faint tabular-nums">
                  {item.marker === "ordered" ? `${item.number}.` : bulletFor(item.depth)}
                </span>
                <span className="min-w-0 flex-1">
                  <Inline nodes={item.content} onZoom={onZoom} />
                </span>
              </li>
            ),
          )}
        </ul>
      );

    case "quote":
      return (
        <blockquote className="border-l-2 border-line-accent pl-3 text-text-muted">
          {block.lines.map((line, index) => (
            <p key={index}>
              <Inline nodes={line} onZoom={onZoom} />
            </p>
          ))}
        </blockquote>
      );

    case "code":
      return <CodeBlock language={block.language} value={block.value} />;

    case "divider":
      return <hr className="border-0 border-t border-line" />;
  }
}

/** Per nesting level — tight enough that six levels still fit a sidebar. */
const LIST_INDENT_REM = 1.1;

/** The glyph cycles, so every depth stays distinguishable from its parent. */
function bulletFor(depth: number): string {
  return ["•", "◦", "▪"][depth % 3];
}

function ChecklistRow({
  item,
  onToggle,
  onZoom,
}: {
  item: DocListItem;
  onToggle?: (line: number) => void;
  onZoom: (image: { src: string; alt: string }) => void;
}) {
  const t = useT();

  return (
    <li
      className="flex items-start gap-2"
      style={{ marginInlineStart: `${item.depth * LIST_INDENT_REM}rem` }}
    >
      <Checkbox
        checked={item.checked === true}
        disabled={!onToggle}
        onCheckedChange={() => onToggle?.(item.line)}
        aria-label={t(item.checked ? "doc.markNotDone" : "doc.markDone")}
        className="mt-[0.2rem] disabled:opacity-100"
      />
      <span className={cn("min-w-0 flex-1", item.checked && "text-text-faint line-through")}>
        <Inline nodes={item.content} onZoom={onZoom} />
      </span>
    </li>
  );
}

function Figure({
  src,
  alt,
  relaxed,
  onZoom,
}: {
  src: string;
  alt: string;
  relaxed: boolean;
  onZoom: (image: { src: string; alt: string }) => void;
}) {
  const t = useT();

  return (
    <figure className="group/figure">
      <button
        type="button"
        onClick={() => onZoom({ src, alt })}
        className="relative block w-full overflow-hidden rounded-lg border border-line bg-canvas"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- see DocContent. */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn("w-full object-contain", relaxed ? "max-h-[32rem]" : "max-h-72")}
        />
        <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-1 text-2xs text-white opacity-0 transition-opacity group-hover/figure:opacity-100">
          <Maximize2 className="h-3 w-3" />
          {t("doc.fullSize")}
        </span>
      </button>
      {alt && (
        <figcaption className="mt-1 text-2xs text-text-faint">{alt}</figcaption>
      )}
    </figure>
  );
}

function CodeBlock({ language, value }: { language: string | null; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <div className="group/code relative overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1">
        <span className="font-mono text-2xs text-text-faint">{language ?? "code"}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              // Clipboard access can be refused; the text is still selectable.
            }
          }}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-2xs text-text-faint transition-colors hover:text-text"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
      <pre className="overflow-x-auto px-2.5 py-2">
        <code className="font-mono text-xs leading-5 text-text-secondary">{value}</code>
      </pre>
    </div>
  );
}

function Inline({
  nodes,
  onZoom,
}: {
  nodes: InlineNode[];
  onZoom: (image: { src: string; alt: string }) => void;
}) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return <span key={index}>{node.value}</span>;
          case "break":
            return <br key={index} />;
          case "strong":
            return (
              <strong key={index} className="font-semibold text-text">
                <Inline nodes={node.children} onZoom={onZoom} />
              </strong>
            );
          case "em":
            return (
              <em key={index} className="italic">
                <Inline nodes={node.children} onZoom={onZoom} />
              </em>
            );
          case "strike":
            return (
              <s key={index} className="text-text-faint">
                <Inline nodes={node.children} onZoom={onZoom} />
              </s>
            );
          case "code":
            return (
              <code
                key={index}
                className="rounded-[4px] bg-raised px-1 py-0.5 font-mono text-[0.85em] text-accent-bright"
              >
                {node.value}
              </code>
            );
          case "link": {
            if (isAttachmentHref(node.href)) {
              return (
                <a
                  key={index}
                  href={node.href}
                  download
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-0.5 align-middle text-[0.9em] text-accent-bright transition-colors hover:border-line-strong hover:bg-hover"
                >
                  <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    <Inline nodes={node.children} onZoom={onZoom} />
                  </span>
                </a>
              );
            }

            const internal = node.href.startsWith("/") || node.href.startsWith("#");
            if (internal) {
              return (
                <Link
                  key={index}
                  href={node.href}
                  className="text-accent-bright underline-offset-2 hover:underline"
                >
                  <Inline nodes={node.children} onZoom={onZoom} />
                </Link>
              );
            }
            return (
              <a
                key={index}
                href={node.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-bright underline-offset-2 hover:underline"
              >
                <Inline nodes={node.children} onZoom={onZoom} />
              </a>
            );
          }
          case "image":
            return (
              <button
                key={index}
                type="button"
                onClick={() => onZoom({ src: node.src, alt: node.alt })}
                className="inline-block align-middle"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see DocContent. */}
                <img
                  src={node.src}
                  alt={node.alt}
                  loading="lazy"
                  className="inline max-h-24 rounded border border-line"
                />
              </button>
            );
        }
      })}
    </>
  );
}
