/**
 * The document format task bodies are written in: a Markdown subset, parsed
 * into a typed block tree.
 *
 * Hand-rolled rather than pulled from npm for two reasons:
 *
 *  1. The tree is rendered as React elements, never as HTML, so there is no
 *     `dangerouslySetInnerHTML` anywhere in the doc path and a pasted
 *     `<script>` is just text. Sanitising someone else's HTML output is a
 *     standing risk; not producing HTML at all removes it.
 *  2. Every list item carries the source line it came from, which is what lets
 *     a checkbox in the read view toggle the underlying Markdown without a
 *     round-trip through an editor.
 *
 * The subset is deliberately small — headings, paragraphs, lists, checklists,
 * quotes, fenced code, dividers, images, and inline emphasis / code / links.
 * Anything outside it renders as the text the author typed, which is the right
 * failure mode for a field people paste into.
 */

export type InlineNode =
  | { kind: "text"; value: string }
  /** A single newline inside a paragraph, kept so typed line breaks survive. */
  | { kind: "break" }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] }
  | { kind: "strike"; children: InlineNode[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: InlineNode[] }
  | { kind: "image"; src: string; alt: string };

export type DocListItem = {
  /** Zero-based source line, so a checkbox click can rewrite exactly this row. */
  line: number;
  /** Nesting level: one per two spaces (or one tab) of indent, no ceiling. */
  depth: number;
  /** How the row is marked — items of different kinds nest freely in one list. */
  marker: "bullet" | "ordered" | "check";
  /**
   * The number shown for an ordered row. Counts siblings at the same depth,
   * so a numbered list nested under a numbered list restarts at 1.
   */
  number: number;
  /** Null for a plain bullet or number; true / false for a checklist row. */
  checked: boolean | null;
  content: InlineNode[];
};

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type DocBlock =
  | { type: "heading"; level: HeadingLevel; content: InlineNode[] }
  | { type: "paragraph"; content: InlineNode[] }
  /** An image on a line of its own, rendered as a full-width figure. */
  | { type: "figure"; src: string; alt: string }
  | { type: "list"; items: DocListItem[] }
  | { type: "quote"; lines: InlineNode[][] }
  | { type: "code"; language: string | null; value: string }
  | { type: "divider" };

const FENCE = /^\s{0,3}(```|~~~)\s*([\w+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const DIVIDER = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const CHECKBOX = /^\[([ xX])\]\s+(.*)$/;
const FIGURE = /^!\[([^\]]*)\]\(\s*(\S+?)\s*\)$/;

const ESCAPABLE = /[\\`*_~[\]()!#>-]/;

/** Parses a whole document. Never throws: malformed input degrades to text. */
export function parseDoc(markdown: string | null | undefined): DocBlock[] {
  if (!markdown) return [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: DocBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const closing = fence[1];
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith(closing)) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // the closing fence, or the end of the input
      blocks.push({
        type: "code",
        language: fence[2] ? fence[2].toLowerCase() : null,
        value: body.join("\n"),
      });
      continue;
    }

    if (DIVIDER.test(line)) {
      blocks.push({ type: "divider" });
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length as HeadingLevel;
      blocks.push({ type: "heading", level, content: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: InlineNode[][] = [];
      while (i < lines.length) {
        const match = QUOTE.exec(lines[i]);
        if (!match) break;
        quoted.push(parseInline(match[1]));
        i += 1;
      }
      blocks.push({ type: "quote", lines: quoted });
      continue;
    }

    const figure = FIGURE.exec(line.trim());
    if (figure) {
      const src = safeSrc(figure[2]);
      if (src) {
        blocks.push({ type: "figure", src, alt: figure[1] });
        i += 1;
        continue;
      }
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const consumed = readList(lines, i);
      blocks.push(consumed.block);
      i = consumed.next;
      continue;
    }

    // Paragraph: every following line that does not open a block of its own.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !opensBlock(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    const content: InlineNode[] = [];
    paragraph.forEach((text, index) => {
      if (index > 0) content.push({ kind: "break" });
      content.push(...parseInline(text));
    });
    if (content.length > 0) blocks.push({ type: "paragraph", content });
  }

  return blocks;
}

function opensBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    DIVIDER.test(line) ||
    HEADING.test(line) ||
    QUOTE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line)
  );
}

/**
 * Reads one run of list items.
 *
 * Bullets, numbers and checkboxes all belong to the same run, so a numbered
 * step can hold a bulleted sub-list and a bullet can hold a checklist. The
 * run ends at a blank line or at a line that is not a list item.
 */
