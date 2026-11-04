import "server-only";

import { db } from "@/backend/db";
import { BUILTIN_STATUS_DEFAULTS } from "@/shared/domain/statuses";
import type { TaskStatusDef } from "@/shared/domain/types";

/**
 * Reads for a workspace's task statuses.
 *
 * `workspaceId` must come from `requireSession()` — see `auth/guards.ts` for
 * why the database's policies do not constrain these queries.
 */

const select = {
  id: true,
  key: true,
  label: true,
  tone: true,
  position: true,
  builtin: true,
} as const;

/**
 * Every status, in the order the workspace shows them.
 *
 * A workspace that has none yet — one made before statuses became rows, or
 * one created without them — is given the four built-ins on first read. That
 * keeps every surface that lists statuses from ever seeing an empty list, and
 * spares each place that creates a workspace from having to remember.
 */
export async function listStatuses(workspaceId: string): Promise<TaskStatusDef[]> {
  const rows = await db.taskStatusDefinition.findMany({
    where: { workspaceId },
    select,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length > 0) return rows;

  await db.taskStatusDefinition.createMany({
    data: BUILTIN_STATUS_DEFAULTS.map((s) => ({
      workspaceId,
      key: s.key,
      tone: s.tone,
      position: s.position,
      builtin: true,
    })),
    skipDuplicates: true,
  });
  return db.taskStatusDefinition.findMany({
    where: { workspaceId },
    select,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}
