"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  Circle,
  Diamond,
  Maximize2,
  MoreHorizontal,
  MoveRight,
  Octagon,
  RectangleHorizontal,
  Square,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteFlowchart, updateFlowchart } from "@/backend/actions/flowcharts";
import {
  FLOW_NODE_KINDS,
  NODE_SIZE,
  newId,
  snapToGrid,
  type FlowNodeKind,
  type FlowchartDocument,
} from "@/shared/domain/flowchart";
import type { FlowchartView } from "@/shared/domain/types";
import { useT, useTx } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Button } from "@/frontend/components/ui/button";
import { Tooltip } from "@/frontend/components/ui/feedback";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/frontend/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/frontend/components/ui/menu";
import { RelativeTime } from "@/frontend/components/ui/relative-time";
import { SaveBadge } from "@/frontend/components/doc/doc-meta";
import { useAutosavedDoc } from "@/frontend/components/doc/use-autosaved-doc";
import { FlowchartCanvas, fitViewport, ZOOM_MAX, ZOOM_MIN, type Selection, type Viewport } from "./flowchart-canvas";
import { KIND_STYLE } from "./flowchart-shapes";

const KIND_ICON: Record<FlowNodeKind, typeof Square> = {
  start: Circle,
  process: Square,
  decision: Diamond,
  io: RectangleHorizontal,
  end: Octagon,
  note: StickyNote,
};

/**
 * One flowchart, open for drawing.
 *
 * A toolbar of shapes on the left, the canvas in the middle, and whatever is
 * selected on the right. The diagram saves itself on the same timer the
 * document editor uses, so drawing feels like drawing and not like filling
 * in a form with a Save button at the end.
 */
