/**
 * The editing operations behind the doc toolbar, its keyboard shortcuts and
 * the slash menu.
 *
 * Every function here is pure: it takes the current text and selection and
 * returns the next text and selection. The editor component only has to apply
 * the result and restore the caret, which keeps all of the fiddly
 * "where does the cursor end up" reasoning in one testable place rather than
 * spread through event handlers.
 */

export type TextSelection = { start: number; end: number };
export type TextEdit = { value: string; selection: TextSelection };

/** The block kinds the toolbar can switch between. */
export type BlockKind =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "ordered"
  | "check"
  | "code";

export type InlineMark = "strong" | "em" | "strike" | "code";

export const MARKERS: Record<InlineMark, string> = {
  strong: "**",
  em: "*",
  strike: "~~",
  code: "`",
};

const BLOCK_PREFIX =
  /^(\s*)(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)/;

function startOfLine(value: string, index: number): number {
  return value.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
}

function endOfLine(value: string, index: number): number {
  const next = value.indexOf("\n", index);
  return next === -1 ? value.length : next;
}

/** The character range covering every line the selection touches. */
function lineSpan(value: string, selection: TextSelection): TextSelection {
  return {
    start: startOfLine(value, selection.start),
    end: endOfLine(value, selection.end),
  };
}

function prefixFor(kind: BlockKind, indent: string, index: number): string {
  switch (kind) {
    case "h1":
      return `${indent}# `;
    case "h2":
      return `${indent}## `;
    case "h3":
      return `${indent}### `;
    case "quote":
      return `${indent}> `;
    case "bullet":
      return `${indent}- `;
    case "ordered":
      return `${indent}${index + 1}. `;
    case "check":
      return `${indent}- [ ] `;
    default:
      return indent;
  }
}

