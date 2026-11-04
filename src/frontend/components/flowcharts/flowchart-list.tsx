"use client";

import { MoreHorizontal, Plus, Search, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createFlowchart, deleteFlowchart, fetchFlowcharts } from "@/backend/actions/flowcharts";
import type { FlowchartSummary } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/ui/feedback";
import { Input } from "@/frontend/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/frontend/components/ui/menu";
import { RelativeTime } from "@/frontend/components/ui/relative-time";

const LIVE_INTERVAL_MS = 30_000;

/** Every flowchart in the workspace — the same list manners as the library. */
export function FlowchartList({ charts: initial }: { charts: FlowchartSummary[] }) {
  const router = useRouter();
  const t = useT();
  const [charts, setCharts] = useState(initial);
  const [query, setQuery] = useState("");
  const [creating, startCreating] = useTransition();

  const [seededFrom, setSeededFrom] = useState(initial);
  if (seededFrom !== initial) {
    setSeededFrom(initial);
    setCharts(initial);
  }

  const localChanges = useRef(0);

  const sync = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const before = localChanges.current;
    const result = await fetchFlowcharts();
    if (!result.ok || localChanges.current !== before) return;
    setCharts((previous) => (sameList(previous, result.data) ? previous : result.data));
  }, []);

  useEffect(() => {
    const run = () => void sync();
    run();
    const timer = setInterval(run, LIVE_INTERVAL_MS);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [sync]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return charts;
    return charts.filter(
      (chart) =>
        chart.title.toLowerCase().includes(needle) ||
        (chart.description ?? "").toLowerCase().includes(needle),
    );
  }, [charts, query]);

  function create() {
    startCreating(async () => {
      const result = await createFlowchart();
      if (!result.ok) {
        toast.error(t("flowcharts.createFailed"), { description: result.error });
        return;
      }
      localChanges.current += 1;
      setCharts((previous) => [result.data, ...previous]);
      router.push(`/flowcharts/${result.data.id}`);
    });
  }

  async function remove(chart: FlowchartSummary) {
    const snapshot = charts;
    localChanges.current += 1;
    setCharts((previous) => previous.filter((item) => item.id !== chart.id));
    const result = await deleteFlowchart(chart.id);
    if (!result.ok) {
      setCharts(snapshot);
      toast.error(t("flowcharts.deleteFailed"), { description: result.error });
      return;
    }
    toast.success(t("flowcharts.deleted"), { description: chart.title });
  }

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">{t("flowcharts.heading")}</h1>
          <p className="mt-1 text-[13px] leading-5 text-text-muted">{t("flowcharts.description")}</p>
        </div>
        <Button variant="primary" size="lg" loading={creating} onClick={create}>
          <Plus className="h-3.5 w-3.5" />
          {t("flowcharts.new")}
        </Button>
      </header>

      {charts.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("flowcharts.searchPlaceholder")}
            aria-label={t("flowcharts.searchLabel")}
            className="pl-8"
          />
        </div>
      )}

      {charts.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={t("flowcharts.empty.title")}
          description={t("flowcharts.empty.description")}
          action={
            <Button variant="secondary" loading={creating} onClick={create}>
              <Plus className="h-3.5 w-3.5" />
              {t("flowcharts.empty.action")}
            </Button>
          }
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("flowcharts.noMatches.title")}
          description={t("flowcharts.noMatches.description")}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((chart) => (
            <ChartCard key={chart.id} chart={chart} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

function sameList(a: FlowchartSummary[], b: FlowchartSummary[]): boolean {
  return (
    a.length === b.length &&
    a.every((chart, index) => chart.id === b[index]?.id && chart.updatedAt === b[index]?.updatedAt)
  );
}

function ChartCard({
  chart,
  onDelete,
}: {
  chart: FlowchartSummary;
  onDelete: (chart: FlowchartSummary) => void;
}) {
  const t = useT();

  return (
    <article className="group/card relative flex flex-col rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-2">
        <Workflow className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
        <h2 className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-text">
          <Link href={`/flowcharts/${chart.id}`} className="before:absolute before:inset-0">
            {chart.title}
          </Link>
        </h2>
        <Menu>
          <MenuTrigger asChild>
            <button
              aria-label={t("flowcharts.actionsFor", { title: chart.title })}
              className="relative z-10 shrink-0 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-text focus-visible:opacity-100 group-hover/card:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem destructive onSelect={() => onDelete(chart)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("flowcharts.delete")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {chart.description && (
        <p className="mt-1.5 line-clamp-2 text-2xs leading-5 text-text-muted">{chart.description}</p>
      )}

      <footer className="mt-2.5 flex items-center gap-1.5 text-2xs text-text-faint">
        {chart.updatedBy && <Avatar member={chart.updatedBy} size="xs" />}
        <span className="truncate">
          {chart.updatedBy ? `${chart.updatedBy.name} · ` : ""}
          <RelativeTime value={chart.updatedAt} />
        </span>
        <span className="ml-auto shrink-0 tabular-nums">
          {t("flowcharts.steps", { count: chart.nodes })} · {t("flowcharts.arrows", { count: chart.edges })}
        </span>
      </footer>
    </article>
  );
}