export function FlowchartEditor({ chart: initial }: { chart: FlowchartView }) {
  const router = useRouter();
  const t = useT();
  const tx = useTx();

  const [chart, setChart] = useState(initial);
  const [titleDraft, setTitleDraft] = useState(initial.title);
  const [descriptionDraft, setDescriptionDraft] = useState(initial.description ?? "");
  const [selection, setSelection] = useState<Selection>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 40, y: 40, zoom: 1 });
  const frameRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const saveDocument = useCallback(
    async (serialised: string) => {
      const result = await updateFlowchart({ id: initial.id, document: JSON.parse(serialised) });
      if (!result.ok) return result.error;
      setChart((current) => ({ ...result.data, document: current.document }));
      return null;
    },
    [initial.id],
  );

  const { draft, setDraft, state, flush } = useAutosavedDoc({
    initial: JSON.stringify(initial.document),
    save: saveDocument,
    errorTitle: "flowcharts.saveFailed",
  });

  const doc = useMemo<FlowchartDocument>(() => JSON.parse(draft), [draft]);
  const update = useCallback(
    (change: (current: FlowchartDocument) => FlowchartDocument) => {
      setDraft((current) => JSON.stringify(change(JSON.parse(current) as FlowchartDocument)));
    },
    [setDraft],
  );

  // First paint: show the whole chart, whatever size the window is.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setViewport(fitViewport(initial.document, frame.clientWidth, frame.clientHeight));
  }, [initial.document]);

  function fit() {
    const frame = frameRef.current;
    if (!frame) return;
    setViewport(fitViewport(doc, frame.clientWidth, frame.clientHeight));
  }

  function zoomBy(factor: number) {
    const frame = frameRef.current;
    const cx = (frame?.clientWidth ?? 0) / 2;
    const cy = (frame?.clientHeight ?? 0) / 2;
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, viewport.zoom * factor));
    const ratio = zoom / viewport.zoom;
    setViewport({ zoom, x: cx - (cx - viewport.x) * ratio, y: cy - (cy - viewport.y) * ratio });
  }

  /** A new box lands in the middle of the view, below whatever is selected. */
  function addNode(kind: FlowNodeKind) {
    const frame = frameRef.current;
    const size = NODE_SIZE[kind];
    let x = ((frame?.clientWidth ?? 600) / 2 - viewport.x) / viewport.zoom - size.w / 2;
    let y = ((frame?.clientHeight ?? 400) / 2 - viewport.y) / viewport.zoom - size.h / 2;
    const selectedNode = selection?.kind === "node" ? doc.nodes.find((n) => n.id === selection.id) : null;
    if (selectedNode) {
      const selectedSize = NODE_SIZE[selectedNode.kind];
      x = selectedNode.x + selectedSize.w / 2 - size.w / 2;
      y = selectedNode.y + selectedSize.h + 48;
    }
    const id = newId("n");
    const label = t("flowcharts.kind.newLabel", { kind: t(`flowcharts.kind.${kind}`) });
    update((current) => ({
      nodes: [...current.nodes, { id, kind, label, x: snapToGrid(x), y: snapToGrid(y) }],
      // Adding below a selected box also joins them: the common case is
      // "and then this".
      edges: selectedNode
        ? [...current.edges, { id: newId("e"), from: selectedNode.id, to: id }]
        : current.edges,
    }));
    setSelection({ kind: "node", id });
    window.setTimeout(() => labelInputRef.current?.select(), 0);
  }

  function connect(nodeId: string) {
    if (connectFrom === null) {
      setConnectFrom(nodeId);
      setSelection({ kind: "node", id: nodeId });
      return;
    }
    if (connectFrom !== nodeId) {
      const id = newId("e");
      update((current) =>
        current.edges.some((e) => e.from === connectFrom && e.to === nodeId)
          ? current
          : { ...current, edges: [...current.edges, { id, from: connectFrom, to: nodeId }] },
      );
      setSelection({ kind: "edge", id });
      window.setTimeout(() => labelInputRef.current?.focus(), 0);
    }
    setConnectFrom(null);
    setConnecting(false);
  }

  function cancel() {
    setConnectFrom(null);
    setConnecting(false);
  }

  function deleteSelection() {
    if (!selection) return;
    const { kind, id } = selection;
    update((current) =>
      kind === "node"
        ? {
            nodes: current.nodes.filter((n) => n.id !== id),
            edges: current.edges.filter((e) => e.from !== id && e.to !== id),
          }
        : { ...current, edges: current.edges.filter((e) => e.id !== id) },
    );
    setSelection(null);
  }

  async function patch(change: Parameters<typeof updateFlowchart>[0]) {
    const result = await updateFlowchart(change);
    if (result.ok) setChart((current) => ({ ...result.data, document: current.document }));
    else toast.error(t("flowcharts.saveChangeFailed"), { description: result.error });
  }

  function commitTitle() {
    const next = titleDraft.trim();
    if (!next || next === chart.title) {
      setTitleDraft(chart.title);
      return;
    }
    void patch({ id: chart.id, title: next });
  }

  function commitDescription() {
    const next = descriptionDraft.trim();
    if (next === (chart.description ?? "")) return;
    void patch({ id: chart.id, description: next || null });
  }

  async function remove() {
    const result = await deleteFlowchart(chart.id);
    if (!result.ok) {
      toast.error(t("flowcharts.deleteFailed"), { description: result.error });
      return;
    }
    toast.success(t("flowcharts.deleted"), { description: chart.title });
    router.push("/flowcharts");
  }

  const selectedNode = selection?.kind === "node" ? doc.nodes.find((n) => n.id === selection.id) : null;
  const selectedEdge = selection?.kind === "edge" ? doc.edges.find((e) => e.id === selection.id) : null;

  return (
    <div className="flex min-h-0 flex-col" style={{ height: "calc(100dvh - 3rem)" }}>
      {/* Title row */}
      <div className="shrink-0 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/flowcharts"
            className="flex items-center gap-1.5 text-2xs text-text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("flowcharts.heading")}
          </Link>
          <div className="flex items-center gap-1.5">
            <SaveBadge state={state} />
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("flowcharts.chartActions")}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={fit}>
                  <Maximize2 className="h-3.5 w-3.5" />
                  {t("flowcharts.tool.fit")}
                </MenuItem>
                <MenuSeparator />
                <MenuItem destructive onSelect={remove}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("flowcharts.delete")}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
        <input
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setTitleDraft(chart.title);
              event.currentTarget.blur();
            }
          }}
          aria-label={t("flowcharts.title")}
          placeholder={t("flowcharts.untitled")}
          className="mt-1 -mx-2 w-[calc(100%+1rem)] rounded-md bg-transparent px-2 py-0.5 text-lg font-semibold tracking-[-0.02em] text-text outline-none transition-colors placeholder:text-text-faint hover:bg-hover focus:bg-hover"
        />
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-2xs text-text-faint">
          {chart.updatedBy && <Avatar member={chart.updatedBy} size="xs" />}
          <span>
            {chart.updatedBy
              ? tx("flowcharts.editedBy", { name: chart.updatedBy.name, when: <RelativeTime value={chart.updatedAt} /> })
              : tx("flowcharts.edited", { when: <RelativeTime value={chart.updatedAt} /> })}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{t("flowcharts.steps", { count: doc.nodes.length })}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{t("flowcharts.arrows", { count: doc.edges.length })}</span>
        </div>
      </div>

      {/* Workbench */}
      <div className="flex min-h-0 flex-1">
        {/* Shapes */}
        <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-sidebar py-2">
          {FLOW_NODE_KINDS.map((kind) => {
            const Icon = KIND_ICON[kind];
            return (
              <Tooltip key={kind} content={`${t("flowcharts.tool.add")}: ${t(`flowcharts.kind.${kind}`)}`} side="right">
                <button
                  type="button"
                  onClick={() => addNode(kind)}
                  aria-label={`${t("flowcharts.tool.add")}: ${t(`flowcharts.kind.${kind}`)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-hover hover:text-text"
                >
                  <Icon className="h-4 w-4" style={{ color: KIND_STYLE[kind].stroke }} />
                </button>
              </Tooltip>
            );
          })}
          <div className="my-1 h-px w-6 bg-line" />
          <Tooltip content={t("flowcharts.tool.connect")} side="right">
            <button
              type="button"
              aria-label={t("flowcharts.tool.connect")}
              aria-pressed={connecting}
              onClick={() => (connecting ? cancel() : setConnecting(true))}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                connecting ? "bg-accent-dim text-accent-bright" : "text-text-secondary hover:bg-hover hover:text-text",
              )}
            >
              <MoveRight className="h-4 w-4" />
            </button>
          </Tooltip>
          <div className="mt-auto flex flex-col items-center gap-1">
            <Tooltip content={t("flowcharts.tool.zoomIn")} side="right">
              <Button variant="ghost" size="icon-sm" aria-label={t("flowcharts.tool.zoomIn")} onClick={() => zoomBy(1.2)}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content={t("flowcharts.tool.zoomOut")} side="right">
              <Button variant="ghost" size="icon-sm" aria-label={t("flowcharts.tool.zoomOut")} onClick={() => zoomBy(1 / 1.2)}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content={t("flowcharts.tool.fit")} side="right">
              <Button variant="ghost" size="icon-sm" aria-label={t("flowcharts.tool.fit")} onClick={fit}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <span className="pb-1 text-2xs tabular-nums text-text-faint">{Math.round(viewport.zoom * 100)}%</span>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={frameRef} className="relative min-w-0 flex-1">
          <FlowchartCanvas
            doc={doc}
            selection={selection}
            viewport={viewport}
            connectFrom={connecting ? (connectFrom ?? "") : connectFrom}
            onViewportChange={setViewport}
            onSelect={setSelection}
            onMoveNode={(id, x, y) =>
              update((current) => ({
                ...current,
                nodes: current.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
              }))
            }
            onConnect={(nodeId) => {
              if (connecting && connectFrom === null) {
                setConnectFrom(nodeId);
                setSelection({ kind: "node", id: nodeId });
              } else connect(nodeId);
            }}
            onEditLabel={(target) => {
              setSelection(target);
              window.setTimeout(() => labelInputRef.current?.select(), 0);
            }}
            onDeleteSelection={deleteSelection}
            onCancel={cancel}
          />
          <p className="pointer-events-none absolute bottom-2 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full border border-line bg-surface/90 px-3 py-1 text-center text-2xs text-text-muted backdrop-blur">
            {connecting || connectFrom
              ? connectFrom
                ? t("flowcharts.tool.connectFrom")
                : t("flowcharts.tool.connectHint")
              : t("flowcharts.tool.canvasHint")}
          </p>
        </div>

        {/* Inspector */}
        <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-sidebar p-3 md:flex">
          {selectedNode ? (
            <>
              <p className="eyebrow">{t("flowcharts.selection.node")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="flow-node-label">{t("flowcharts.nodeLabel")}</Label>
                <Input
                  id="flow-node-label"
                  ref={labelInputRef}
                  value={selectedNode.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    update((current) => ({
                      ...current,
                      nodes: current.nodes.map((n) => (n.id === selectedNode.id ? { ...n, label } : n)),
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                  }}
                  onBlur={flush}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("flowcharts.nodeKind")}</Label>
                <Select
                  value={selectedNode.kind}
                  onValueChange={(kind) =>
                    update((current) => ({
                      ...current,
                      nodes: current.nodes.map((n) =>
                        n.id === selectedNode.id ? { ...n, kind: kind as FlowNodeKind } : n,
                      ),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOW_NODE_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {t(`flowcharts.kind.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="danger" size="sm" onClick={deleteSelection}>
                <Trash2 className="h-3 w-3" />
                {t("flowcharts.selection.remove")}
              </Button>
            </>
          ) : selectedEdge ? (
            <>
              <p className="eyebrow">{t("flowcharts.selection.edge")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="flow-edge-label">{t("flowcharts.edgeLabel")}</Label>
                <Input
                  id="flow-edge-label"
                  ref={labelInputRef}
                  value={selectedEdge.label ?? ""}
                  placeholder={t("flowcharts.edgeLabelPlaceholder")}
                  onChange={(event) => {
                    const label = event.target.value;
                    update((current) => ({
                      ...current,
                      edges: current.edges.map((e) =>
                        e.id === selectedEdge.id ? { ...e, label: label || undefined } : e,
                      ),
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                  }}
                  onBlur={flush}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      edges: current.edges.map((e) =>
                        e.id === selectedEdge.id ? { ...e, from: e.to, to: e.from } : e,
                      ),
                    }))
                  }
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  {t("flowcharts.selection.reverse")}
                </Button>
                <Button variant="danger" size="sm" onClick={deleteSelection}>
                  <Trash2 className="h-3 w-3" />
                  {t("flowcharts.selection.remove")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-2xs leading-5 text-text-muted">{t("flowcharts.selection.none")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="flow-description">{t("flowcharts.descriptionLabel")}</Label>
                <Textarea
                  id="flow-description"
                  rows={4}
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  onBlur={commitDescription}
                  placeholder={t("flowcharts.descriptionPlaceholder")}
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
