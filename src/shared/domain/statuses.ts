import type { TaskStatus, TaskStatusDef } from "./types";

/**
 * The stages a task moves through, per workspace.
 *
 * Four of them are built in and present everywhere: TODO, IN_PROGRESS,
 * BLOCKED and COMPLETED. They keep their historical keys so nothing stored
 * changes meaning, and COMPLETED remains the one key the code understands —
 * it is what marks work as done, hides it from open lists and stamps
 * `completedAt`. Everything else is a stage someone added, which behaves like
 * an open status that happens to have its own column.
 */

export const BUILTIN_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;
export type BuiltinStatus = (typeof BUILTIN_STATUSES)[number];

export function isBuiltinStatus(key: string): key is BuiltinStatus {
  return (BUILTIN_STATUSES as readonly string[]).includes(key);
}

/** The colour tokens a status may use; each maps to a `.tone-*` class. */
export const STATUS_TONES = ["neutral", "accent", "info", "warning", "success", "danger"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

export function isStatusTone(value: string): value is StatusTone {
  return (STATUS_TONES as readonly string[]).includes(value);
}

export function toneClass(tone: string): string {
  return `tone-${isStatusTone(tone) ? tone : "neutral"}`;
}

/** The built-ins as they are first written into a workspace. */
export const BUILTIN_STATUS_DEFAULTS: { key: BuiltinStatus; tone: StatusTone; position: number }[] = [
  { key: "TODO", tone: "neutral", position: 100 },
  { key: "IN_PROGRESS", tone: "accent", position: 200 },
  { key: "BLOCKED", tone: "warning", position: 300 },
  { key: "COMPLETED", tone: "success", position: 400 },
];

/** Custom keys are prefixed so they can never collide with a built-in. */
export const CUSTOM_STATUS_PREFIX = "cs_";

export const STATUS_LABEL_MAX = 40;
export const MAX_CUSTOM_STATUSES = 12;

/** Statuses are spaced apart so one can be dropped between two others. */
export const STATUS_POSITION_STEP = 100;

/**
 * Finds a status by key, with a stand-in for one that is not in the list — a
 * task whose status was deleted a moment ago, say. The stand-in is neutral
 * and shows the key, so the row is still readable rather than crashing.
 */
export function findStatus(defs: readonly TaskStatusDef[], key: TaskStatus): TaskStatusDef {
  return (
    defs.find((d) => d.key === key) ?? {
      id: key,
      key,
      label: key,
      tone: "neutral",
      position: Number.MAX_SAFE_INTEGER,
      builtin: isBuiltinStatus(key),
    }
  );
}

export function isValidStatus(defs: readonly TaskStatusDef[], key: string): boolean {
  return defs.some((d) => d.key === key);
}
