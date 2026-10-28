"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireSessionForAction } from "@/lib/auth/guards";
import { guarded, ok, type ActionResult } from "./shared";

const RECOMMENDATION_KINDS = [
  "UNBLOCK_DEPENDENCY",
  "REQUEST_ACCESS",
  "CLARIFY_DEADLINE",
  "HIGH_IMPACT_BLOCKER",
  "POSSIBLE_DUPLICATE",
  "STALE_TASK",
  "OVERDUE_CLUSTER",
  "AWAITING_OTHER_PERSON",
] as const;

const input = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(RECOMMENDATION_KINDS),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(2000),
  relatedTaskIds: z.array(z.string()).max(50),
});

/**
 * Records a dismissal.
 *
 * Deterministic recommendations are computed from live task state rather than
 * stored, so the row written here exists only to remember that this particular
 * recommendation was waved away. The id is the stable hash produced by
 * `recommendationId`, so the same situation stays dismissed across restarts.
 */
export async function dismissRecommendation(
  raw: z.input<typeof input>,
): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = input.safeParse(raw);
    if (!parsed.success) return ok(undefined);

    await db.recommendation.upsert({
      where: { id: parsed.data.id },
      update: { status: "DISMISSED" },
      create: {
        id: parsed.data.id,
        workspaceId: session.workspace.id,
        kind: parsed.data.kind,
        title: parsed.data.title,
        body: parsed.data.body,
        relatedTaskIds: parsed.data.relatedTaskIds,
        status: "DISMISSED",
        isDeterministic: true,
      },
    });

    return ok(undefined);
  });
}

export async function restoreAllRecommendations(): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await db.recommendation.deleteMany({
      where: { workspaceId: session.workspace.id, status: "DISMISSED" },
    });
    return ok(undefined);
  });
}
