"use client";

import type { ReactNode } from "react";
import { NODE_SIZE, type FlowNode, type FlowNodeKind } from "@/shared/domain/flowchart";

/**
 * How each kind of box is drawn.
 *
 * The conventional flowchart shapes, in the product's own colours: a pill for
 * start and end, a rectangle for a step, a diamond for a decision, a
 * parallelogram for input and output, and a dog-eared card for a note. Colour
 * carries the meaning a second time, so a chart still reads at a glance when
 * it is zoomed too far out for the labels.
 */

export const KIND_STYLE: Record<FlowNodeKind, { fill: string; stroke: string; text: string }> = {
  start: { fill: "var(--color-success-dim)", stroke: "var(--color-success)", text: "var(--color-text)" },
  end: { fill: "var(--color-danger-dim)", stroke: "var(--color-danger)", text: "var(--color-text)" },
  process: { fill: "var(--color-surface)", stroke: "var(--color-line-strong)", text: "var(--color-text)" },
  decision: { fill: "var(--color-warning-dim)", stroke: "var(--color-warning)", text: "var(--color-text)" },
  io: { fill: "var(--color-info-dim)", stroke: "var(--color-info)", text: "var(--color-text)" },
  note: { fill: "var(--color-raised)", stroke: "var(--color-line)", text: "var(--color-text-muted)" },
};

export function ShapeOutline({
  kind,
  selected,
  hovered,
}: {
  kind: FlowNodeKind;
  selected?: boolean;
  hovered?: boolean;
}) {
  const { w, h } = NODE_SIZE[kind];
  const style = KIND_STYLE[kind];
  const stroke = selected ? "var(--color-accent)" : style.stroke;
  const strokeWidth = selected ? 2 : hovered ? 1.75 : 1.25;
  const common = { fill: style.fill, stroke, strokeWidth, vectorEffect: "non-scaling-stroke" as const };

  switch (kind) {
    case "start":
    case "end":
      return <rect x={0} y={0} width={w} height={h} rx={h / 2} {...common} />;
    case "decision":
      return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...common} />;
    case "io": {
      const slant = 18;
      return (
        <polygon points={`${slant},0 ${w},0 ${w - slant},${h} 0,${h}`} {...common} />
      );
    }
    case "note": {
      const ear = 12;
      return (
        <g>
          <path
            d={`M0,0 H${w - ear} L${w},${ear} V${h} H0 Z`}
            {...common}
            strokeDasharray={selected ? undefined : "4 3"}
          />
          <path d={`M${w - ear},0 V${ear} H${w}`} fill="none" stroke={stroke} strokeWidth={1} />
        </g>
      );
    }
    default:
      return <rect x={0} y={0} width={w} height={h} rx={8} {...common} />;
  }
}

/** Wraps a label into lines that fit the box; SVG text does not wrap itself. */
export function wrapLabel(label: string, kind: FlowNodeKind): string[] {
  const { w } = NODE_SIZE[kind];
  // Diamonds and slanted boxes lose width at the top and bottom.
  const usable = kind === "decision" ? w * 0.6 : kind === "io" ? w - 44 : w - 24;
  const perLine = Math.max(8, Math.floor(usable / 6.6));
  const words = label.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > perLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  const max = kind === "decision" ? 3 : 2;
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = `${kept[max - 1]!.slice(0, perLine - 1)}…`;
    return kept;
  }
  return lines;
}

export function NodeLabel({ node, children }: { node: FlowNode; children?: ReactNode }) {
  const { w, h } = NODE_SIZE[node.kind];
  const lines = wrapLabel(node.label, node.kind);
  const lineHeight = 15;
  const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
  return (
    <text
      x={w / 2}
      y={startY}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={12}
      fontWeight={node.kind === "note" ? 400 : 500}
      fill={KIND_STYLE[node.kind].text}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={w / 2} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
      {children}
    </text>
  );
}

/** Where an arrow leaves or enters a box: the nearest point on its border. */
export function anchorPoint(node: FlowNode, towards: { x: number; y: number }): { x: number; y: number } {
  const { w, h } = NODE_SIZE[node.kind];
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  if (node.kind === "decision") {
    // A diamond's border is |x|/a + |y|/b = 1.
    const scale = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2));
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  // Rectangle (pills are close enough): clip the ray to the box.
  const scaleX = Math.abs(dx) > 0 ? w / 2 / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 0 ? h / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function nodeCentre(node: FlowNode): { x: number; y: number } {
  const { w, h } = NODE_SIZE[node.kind];
  return { x: node.x + w / 2, y: node.y + h / 2 };
}