function readList(lines: string[], from: number): { block: DocBlock; next: number } {
  const items: DocListItem[] = [];
  // Counters per depth, so numbering restarts inside each nested list and
  // resumes when the list comes back up a level.
  const counters: number[] = [];
  let i = from;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") break;

    const orderedMatch = ORDERED.exec(line);
    const bulletMatch = orderedMatch ? null : BULLET.exec(line);
    if (!orderedMatch && !bulletMatch) break;

    const indent = (orderedMatch ?? bulletMatch)![1];
    const depth = listDepth(indent);
    const rest = orderedMatch ? orderedMatch[3] : bulletMatch![2];
    const checkbox = orderedMatch ? null : CHECKBOX.exec(rest);
    const marker = checkbox ? "check" : orderedMatch ? "ordered" : "bullet";

    // Going shallower closes every deeper list, so their counters reset.
    counters.length = depth + 1;
    let number = 0;
    if (marker === "ordered") {
      // A list that starts at 3 keeps 3; one that continues counts on.
      number = counters[depth] ? counters[depth] + 1 : Number(orderedMatch![2]);
      counters[depth] = number;
    } else {
      counters[depth] = 0;
    }

    items.push({
      line: i,
      depth,
      marker,
      number,
      checked: checkbox ? checkbox[1].toLowerCase() === "x" : null,
      content: parseInline(checkbox ? checkbox[2] : rest),
    });
    i += 1;
  }

  return { block: { type: "list", items }, next: i };
}

/** Two spaces or one tab per level; odd spaces round down. */
function listDepth(indent: string): number {
  let columns = 0;
  for (const char of indent) columns += char === "\t" ? 2 : 1;
  return Math.floor(columns / 2);
}

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

/** Parses the inline span of one line: emphasis, code, links, images. */
export function parseInline(src: string): InlineNode[] {
  return inlineRun(src, true);
}

function inlineRun(src: string, allowLinks: boolean): InlineNode[] {
  const out: InlineNode[] = [];
  let text = "";
  let i = 0;

  const flush = () => {
    if (text) {
      out.push({ kind: "text", value: text });
      text = "";
    }
  };

  while (i < src.length) {
    const char = src[i];

    if (char === "\\" && i + 1 < src.length && ESCAPABLE.test(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }

    if (char === "`") {
      const run = /^`+/.exec(src.slice(i))![0];
      const closeAt = src.indexOf(run, i + run.length);
      if (closeAt !== -1) {
        flush();
        out.push({ kind: "code", value: src.slice(i + run.length, closeAt).trim() });
        i = closeAt + run.length;
        continue;
      }
    }

    if (char === "!" && src[i + 1] === "[") {
      const parsed = readLink(src, i + 1);
      if (parsed) {
        const resolved = safeSrc(parsed.href);
        flush();
        if (resolved) {
          out.push({ kind: "image", src: resolved, alt: parsed.label });
        } else {
          // A src we will not load still carries the author's alt text.
          out.push(...inlineRun(parsed.label, allowLinks));
        }
        i = parsed.end;
        continue;
      }
    }

    if (char === "[" && allowLinks) {
      const parsed = readLink(src, i);
      if (parsed) {
        const href = safeHref(parsed.href);
        flush();
        if (href) {
          out.push({ kind: "link", href, children: inlineRun(parsed.label, false) });
        } else {
          out.push(...inlineRun(parsed.label, allowLinks));
        }
        i = parsed.end;
        continue;
      }
    }

    if (char === "~" && src[i + 1] === "~") {
      const closeAt = findCloser(src, i + 2, "~~");
      if (closeAt !== -1) {
        flush();
        out.push({ kind: "strike", children: inlineRun(src.slice(i + 2, closeAt), allowLinks) });
        i = closeAt + 2;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      const double = src[i + 1] === char;
      const marker = double ? char + char : char;
      // `_` inside a word is a snake_case identifier, not emphasis.
      const openOk = char === "*" || !/\w/.test(src[i - 1] ?? "");
      if (openOk) {
        const closeAt = findCloser(src, i + marker.length, marker);
        if (closeAt !== -1) {
          flush();
          const children = inlineRun(src.slice(i + marker.length, closeAt), allowLinks);
          out.push(double ? { kind: "strong", children } : { kind: "em", children });
          i = closeAt + marker.length;
          continue;
        }
      }
    }

    // A pasted URL becomes a link, which is what people expect from one.
    if (allowLinks && (char === "h" || char === "w")) {
      const match = /^(?:https?:\/\/|www\.)[^\s<>]+/.exec(src.slice(i));
      if (match) {
        // Trailing punctuation belongs to the sentence, not the address.
        const raw = match[0].replace(/[.,;:!?)\]}'"]+$/, "");
        const href = raw.startsWith("www.") ? `https://${raw}` : raw;
        if (safeHref(href)) {
          flush();
          out.push({ kind: "link", href, children: [{ kind: "text", value: raw }] });
          i += raw.length;
          continue;
        }
      }
    }

    text += char;
    i += 1;
  }

  flush();
  return out;
}

