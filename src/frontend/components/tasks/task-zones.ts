import { TASK_STATUSES, type TaskStatus } from "@/shared/domain/types";

/**
 * Drag-and-drop targets, shared by the board and the list.
 *
 * Every drop target is a zone identified by `zone:<owner>:<status>`, where
 * `owner` is a member id, `UNASSIGNED`, or `ANY` (meaning "do not touch the
 * owner"). Owner panels emit zones with a concrete owner; status columns and
 * the list's status groups emit `ANY`. One drop handler therefore covers
 * reassignment, status changes, and manual reordering, and a move is always an
 * update — never a copy.
 *
 * These live in a module of their own, with no `"use client"` and no JSX, so
 * both views can share them without either importing the other's component
 * tree.
 */

export const ANY_OWNER = "ANY";
export const UNASSIGNED = "UNASSIGNED";

export function zoneId(owner: string, status: TaskStatus): string {
  return `zone:${owner}:${status}`;
}

export function parseZone(id: string): { owner: string; status: TaskStatus } | null {
  if (!id.startsWith("zone:")) return null;
  const [, owner, status] = id.split(":");
  if (!owner || !status) return null;
  if (!TASK_STATUSES.includes(status as TaskStatus)) return null;
  return { owner, status: status as TaskStatus };
}
