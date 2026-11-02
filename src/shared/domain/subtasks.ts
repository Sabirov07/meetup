import type { SubtaskRef } from "./types";

/**
 * Turning typed or pasted text into steps.
 *
 * Shared by the composer and the action behind it, so the count the button
 * promises ("Add 4 steps") is produced by the same code that decides what
 * actually gets written. A client that parsed differently from the server
 * would be a button that lies.
 */

/** Per task. High enough never to be met by hand, low enough to bound a paste. */
export const MAX_SUBTASKS_PER_TASK = 100;

export const SUBTASK_TITLE_MAX = 200;

/**
 * List markup people paste without thinking: hyphen and bullet lists, numbered
 * lists, and Markdown checkboxes — including the ones already ticked, since a
 * half-finished list copied out of a document is a very normal thing to paste.
 */
const LEADING_MARKER = /^\s*(?:[-*+•–—]\s+|\d{1,3}[.)]\s+)?(?:\[[ xX]\]\s*)?/;

/**
 * Splits text into step titles, one per line.
 *
 * The same function serves both ways of adding: a single typed line comes back
 * as one title, and a pasted list comes back as several. That is what lets the
 * one-by-one field accept a paste without a mode switch.
 */
export function parseSubtaskLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(LEADING_MARKER, "").trim().slice(0, SUBTASK_TITLE_MAX))
    .filter(Boolean);
}

/** How far down the list the work is, or null when there are no steps. */
export function subtaskProgress(
  subtasks: SubtaskRef[],
): { done: number; total: number; percent: number } | null {
  if (subtasks.length === 0) return null;
  const done = subtasks.filter((subtask) => subtask.done).length;
  return {
    done,
    total: subtasks.length,
    percent: Math.round((done / subtasks.length) * 100),
  };
}
