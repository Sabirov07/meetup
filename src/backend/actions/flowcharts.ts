"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { getFlowchart, listFlowcharts } from "@/backend/data/flowcharts";
import { flowchartDocumentSchema, starterDocument } from "@/shared/domain/flowchart";
import type { FlowchartSummary, FlowchartView } from "@/shared/domain/types";
import { message } from "@/backend/i18n/message";
import { fail, guarded, ok, type ActionResult } from "./shared";

/**
 * Writes for flowcharts.
 *
 * Like a knowledge page, a flowchart belongs to the workspace rather than to a
 * person: any member may draw on it or delete it. The one check on every call
 * is that the chart is in the caller's workspace.
 */

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 1_000;

async function assertInWorkspace(id: string, workspaceId: string) {
  const chart = await db.flowchart.findFirst({
    where: { id, workspaceId },
    select: { id: true, title: true },
  });
  if (!chart) throw new Error(await message("errors.flowchart.gone"));
  return chart;
}

const createInput = z.object({
  title: z.string().trim().max(TITLE_MAX).optional(),
});

/** Starts a chart with a start, one step and an end already on the canvas. */
export async function createFlowchart(
  raw: z.input<typeof createInput> = {},
): Promise<ActionResult<FlowchartView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = createInput.safeParse(raw);
    if (!parsed.success) return fail(await message("errors.flowchart.invalid"));

    const title = parsed.data.title?.trim() || (await message("errors.flowchart.untitled"));
    const document = starterDocument({
      start: await message("flowcharts.starter.start"),
      step: await message("flowcharts.starter.step"),
      end: await message("flowcharts.starter.end"),
    });

    const created = await db.flowchart.create({
      data: {
        workspaceId: session.workspace.id,
        title,
        document,
        createdByMemberId: session.member.id,
        updatedByMemberId: session.member.id,
      },
      select: { id: true },
    });

    const chart = await getFlowchart(created.id, session.workspace.id);
    if (!chart) return fail(await message("errors.generic"));
    return ok(chart);
  });
}

const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "errors.flowchart.needsTitle").max(TITLE_MAX).optional(),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  document: flowchartDocumentSchema.optional(),
});

export async function updateFlowchart(
  raw: z.input<typeof updateInput>,
): Promise<ActionResult<FlowchartView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = updateInput.safeParse(raw);
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message;
      return fail(
        await message(
          key?.startsWith("errors.") ? (key as "errors.flowchart.needsTitle") : "errors.flowchart.invalid",
        ),
      );
    }

    const { id, ...changes } = parsed.data;
    await assertInWorkspace(id, session.workspace.id);

    const data: Record<string, unknown> = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.description !== undefined) data.description = changes.description || null;
    if (changes.document !== undefined) data.document = changes.document;

    if (Object.keys(data).length > 0) {
      data.updatedByMemberId = session.member.id;
      await db.flowchart.update({ where: { id }, data });
    }

    const chart = await getFlowchart(id, session.workspace.id);
    if (!chart) return fail(await message("errors.flowchart.goneShort"));
    // The canvas keeps its own copy and saves on a timer; a refresh on every
    // save would re-render the segment under the person's hand. The metadata
    // writes (title, description) are the ones worth re-reading.
    if (changes.document === undefined) refresh();
    return ok(chart);
  });
}

export async function deleteFlowchart(id: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await assertInWorkspace(id, session.workspace.id);
    await db.flowchart.delete({ where: { id } });
    refresh();
    return ok(undefined);
  });
}

/** The list as it stands now — see the knowledge library for why it asks. */
export async function fetchFlowcharts(): Promise<ActionResult<FlowchartSummary[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    return ok(await listFlowcharts(session.workspace.id));
  });
}
