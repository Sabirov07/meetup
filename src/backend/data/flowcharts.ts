import "server-only";

import { db } from "@/backend/db";
import { toMemberSummary } from "@/backend/auth/guards";
import { parseFlowchartDocument } from "@/shared/domain/flowchart";
import type { FlowchartSummary, FlowchartView } from "@/shared/domain/types";

/**
 * Reads for flowcharts. `workspaceId` must come from `requireSession()` — see
 * the note in `auth/guards.ts` about why RLS does not constrain these queries.
 */

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  user: { select: { id: true, name: true, email: true, accentToken: true } },
} as const;

const summarySelect = {
  id: true,
  title: true,
  description: true,
  document: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: { select: memberSelect },
} as const;

function summarise(row: {
  id: string;
  title: string;
  description: string | null;
  document: unknown;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: Parameters<typeof toMemberSummary>[0] | null;
}): FlowchartSummary {
  const doc = parseFlowchartDocument(row.document);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    nodes: doc.nodes.length,
    edges: doc.edges.length,
    updatedBy: row.updatedBy ? toMemberSummary(row.updatedBy) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Every flowchart in the workspace, most recently touched first. */
export async function listFlowcharts(workspaceId: string): Promise<FlowchartSummary[]> {
  const rows = await db.flowchart.findMany({
    where: { workspaceId },
    select: summarySelect,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(summarise);
}

export async function getFlowchart(id: string, workspaceId: string): Promise<FlowchartView | null> {
  const row = await db.flowchart.findFirst({
    where: { id, workspaceId },
    select: { ...summarySelect, createdBy: { select: memberSelect } },
  });
  if (!row) return null;

  return {
    ...summarise(row),
    document: parseFlowchartDocument(row.document),
    createdBy: row.createdBy ? toMemberSummary(row.createdBy) : null,
  };
}