/** Reads `[label](href)` starting at the opening bracket. */
function readLink(src: string, at: number): { label: string; href: string; end: number } | null {
  let depth = 0;
  let close = -1;
  for (let i = at; i < src.length; i += 1) {
    const char = src[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1 || src[close + 1] !== "(") return null;

  let parens = 0;
  let end = -1;
  for (let i = close + 1; i < src.length; i += 1) {
    const char = src[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === "(") parens += 1;
    else if (char === ")") {
      parens -= 1;
      if (parens === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  const target = src.slice(close + 2, end).trim();
  // `[label](url "title")` — the title is parsed off and dropped.
  const href = target.split(/\s+/)[0] ?? "";
  return { label: src.slice(at + 1, close), href, end: end + 1 };
}

/**
 * Finds the delimiter that closes an emphasis run.
 *
 * A delimiter preceded by whitespace does not close anything (`a * b` is not
 * emphasis), and `_` may not close inside a word, which is what keeps
 * `snake_case_names` intact.
 */
function findCloser(src: string, from: number, marker: string): number {
  let i = from;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src.startsWith(marker, i)) {
      const prev = src[i - 1];
      const next = src[i + marker.length];
      const hasContent = i > from && prev !== " " && prev !== "\t";
      const boundaryOk = marker[0] !== "_" || !/\w/.test(next ?? "");
      if (hasContent && boundaryOk) return i;
    }
    i += 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// URL policy
// ---------------------------------------------------------------------------

/**
 * The allow-list for link targets. Everything else — `javascript:`, `data:`,
 * `vbscript:` and anything novel — is rendered as plain text instead.
 */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(?:https?:|mailto:)/i.test(value)) return value;
  if (/^[/#]/.test(value) && !value.startsWith("//")) return value;
  return null;
}

/** As `safeHref`, but for image sources: http(s) or a same-origin path. */
export function safeSrc(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:/i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

function flattenInline(nodes: InlineNode[], out: string[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        out.push(node.value);
        break;
      case "break":
        out.push("\n");
        break;
      case "code":
        out.push(node.value);
        break;
      case "image":
        break;
      default:
        flattenInline(node.children, out);
    }
  }
}

/** The document as plain text — for previews, excerpts and word counts. */
export function plainText(markdown: string | null | undefined): string {
  const out: string[] = [];
  for (const block of parseDoc(markdown)) {
    switch (block.type) {
      case "heading":
      case "paragraph":
        flattenInline(block.content, out);
        out.push("\n");
        break;
      case "list":
        for (const item of block.items) {
          flattenInline(item.content, out);
          out.push("\n");
        }
        break;
      case "quote":
        for (const line of block.lines) {
          flattenInline(line, out);
          out.push("\n");
        }
        break;
      case "code":
        out.push(block.value, "\n");
        break;
      case "figure":
      case "divider":
        break;
    }
  }
  return out.join("").replace(/\n{2,}/g, "\n").trim();
}

export type DocStats = {
  words: number;
  images: number;
  /** Checklist progress, or null when the document has no checklist. */
  checklist: { done: number; total: number } | null;
  readingMinutes: number;
};

/** Counts shown under the editor, so a long doc tells you how long it is. */
export function docStats(markdown: string | null | undefined): DocStats {
  const blocks = parseDoc(markdown);
  let images = 0;
  let done = 0;
  let total = 0;

  const countImages = (nodes: InlineNode[]) => {
    for (const node of nodes) {
      if (node.kind === "image") images += 1;
      else if ("children" in node) countImages(node.children);
    }
  };

  for (const block of blocks) {
    if (block.type === "figure") images += 1;
    else if (block.type === "heading" || block.type === "paragraph") countImages(block.content);
    else if (block.type === "quote") block.lines.forEach(countImages);
    else if (block.type === "list") {
      for (const item of block.items) {
        if (item.checked !== null) {
          total += 1;
          if (item.checked) done += 1;
        }
        countImages(item.content);
      }
    }
  }

  const text = plainText(markdown);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    words,
    images,
    checklist: total > 0 ? { done, total } : null,
    // 220 wpm, rounded up, so a short doc never reads as "0 min".
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
  };
}

/** True when the body holds nothing that would render. */
export function isEmptyDoc(markdown: string | null | undefined): boolean {
  return parseDoc(markdown).length === 0;
}

/**
 * Flips the checkbox on one source line.
 *
 * Takes a line index from `DocListItem.line`, so the read view can toggle an
 * item without knowing anything about the rest of the document.
 */
export function toggleCheckboxLine(markdown: string, line: number): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const target = lines[line];
  if (target === undefined) return markdown;

  const match = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/.exec(target);
  if (!match) return markdown;

  lines[line] = `${match[1]}${match[2] === " " ? "x" : " "}${match[3]}`;
  return lines.join("\n");
}
