"use client";

import { Sparkles } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  activeMentionQuery,
  applyMention,
  AI_HANDLE,
} from "@/shared/domain/mentions";
import type { MemberSummary } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Textarea } from "@/frontend/components/ui/field";

/**
 * The discussion composer: a textarea that completes `@`.
 *
 * The picker is anchored to the whole control rather than to the caret. Caret
 * coordinates in a textarea can only be had by mirroring the element into a
 * hidden copy and measuring it, which is a lot of machinery that breaks on
 * every wrap, scroll and font change — and the control it would serve is 50
 * pixels tall in a drawer, where "above the box" is where the list wants to be
 * anyway.
 *
 * The assistant is always the first candidate when it matches. Someone who
 * types `@a` is far more often reaching for the thing that answers than for
 * Alex, and the ordering is what makes `@ai` a two-keystroke habit.
 */

type Candidate =
  | { kind: "ai"; handle: string }
  | { kind: "member"; handle: string; member: MemberSummary };

export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  disabled,
  onSubmit,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  members: MemberSummary[];
  placeholder?: string;
  disabled?: boolean;
  /** ⌘↵ / Ctrl+↵, and only when the picker is not using the key. */
  onSubmit?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);

  const [active, setActive] = useState<{ at: number; query: string } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  /** Set after an insertion, applied once the new value has rendered. */
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const element = ref.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(caret, caret);
  }, [value]);

  const matches = active ? candidatesFor(members, active.query) : [];
  const open = active !== null && matches.length > 0;
  const index = Math.min(highlighted, Math.max(0, matches.length - 1));

  /** Re-reads the caret after anything that can move it. */
  function syncQuery(element: HTMLTextAreaElement) {
    const next = activeMentionQuery(element.value, element.selectionStart ?? 0);
    setActive(next);
    setHighlighted(0);
  }

  function insert(candidate: Candidate) {
    if (!active) return;
    const next = applyMention(value, active, candidate.handle);
    pendingCaret.current = next.caret;
    onChange(next.value);
    setActive(null);
  }

  /** The `@` and `@ai` buttons under the box, for anyone not typing it. */
  function appendHandle(handle: string) {
    const element = ref.current;
    const needsSpace = value.length > 0 && !/\s$/.test(value);
    const next = `${value}${needsSpace ? " " : ""}@${handle}${handle ? " " : ""}`;
    pendingCaret.current = next.length;
    onChange(next);
    // Typing `@` by hand opens the picker, so inserting one should too.
    if (!handle) {
      requestAnimationFrame(() => element && syncQuery(element));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((current) => (current + 1) % matches.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((current) => (current - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insert(matches[index]);
        return;
      }
      if (event.key === "Escape") {
        // Kept off the drawer: this Escape dismissed the picker.
        event.preventDefault();
        event.stopPropagation();
        setActive(null);
        return;
      }
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div className={cn("relative", className)}>
      {open && (
        <div
          role="listbox"
          aria-label={t("discussion.mention")}
          className="absolute bottom-full left-0 z-30 mb-1.5 w-full overflow-hidden rounded-lg border border-line-strong bg-overlay p-1 shadow-popover"
        >
          {matches.map((candidate, position) => (
            <button
              key={candidate.kind === "ai" ? "ai" : candidate.member.id}
              type="button"
              role="option"
              aria-selected={position === index}
              // The textarea must keep the caret, so the press never moves focus.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(position)}
              onClick={() => insert(candidate)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left",
                position === index ? "bg-hover" : "hover:bg-hover",
              )}
            >
              {candidate.kind === "ai" ? (
                <span className="tone-accent inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tone-bg)]">
                  <Sparkles className="h-3 w-3 text-[var(--tone-fg)]" />
                </span>
              ) : (
                <Avatar member={candidate.member} size="md" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-text">
                  {candidate.kind === "ai" ? t("discussion.picker.ai") : candidate.member.name}
                </span>
                <span className="block truncate text-2xs text-text-faint">
                  {candidate.kind === "ai"
                    ? t("discussion.picker.aiHint")
                    : (candidate.member.jobTitle ?? `@${candidate.handle}`)}
                </span>
              </span>
            </button>
          ))}
          <p className="px-1.5 pb-0.5 pt-1 text-2xs text-text-faint">
            {t("discussion.picker.hint")}
          </p>
        </div>
      )}

      <Textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        aria-expanded={open}
        onChange={(event) => {
          onChange(event.target.value);
          syncQuery(event.target);
        }}
        onClick={(event) => syncQuery(event.currentTarget)}
        onKeyUp={(event) => {
          // Arrow keys move the caret without changing the value.
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
            syncQuery(event.currentTarget);
          }
        }}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="min-h-[60px] text-xs"
      />

      <div className="mt-1.5 flex items-center gap-1">
        <ComposerChip label={t("discussion.mention")} onClick={() => appendHandle("")}>
          @
        </ComposerChip>
        <ComposerChip label={t("discussion.askAi")} onClick={() => appendHandle(AI_HANDLE)}>
          <Sparkles className="h-3 w-3" />
          {t("discussion.askAi")}
        </ComposerChip>
      </div>
    </div>
  );
}

function ComposerChip({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-[4px] border border-line px-1.5 py-0.5 text-2xs text-text-muted transition-colors hover:border-line-strong hover:text-text"
    >
      {children}
    </button>
  );
}

/**
 * Who the query could mean, best first.
 *
 * A match on the start of a name outranks a match in the middle of it, so
 * `@pet` offers Petrova before Petrov-the-surname-of-someone-else — within that,
 * the roster's own order is kept rather than re-sorted alphabetically, because
 * it is the order these people appear everywhere else in the product.
 */
function candidatesFor(members: MemberSummary[], query: string): Candidate[] {
  const needle = query.trim().toLowerCase();
  const candidates: Candidate[] = [];

  if (!needle || AI_HANDLE.startsWith(needle)) {
    candidates.push({ kind: "ai", handle: AI_HANDLE });
  }

  const starts: Candidate[] = [];
  const contains: Candidate[] = [];

  for (const member of members) {
    const name = member.name.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    const candidate: Candidate = { kind: "member", handle: name, member };

    if (!needle) {
      starts.push(candidate);
    } else if (
      lower.startsWith(needle) ||
      lower.split(/\s+/).some((part) => part.startsWith(needle))
    ) {
      starts.push(candidate);
    } else if (lower.includes(needle)) {
      contains.push(candidate);
    }
  }

  return [...candidates, ...starts, ...contains].slice(0, 6);
}
