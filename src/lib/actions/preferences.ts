"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireSessionForAction } from "@/lib/auth/guards";
import { SORT_MODES } from "@/lib/domain/types";
import { guarded, ok, type ActionResult } from "./shared";

export async function setSidebarCollapsed(collapsed: boolean): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await db.userPreference.upsert({
      where: { userId: session.userId },
      update: { sidebarCollapsed: collapsed },
      create: {
        userId: session.userId,
        sidebarCollapsed: collapsed,
        lastWorkspaceId: session.workspace.id,
      },
    });
    return ok(undefined);
  });
}

export async function setDefaultSort(
  mode: (typeof SORT_MODES)[number],
): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = z.enum(SORT_MODES).safeParse(mode);
    if (!parsed.success) return ok(undefined);
    await db.userPreference.upsert({
      where: { userId: session.userId },
      update: { defaultSort: parsed.data },
      create: {
        userId: session.userId,
        defaultSort: parsed.data,
        lastWorkspaceId: session.workspace.id,
      },
    });
    return ok(undefined);
  });
}
