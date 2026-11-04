import { z } from "zod";

/**
 * The shape of a flowchart, as stored and as drawn.
 *
 * A diagram is a handful of boxes and the arrows between them. Everything the
 * canvas needs — what kind of box, what it says, where it sits — lives on the
 * node, and an edge is nothing more than two node ids and an optional word on
 * the arrow ("yes", "no"). Kept deliberately small: a process should be
 * drawable in a minute, and a richer model is what stops that.
 */

export const FLOW_NODE_KINDS = ["start", "process", "decision", "io", "end", "note"] as const;
export type FlowNodeKind = (typeof FLOW_NODE_KINDS)[number];

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  label: string;
  /** Top-left corner on the canvas, in canvas pixels. */
  x: number;
  y: number;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type FlowchartDocument = { nodes: FlowNode[]; edges: FlowEdge[] };

export const EMPTY_FLOWCHART: FlowchartDocument = { nodes: [], edges: [] };

/** One box's footprint. The same for every box of a kind, so a chart lines up. */
export const NODE_SIZE: Record<FlowNodeKind, { w: number; h: number }> = {
  start: { w: 140, h: 44 },
  end: { w: 140, h: 44 },
  process: { w: 168, h: 56 },
  decision: { w: 168, h: 84 },
  io: { w: 168, h: 56 },
  note: { w: 168, h: 56 },
};

/** The grid every box snaps to, so hand-placed boxes still look placed. */
export const GRID = 8;

export const LABEL_MAX = 120;
export const EDGE_LABEL_MAX = 40;
export const NODES_MAX = 300;
export const EDGES_MAX = 600;

const flowNodeSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(FLOW_NODE_KINDS),
  label: z.string().max(LABEL_MAX),
  x: z.number().finite().min(0).max(20_000),
  y: z.number().finite().min(0).max(20_000),
});

const flowEdgeSchema = z.object({
  id: z.string().min(1).max(40),
  from: z.string().min(1).max(40),
  to: z.string().min(1).max(40),
  label: z.string().max(EDGE_LABEL_MAX).optional(),
});

export const flowchartDocumentSchema = z
  .object({
    nodes: z.array(flowNodeSchema).max(NODES_MAX),
    edges: z.array(flowEdgeSchema).max(EDGES_MAX),
  })
  .transform((doc) => {
    // An edge to a box that is gone is a dangling arrow; drop it quietly
    // rather than refuse the whole save over it.
    const ids = new Set(doc.nodes.map((node) => node.id));
    return {
      nodes: doc.nodes,
      edges: doc.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    };
  });

/** Reads a stored document, tolerating anything an older version wrote. */
export function parseFlowchartDocument(value: unknown): FlowchartDocument {
  const parsed = flowchartDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_FLOWCHART;
}

export function snapToGrid(value: number): number {
  return Math.max(0, Math.round(value / GRID) * GRID);
}

export function newId(prefix: "n" | "e"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

/** A canvas big enough for everything on it, with room to keep drawing. */
export function documentBounds(doc: FlowchartDocument): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const node of doc.nodes) {
    const size = NODE_SIZE[node.kind];
    width = Math.max(width, node.x + size.w);
    height = Math.max(height, node.y + size.h);
  }
  return { width: width + 320, height: height + 240 };
}

/**
 * A starter so a new chart is never a blank sheet: a start, a step and an end
 * in a column, which is the skeleton of every process that was ever drawn.
 */
export function starterDocument(labels: { start: string; step: string; end: string }): FlowchartDocument {
  const x = 200;
  return {
    nodes: [
      { id: "n_start", kind: "start", label: labels.start, x: x + 14, y: 40 },
      { id: "n_step", kind: "process", label: labels.step, x, y: 140 },
      { id: "n_end", kind: "end", label: labels.end, x: x + 14, y: 256 },
    ],
    edges: [
      { id: "e_1", from: "n_start", to: "n_step" },
      { id: "e_2", from: "n_step", to: "n_end" },
    ],
  };
}
