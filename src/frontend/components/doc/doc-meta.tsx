"use client";

import { Check, Loader2 } from "lucide-react";
import type { DocStats } from "@/shared/doc/markdown";
import type { DocSaveState } from "./use-autosaved-doc";

/** Where a document stands with the server. Silent while there is nothing to say. */
export function SaveBadge({ state }: { state: DocSaveState }) {
  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-2xs text-text-faint">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-2xs text-success">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-2xs text-danger">Not saved</span>;
  }
  return <span className="text-2xs text-text-faint">Unsaved</span>;
}

/** How long a document is, and how far through its checklist the work is. */
export function DocStatsLine({
  stats,
  className = "text-2xs text-text-faint",
}: {
  stats: DocStats;
  className?: string;
}) {
  const parts = [`${stats.words} ${stats.words === 1 ? "word" : "words"}`];
  if (stats.images > 0) parts.push(`${stats.images} ${stats.images === 1 ? "image" : "images"}`);
  if (stats.checklist) parts.push(`${stats.checklist.done}/${stats.checklist.total} done`);
  if (stats.words > 120) parts.push(`~${stats.readingMinutes} min`);
  return <span className={className}>{parts.join(" · ")}</span>;
}
