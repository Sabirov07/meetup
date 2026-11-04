"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  NODE_SIZE,
  snapToGrid,
  type FlowEdge,
  type FlowNode,
  type FlowchartDocument,
} from "@/shared/domain/flowchart";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { NodeLabel, ShapeOutline, anchorPoint, nodeCentre } from "./flowchart-shapes";

export type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

export type Viewport = { x: number; y: number; zoom: number };

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.5;

/**
 * The drawing surface: an SVG the boxes and arrows are laid on, with the
 * usual canvas manners — drag a box to move it, drag the background to pan,
 * wheel to scroll, ⌘/Ctrl + wheel to zoom.
 *
 * It owns nothing but the viewport and the drag in flight. The document and
 * the selection belong to the editor above it, which is also where a change
 * is written back; the canvas only says what the pointer did.
 */
export function FlowchartCanvas({
  doc,
  selection,
  viewport,
  connectFrom,
  onViewportChange,
  onSelect,
  onMoveNode,
  onConnect,
  onEditLabel,
  onDeleteSelection,
  onCancel,
  className,
}: {
  doc: FlowchartDocument;
  selection: Selection;
  viewport: Viewport;
  /** Set while the connect tool waits for the second box. */
  connectFrom: string | null;
  onViewportChange: (next: Viewport) => void;
  onSelect: (next: Selection) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  /** A click on a box while connecting — the editor decides which end it is. */
  onConnect: (nodeId: string) => void;
  onEditLabel: (selection: NonNullable<Selection>) => void;
  onDeleteSelection: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // The drag in flight: either a box or the whole sheet. Position is kept in
  // state so the box follows the pointer, and written back once on release.
  const [drag, setDrag] = useState<
    | { kind: "node"; id: string; offsetX: number; offsetY: number; x: number; y: number; moved: boolean }
    | { kind: "pan"; startX: number; startY: number; originX: number; originY: number }
    | null
  >(null);

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport],
  );

  function onNodePointerDown(event: ReactPointerEvent, node: FlowNode) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (connectFrom !== null || event.shiftKey) {
      onConnect(node.id);
      return;
    }
    const point = toCanvas(event.clientX, event.clientY);
    onSelect({ kind: "node", id: node.id });
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    setDrag({
      kind: "node",
      id: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      x: node.x,
      y: node.y,
      moved: false,
    });
  }

  function onBackgroundPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    if (connectFrom !== null) {
      onCancel();
      return;
    }
    onSelect(null);
    svgRef.current?.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    });
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag) return;
    if (drag.kind === "node") {
      const point = toCanvas(event.clientX, event.clientY);
      setDrag({
        ...drag,
        x: snapToGrid(point.x - drag.offsetX),
        y: snapToGrid(point.y - drag.offsetY),
        moved: true,
      });
    } else {
      onViewportChange({
        ...viewport,
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
    }
  }

  function onPointerUp() {
    if (drag?.kind === "node" && drag.moved) onMoveNode(drag.id, drag.x, drag.y);
    setDrag(null);
  }

  // Wheel: scroll pans, ⌘/Ctrl + wheel zooms about the pointer. Registered
  // by hand because React's wheel listener is passive and cannot stop the
  // page from scrolling along.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = svg.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const factor = Math.exp(-event.deltaY * 0.0015);
        const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, viewport.zoom * factor));
        const ratio = zoom / viewport.zoom;
        onViewportChange({
          zoom,
          x: px - (px - viewport.x) * ratio,
          y: py - (py - viewport.y) * ratio,
        });
      } else {
        onViewportChange({ ...viewport, x: viewport.x - event.deltaX, y: viewport.y - event.deltaY });
      }
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [viewport, onViewportChange]);

  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape") {
      onCancel();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selection) {
      event.preventDefault();
      onDeleteSelection();
      return;
    }
    if (event.key === "Enter" && selection) {
      event.preventDefault();
      onEditLabel(selection);
    }
  }

  // The dragged box is drawn where the pointer has it, not where the
  // document still says it is.
  const nodes = doc.nodes.map((node) =>
    drag?.kind === "node" && drag.id === node.id ? { ...node, x: drag.x, y: drag.y } : node,
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      role="application"
      aria-label={t("flowcharts.canvasLabel")}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "h-full w-full touch-none select-none outline-none",
        drag?.kind === "pan" ? "cursor-grabbing" : connectFrom ? "cursor-crosshair" : "cursor-grab",
        className,
      )}
      style={{
        backgroundColor: "var(--color-canvas)",
        backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)",
        backgroundSize: `${16 * viewport.zoom}px ${16 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--color-text-muted)" />
        </marker>
        <marker id="flow-arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--color-accent)" />
        </marker>
      </defs>

      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        {doc.edges.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          return (
            <EdgeLine
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              selected={selection?.kind === "edge" && selection.id === edge.id}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect({ kind: "edge", id: edge.id });
                svgRef.current?.focus();
              }}
              onDoubleClick={() => onEditLabel({ kind: "edge", id: edge.id })}
            />
          );
        })}

        {nodes.map((node) => {
          const selected = selection?.kind === "node" && selection.id === node.id;
          const isSource = connectFrom === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              onPointerDown={(event) => onNodePointerDown(event, node)}
              onPointerEnter={() => setHovered(node.id)}
              onPointerLeave={() => setHovered((current) => (current === node.id ? null : current))}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onEditLabel({ kind: "node", id: node.id });
              }}
              className={cn(connectFrom ? "cursor-crosshair" : "cursor-move")}
              style={{ filter: selected ? "drop-shadow(0 0 0 transparent)" : undefined }}
            >
              <ShapeOutline kind={node.kind} selected={selected || isSource} hovered={hovered === node.id} />
              <NodeLabel node={node} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function EdgeLine({
  edge,
  from,
  to,
  selected,
  onPointerDown,
  onDoubleClick,
}: {
  edge: FlowEdge;
  from: FlowNode;
  to: FlowNode;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onDoubleClick: () => void;
}) {
  const start = anchorPoint(from, nodeCentre(to));
  const end = anchorPoint(to, nodeCentre(from));

  // A gentle orthogonal-ish curve: vertical runs bend through the midpoint
  // horizontally, which is how most charts flow (top to bottom).
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const c1 = vertical ? { x: start.x, y: start.y + dy / 2 } : { x: start.x + dx / 2, y: start.y };
  const c2 = vertical ? { x: end.x, y: end.y - dy / 2 } : { x: end.x - dx / 2, y: end.y };
  const path = `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  const stroke = selected ? "var(--color-accent)" : "var(--color-text-muted)";
  const label = edge.label?.trim();
  const labelWidth = label ? label.length * 6.5 + 12 : 0;

  return (
    <g onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} className="cursor-pointer">
      {/* A wide invisible stroke so a thin line is still easy to hit. */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.5}
        markerEnd={`url(#${selected ? "flow-arrow-selected" : "flow-arrow"})`}
      />
      {label && (
        <g transform={`translate(${mid.x} ${mid.y})`}>
          <rect
            x={-labelWidth / 2}
            y={-9}
            width={labelWidth}
            height={18}
            rx={9}
            fill="var(--color-surface)"
            stroke={stroke}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight={500}
            fill={selected ? "var(--color-accent-bright)" : "var(--color-text-secondary)"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

/** A viewport that shows the whole chart inside a box of the given size. */
export function fitViewport(
  doc: FlowchartDocument,
  width: number,
  height: number,
): Viewport {
  if (doc.nodes.length === 0 || width === 0 || height === 0) return { x: 40, y: 40, zoom: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of doc.nodes) {
    const size = NODE_SIZE[node.kind];
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + size.w);
    maxY = Math.max(maxY, node.y + size.h);
  }
  const pad = 48;
  const contentW = maxX - minX + pad * 2;
  const contentH = maxY - minY + pad * 2;
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(width / contentW, height / contentH, 1.25)));
  return {
    zoom,
    x: (width - (maxX - minX) * zoom) / 2 - minX * zoom,
    y: (height - (maxY - minY) * zoom) / 2 - minY * zoom,
  };
}

export { ZOOM_MAX, ZOOM_MIN };
