/**
 * `@mentions` in a task discussion.
 *
 * A message is stored as the plain text someone typed — `@Ann Petrova, can you
 * check this?` — rather than as a markup form like `@[Ann](member:abc)`. The
 * text in the database is then the text that was written, which matters when it
 * is read somewhere this module is not: a database console, an export, an
 * email digest. Resolution happens on the way in (who was named) and on the way
 * out (which spans to highlight), and both run through the functions here so
 * they can never disagree about what counts as a mention.
 *
 * The cost of that choice is ambiguity: two people called Ann make `@Ann`
 * unresolvable. That is handled by refusing to guess — an ambiguous first name
 * is simply not a candidate, so `@Ann` stays text and the writer sees it was
 * not picked up.
 */

/** The handle that addresses the assistant. Reserved: never a person. */
export const AI_HANDLE = "ai";

export type MentionCandidate = {
  /** What is typed after the `@`, without it. */
  handle: string;
  /** Null for the assistant. */
  memberId: string | null;
};

export type MentionSegment =
  | { kind: "text"; value: string }
  | { kind: "member"; handle: string; memberId: string }
  | { kind: "ai"; handle: string };

type Person = { id: string; name: string };

/**
 * Everything `@` can resolve to, longest first so `@Ann Petrova` wins over
 * `@Ann` at the same position.
 *
 * Full names are always candidates. A first name joins them only when exactly
 * one person in the workspace answers to it, which is what makes `@ann` work in
 * the ordinary case without ever picking the wrong Ann.
 */
export function mentionCandidates(members: Person[]): MentionCandidate[] {
  const candidates: MentionCandidate[] = [{ handle: AI_HANDLE, memberId: null }];

  const firstNames = new Map<string, string | null>();
  for (const member of members) {
    const name = member.name.trim();
    if (!name) continue;
    candidates.push({ handle: name, memberId: member.id });

    const first = name.split(/\s+/)[0];
    if (!first || first.toLowerCase() === AI_HANDLE) continue;
    const key = first.toLowerCase();
    // Seen twice: ambiguous, and marked so rather than overwritten.
    firstNames.set(key, firstNames.has(key) ? null : member.id);
  }

  for (const member of members) {
    const first = member.name.trim().split(/\s+/)[0];
    if (!first) continue;
    const key = first.toLowerCase();
    if (firstNames.get(key) !== member.id) continue;
    // A one-word name is already in the list as a full name.
    if (key === member.name.trim().toLowerCase()) continue;
    candidates.push({ handle: first, memberId: member.id });
  }

  return candidates.sort((a, b) => b.handle.length - a.handle.length);
}

/** True when a `@` here starts a mention rather than sitting inside a word. */
function isBoundary(char: string | undefined): boolean {
  return char === undefined || !/[\p{L}\p{N}_@]/u.test(char);
}

/**
 * Splits a message into text and mention spans.
 *
 * Used by the renderer to highlight, and by `mentionsIn` to decide who was
 * named — one scan, so what is highlighted is exactly what was recorded.
 */
export function splitMentions(body: string, members: Person[]): MentionSegment[] {
  const candidates = mentionCandidates(members);
  const segments: MentionSegment[] = [];
  let text = "";
  let i = 0;

  const flush = () => {
    if (text) segments.push({ kind: "text", value: text });
    text = "";
  };

  while (i < body.length) {
    if (body[i] !== "@" || !isBoundary(body[i - 1])) {
      text += body[i];
      i += 1;
      continue;
    }

    const after = body.slice(i + 1);
    const match = candidates.find(
      (candidate) =>
        after.slice(0, candidate.handle.length).toLowerCase() ===
          candidate.handle.toLowerCase() &&
        // Not the start of a longer word: `@ai` must not fire inside `@aisha`.
        isBoundary(after[candidate.handle.length]),
    );

    if (!match) {
      text += body[i];
      i += 1;
      continue;
    }

    flush();
    const handle = after.slice(0, match.handle.length);
    segments.push(
      match.memberId === null
        ? { kind: "ai", handle }
        : { kind: "member", handle, memberId: match.memberId },
    );
    i += 1 + match.handle.length;
  }

  flush();
  return segments;
}

/** Who a message calls in. Member ids are de-duplicated and keep their order. */
export function mentionsIn(
  body: string,
  members: Person[],
): { memberIds: string[]; mentionsAi: boolean } {
  const segments = splitMentions(body, members);
  const memberIds: string[] = [];
  let mentionsAi = false;

  for (const segment of segments) {
    if (segment.kind === "ai") mentionsAi = true;
    if (segment.kind === "member" && !memberIds.includes(segment.memberId)) {
      memberIds.push(segment.memberId);
    }
  }

  return { memberIds, mentionsAi };
}

/**
 * The `@…` being typed at the caret, or null.
 *
 * Names contain spaces, so the query cannot stop at the first one. It runs from
 * the `@` to the caret and is abandoned once it grows past a plausible name,
 * crosses a line, or meets a second `@`.
 */
export function activeMentionQuery(
  value: string,
  caret: number,
): { at: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1 || !isBoundary(before[at - 1])) return null;

  const query = before.slice(at + 1);
  if (query.length > 32) return null;
  if (/[\n@]/.test(query)) return null;
  // Two words is enough for "First Last"; a third means the mention is over.
  if (query.trim().split(/\s+/).length > 2) return null;

  return { at, query };
}

/** Replaces the `@…` being typed with a chosen handle, and says where the caret lands. */
export function applyMention(
  value: string,
  active: { at: number; query: string },
  handle: string,
): { value: string; caret: number } {
  const inserted = `@${handle} `;
  const caret = active.at + inserted.length;
  return {
    value: value.slice(0, active.at) + inserted + value.slice(active.at + 1 + active.query.length),
    caret,
  };
}