/** Reads the block kind of the line the caret sits on. */
export function blockKindAt(value: string, caret: number): BlockKind {
  // An odd number of fences before the caret means it is inside a code block.
  const fences = (value.slice(0, caret).match(/^\s{0,3}(?:```|~~~)/gm) ?? []).length;
  if (fences % 2 === 1) return "code";

  const line = value.slice(startOfLine(value, caret), endOfLine(value, caret));
  if (/^\s*#{3,6}[ \t]/.test(line)) return "h3";
  if (/^\s*##[ \t]/.test(line)) return "h2";
  if (/^\s*#[ \t]/.test(line)) return "h1";
  if (/^\s*>/.test(line)) return "quote";
  if (/^\s*[-*+][ \t]+\[[ xX]\][ \t]/.test(line)) return "check";
  if (/^\s*[-*+][ \t]/.test(line)) return "bullet";
  if (/^\s*\d{1,9}[.)][ \t]/.test(line)) return "ordered";
  return "text";
}

/**
 * Applies a block kind to every line in the selection.
 *
 * Re-applying the kind the lines already have clears it, so the same toolbar
 * button both sets and unsets — which is how every other editor behaves.
 */
export function setBlockKind(
  value: string,
  selection: TextSelection,
  kind: BlockKind,
): TextEdit {
  const span = lineSpan(value, selection);
  const lines = value.slice(span.start, span.end).split("\n");
  const alreadyApplied = lines.every(
    (line) => line.trim() === "" || blockKindAt(`${line}\n`, 0) === kind,
  );
  const target: BlockKind = alreadyApplied ? "text" : kind;

  const rewritten = lines.map((line, index) => {
    const match = BLOCK_PREFIX.exec(line);
    const indent = match ? match[1] : (/^\s*/.exec(line)?.[0] ?? "");
    const body = match ? line.slice(match[0].length) : line.slice(indent.length);
    if (body.trim() === "" && target === "text") return "";
    return prefixFor(target, indent, index) + body;
  });

  const next = value.slice(0, span.start) + rewritten.join("\n") + value.slice(span.end);
  const end = span.start + rewritten.join("\n").length;

  // A caret keeps its line and lands at the end of it; a range stays a range.
  return selection.start === selection.end
    ? { value: next, selection: { start: end, end } }
    : { value: next, selection: { start: span.start, end } };
}

/** Wraps or unwraps the selection in an inline marker. */
export function toggleMark(
  value: string,
  selection: TextSelection,
  mark: InlineMark,
  placeholder = mark === "code" ? "code" : "text",
): TextEdit {
  const marker = MARKERS[mark];
  const { start, end } = selection;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const selected = value.slice(start, end);

  // The markers sit just outside the selection: **[bold]**
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selection: { start: start - marker.length, end: end - marker.length },
    };
  }

  // The selection includes its own markers: [**bold**]
  if (
    selected.length > marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, -marker.length);
    return { value: before + inner + after, selection: { start, end: start + inner.length } };
  }

  const inner = selected || placeholder;
  return {
    value: `${before}${marker}${inner}${marker}${after}`,
    selection: {
      start: start + marker.length,
      end: start + marker.length + inner.length,
    },
  };
}

/** Which inline markers wrap the selection right now, for toolbar state. */
export function activeMarks(value: string, selection: TextSelection): Record<InlineMark, boolean> {
  const before = value.slice(0, selection.start);
  const after = value.slice(selection.end);
  const selected = value.slice(selection.start, selection.end);

  const wrapped = (marker: string) =>
    (before.endsWith(marker) && after.startsWith(marker)) ||
    (selected.length > marker.length * 2 &&
      selected.startsWith(marker) &&
      selected.endsWith(marker));

  return {
    strong: wrapped(MARKERS.strong),
    // `*` would otherwise report true inside a `**bold**` run.
    em: wrapped(MARKERS.em) && !wrapped(MARKERS.strong),
    strike: wrapped(MARKERS.strike),
    code: wrapped(MARKERS.code),
  };
}

/**
 * Inserts text as its own block, with blank lines around it so it parses as
 * one — used for dividers, code fences and images.
 *
 * `caretOffset` places the caret inside the inserted text (the first line of a
 * code fence, say) instead of after it.
 */
export function insertBlock(
  value: string,
  selection: TextSelection,
  text: string,
  caretOffset?: number,
): TextEdit {
  const before = value.slice(0, selection.start);
  const after = value.slice(selection.end);
  const lead = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after.length === 0 ? "\n" : after.startsWith("\n") ? "\n" : "\n\n";
  const caret = before.length + lead.length + (caretOffset ?? text.length);

  return {
    value: before + lead + text + trail + after,
    selection: { start: caret, end: caret },
  };
}

/** Replaces an explicit range — the slash menu uses it to swallow its query. */
export function replaceRange(
  value: string,
  from: number,
  to: number,
  text: string,
): TextEdit {
  const caret = from + text.length;
  return {
    value: value.slice(0, from) + text + value.slice(to),
    selection: { start: caret, end: caret },
  };
}

/** Turns the selection into a link, or inserts one with a placeholder label. */
export function applyLink(value: string, selection: TextSelection, href: string): TextEdit {
  const selected = value.slice(selection.start, selection.end);
  const label = selected || "link";
  const snippet = `[${label}](${href})`;
  const next =
    value.slice(0, selection.start) + snippet + value.slice(selection.end);

  // With no selection the label is a placeholder, so select it to be typed over.
  const caret = selection.start + snippet.length;
  return selected
    ? { value: next, selection: { start: caret, end: caret } }
    : {
        value: next,
        selection: { start: selection.start + 1, end: selection.start + 1 + label.length },
      };
}

/**
 * Enter inside a list, checklist or quote.
 *
 * Returns null when the caret is not in one of those, which leaves Enter to
 * the browser. Pressing it on an empty item drops the marker and leaves the
 * list, the same gesture every outliner uses.
 */
export function continueList(value: string, selection: TextSelection): TextEdit | null {
  if (selection.start !== selection.end) return null;

  const from = startOfLine(value, selection.start);
  const to = endOfLine(value, selection.start);
  const line = value.slice(from, to);

  const match =
    /^(\s*)(?:([-*+])[ \t]+\[([ xX])\][ \t]+|([-*+])[ \t]+|(\d{1,9})([.)])[ \t]+|(>)[ \t]?)(.*)$/.exec(
      line,
    );
  if (!match) return null;

  const [, indent, checkBullet, , bullet, number, numberPunct, quote, body] = match;
  const markerLength = line.length - body.length;

  if (body.trim() === "") {
    // Empty item: strip the marker and stay on the line, out of the list.
    const next = value.slice(0, from) + indent + value.slice(to);
    const caret = from + indent.length;
    return { value: next, selection: { start: caret, end: caret } };
  }

  // Mid-line Enter splits the item and carries the marker onto the new one.
  if (selection.start < from + markerLength) return null;

  const nextMarker = checkBullet
    ? `${indent}${checkBullet} [ ] `
    : bullet
      ? `${indent}${bullet} `
      : number
        ? `${indent}${Number(number) + 1}${numberPunct} `
        : `${indent}${quote} `;

  const insertion = `\n${nextMarker}`;
  const caret = selection.start + insertion.length;
  return {
    value: value.slice(0, selection.start) + insertion + value.slice(selection.start),
    selection: { start: caret, end: caret },
  };
}

/** Tab / Shift-Tab: two spaces per level, which is what the parser nests on. */
export function indentLines(
  value: string,
  selection: TextSelection,
  direction: "in" | "out",
): TextEdit {
  const span = lineSpan(value, selection);
  const lines = value.slice(span.start, span.end).split("\n");

  let firstDelta = 0;
  const rewritten = lines.map((line, index) => {
    if (direction === "in") {
      if (index === 0) firstDelta = 2;
      return `  ${line}`;
    }
    const removed = /^(?: {1,2}|\t)/.exec(line)?.[0].length ?? 0;
    if (index === 0) firstDelta = -removed;
    return line.slice(removed);
  });

  const body = rewritten.join("\n");
  const next = value.slice(0, span.start) + body + value.slice(span.end);

  return selection.start === selection.end
    ? {
        value: next,
        selection: {
          start: Math.max(span.start, selection.start + firstDelta),
          end: Math.max(span.start, selection.start + firstDelta),
        },
      }
    : { value: next, selection: { start: span.start, end: span.start + body.length } };
}

/**
 * The slash-menu trigger: a `/` at the start of a line or after a space, with
 * only word characters typed since.
 */
export function slashTrigger(
  value: string,
  caret: number,
): { from: number; query: string } | null {
  const from = startOfLine(value, caret);
  const line = value.slice(from, caret);
  const match = /(?:^|\s)\/([\w-]*)$/.exec(line);
  if (!match) return null;
  return { from: caret - match[1].length - 1, query: match[1] };
}
