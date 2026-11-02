import "server-only";

import { db } from "@/backend/db";
import { message } from "@/backend/i18n/message";
import type { ActivityType } from "@/shared/domain/types";

/** Uniform result shape, so every client call site handles errors the same way. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Wraps an action body so a thrown error becomes a message the UI can show
 * instead of an unhandled server exception. Programmer errors still surface in
 * the server log.
 */
export async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    const text =
      error instanceof Error ? error.message : await message("errors.generic");
    if (process.env.NODE_ENV === "development") console.error("[action]", error);
    return fail(text);
  }
}

export async function logActivity(entry: {
  workspaceId: string;
  actorMemberId: string | null;
  type: ActivityType;
  summary: string;
  taskId?: string | null;
  meetingId?: string | null;
  knowledgeDocId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.activityEvent.create({
    data: {
      workspaceId: entry.workspaceId,
      actorMemberId: entry.actorMemberId,
      type: entry.type,
      summary: entry.summary,
      taskId: entry.taskId ?? null,
      meetingId: entry.meetingId ?? null,
      knowledgeDocId: entry.knowledgeDocId ?? null,
      // Prisma's JSON input type does not accept a bare index signature.
      metadata: (entry.metadata ?? undefined) as never,
    },
  });
}

/** Parses a `yyyy-MM-dd` input into a UTC-noon Date, avoiding timezone drift. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  // Noon UTC keeps the calendar date stable for every timezone the app runs in.
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}
