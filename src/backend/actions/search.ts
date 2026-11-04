"use server";

import { db } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { plainText } from "@/shared/doc/markdown";
import { guarded, ok, type ActionResult } from "./shared";
import { listStatuses } from "@/backend/data/statuses";
import { getTranslator } from "@/backend/i18n/locale";
import { findStatus, isBuiltinStatus, toneClass } from "@/shared/domain/statuses";
import type { TaskPriority, TaskStatus } from "@/shared/domain/types";

export type SearchHit =
  | {
      kind: "task";
      id: string;
      title: string;
      status: TaskStatus;
      /** Resolved here: the palette sits outside any task store. */
      statusLabel: string;
      /** A `.tone-*` class. */
      statusTone: string;
      priority: TaskPriority;
      ownerName: string | null;
    }
  | { kind: "meeting"; id: string; title: string; scheduledAt: string | null }
  | { kind: "doc"; id: string; title: string; excerpt: string };

/** Backs the command palette. Scoped to the caller's workspace. */
export async function searchWorkspace(query: string): Promise<ActionResult<SearchHit[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const q = query.trim();
    if (q.length < 2) return ok([]);

    const [tasks, meetings, docs, statuses, { t: translate }] = await Promise.all([
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
      // The library is searched by body as well as title: a page is usually
      // remembered by something written inside it, not by what it was called.
      db.knowledgeDoc.findMany({
        where: {
          workspaceId: session.workspace.id,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
            { labels: { has: q.toLowerCase() } },
          ],
        },
        select: { id: true, title: true, body: true },
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
        take: 4,
      }),
      listStatuses(session.workspace.id),
      getTranslator(),
    ]);

    return ok([
      ...tasks.map(
        (t): SearchHit => ({
          kind: "task",
          id: t.id,
          title: t.title,
          status: t.status,
          statusLabel: isBuiltinStatus(t.status)
            ? translate(`status.${t.status}.label`)
            : findStatus(statuses, t.status).label,
          statusTone: toneClass(findStatus(statuses, t.status).tone),
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
      ...docs.map((d): SearchHit => {
        const text = plainText(d.body);
        return {
          kind: "doc",
          id: d.id,
          title: d.title,
          excerpt: text.length > 90 ? `${text.slice(0, 90).trimEnd()}…` : text,
        };
      }),
    ]);
  });
}
