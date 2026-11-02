"use client";

import { Check, Loader2 } from "lucide-react";
import type { DocStats } from "@/shared/doc/markdown";
import { useT } from "@/frontend/i18n";
import type { DocSaveState } from "./use-autosaved-doc";

/** Where a document stands with the server. Silent while there is nothing to say. */
export function SaveBadge({ state }: { state: DocSaveState }) {
  const t = useT();

  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-2xs text-text-faint">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("doc.save.saving")}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-2xs text-success">
        <Check className="h-3 w-3" />
        {t("doc.save.saved")}
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-2xs text-danger">{t("doc.save.error")}</span>;
  }
  return <span className="text-2xs text-text-faint">{t("doc.save.dirty")}</span>;
}

/** How long a document is, and how far through its checklist the work is. */
export function DocStatsLine({
  stats,
  className = "text-2xs text-text-faint",
}: {
  stats: DocStats;
  className?: string;
}) {
  const t = useT();

  const parts = [t("doc.stats.words", { count: stats.words })];
  if (stats.images > 0) parts.push(t("doc.stats.images", { count: stats.images }));
  if (stats.checklist) {
    parts.push(
      t("doc.stats.checklist", {
        done: stats.checklist.done,
        total: stats.checklist.total,
      }),
    );
  }
  if (stats.words > 120) parts.push(t("doc.stats.reading", { count: stats.readingMinutes }));

  return <span className={className}>{parts.join(" · ")}</span>;
}
