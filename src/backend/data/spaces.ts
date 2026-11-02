import "server-only";

import { db } from "@/backend/db";
import type { SpaceSummary } from "@/shared/domain/types";

/**
 * Reads for the sections of a workspace.
 *
 * Every function takes a `workspaceId` that must have come from
 * `requireSession()` — see the note in `auth/guards.ts` about where isolation
 * is actually enforced.
 */

/**
 * Every section, in sidebar order, with the work filed under each one.
 *
 * The counts come from two grouped queries rather than a count per section:
 * the sidebar draws them on every page, and a workspace with a dozen
 * disciplines would otherwise fire two dozen round trips to render a list of
 * links.
 */
export async function listSpaces(workspaceId: string): Promise<SpaceSummary[]> {
  const [rows, open, total] = await Promise.all([
    db.space.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        colorToken: true,
        description: true,
        position: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.task.groupBy({
      by: ["spaceId"],
      where: { workspaceId, spaceId: { not: null }, status: { not: "COMPLETED" } },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["spaceId"],
      where: { workspaceId, spaceId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const tally = (groups: { spaceId: string | null; _count: { _all: number } }[]) =>
    new Map(
      groups
        .filter((g): g is { spaceId: string; _count: { _all: number } } => Boolean(g.spaceId))
        .map((g) => [g.spaceId, g._count._all]),
    );

  const openBy = tally(open);
  const totalBy = tally(total);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    colorToken: row.colorToken,
    description: row.description,
    position: row.position,
    openTasks: openBy.get(row.id) ?? 0,
    totalTasks: totalBy.get(row.id) ?? 0,
  }));
}

/** One section, or null when the id names nothing in this workspace. */
export async function getSpace(
  spaceId: string,
  workspaceId: string,
): Promise<SpaceSummary | null> {
  const [row, openTasks, totalTasks] = await Promise.all([
    db.space.findFirst({
      where: { id: spaceId, workspaceId },
      select: {
        id: true,
        name: true,
        colorToken: true,
        description: true,
        position: true,
      },
    }),
    db.task.count({ where: { workspaceId, spaceId, status: { not: "COMPLETED" } } }),
    db.task.count({ where: { workspaceId, spaceId } }),
  ]);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    colorToken: row.colorToken,
    description: row.description,
    position: row.position,
    openTasks,
    totalTasks,
  };
}

/** How many open tasks belong to no section at all. */
export async function countUnfiledTasks(workspaceId: string): Promise<number> {
  return db.task.count({
    where: { workspaceId, spaceId: null, status: { not: "COMPLETED" } },
  });
}
