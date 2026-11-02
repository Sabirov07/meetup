"use server";

import { db } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { guarded, ok, type ActionResult } from "./shared";
import type { TaskPriority, TaskStatus } from "@/shared/domain/types";

export type SearchHit =
  | {
      kind: "task";
      id: string;
      title: string;
      status: TaskStatus;
      priority: TaskPriority;
      ownerName: string | null;
    }
  | { kind: "meeting"; id: string; title: string; scheduledAt: string | null };

/** Backs the command palette. Scoped to the caller's workspace. */
export async function searchWorkspace(query: string): Promise<ActionResult<SearchHit[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const q = query.trim();
    if (q.length < 2) return ok([]);

    const [tasks, meetings] = await Promise.all([
      db.task.findMany({
        where: {
          workspaceId: session.workspace.id,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { labels: { has: q.toLowerCase() } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          owner: { select: { user: { select: { name: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      db.meeting.findMany({
        where: {
          workspaceId: session.workspace.id,
          title: { contains: q, mode: "insensitive" },
        },
        select: { id: true, title: true, scheduledAt: true },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ]);

    return ok([
      ...tasks.map(
        (t): SearchHit => ({
          kind: "task",
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          ownerName: t.owner?.user.name ?? null,
        }),
      ),
      ...meetings.map(
        (m): SearchHit => ({
          kind: "meeting",
          id: m.id,
          title: m.title,
          scheduledAt: m.scheduledAt?.toISOString() ?? null,
        }),
      ),
    ]);
  });
}
