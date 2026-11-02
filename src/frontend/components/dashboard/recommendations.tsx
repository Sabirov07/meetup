"use client";

import { Lightbulb, X } from "lucide-react";
import { useMemo, useState } from "react";
import { dismissRecommendation } from "@/backend/actions/recommendations";
import { buildRecommendations } from "@/shared/domain/recommendations";
import { recommendationMeta } from "@/shared/domain/labels";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState, Tooltip } from "@/frontend/components/ui/feedback";
import { EvidenceBadge } from "@/frontend/components/tasks/task-detail-sheet";
import { useTasks } from "@/frontend/components/tasks/task-store";

/**
 * Recommendations.
 *
 * Every item is derived from live task state and cites the tasks it came from,
 * which is why clicking one opens the task rather than just explaining itself.
 * Nothing here is generated prose about tasks that do not exist.
 */
export function Recommendations({
  dismissedIds,
  limit = 4,
  className,
}: {
  dismissedIds: string[];
  limit?: number;
  className?: string;
}) {
  const { tasks, currentMemberId, now, setOpenTaskId } = useTasks();
  const t = useT();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set(dismissedIds));
  const [expanded, setExpanded] = useState(false);

  // `t` is part of the input: switching language re-derives the sentences.
  const all = useMemo(
    () => buildRecommendations(tasks, now, { currentMemberId, dismissedIds: dismissed, t }),
    [tasks, now, currentMemberId, dismissed, t],
  );

  const shown = expanded ? all : all.slice(0, limit);

  return (
    <section
      className={cn("flex flex-col overflow-hidden rounded-xl border border-line bg-surface", className)}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <Lightbulb className="h-3.5 w-3.5 text-accent-bright" />
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">
          {t("recs.heading")}
        </h2>
        {all.length > 0 && (
          <span className="ml-auto text-2xs text-text-faint">{all.length}</span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <EmptyState
            compact
            icon={Lightbulb}
            title={t("recs.empty.title")}
            description={t("recs.empty.description")}
          />
        ) : (
          shown.map((recommendation) => {
            const meta = recommendationMeta[recommendation.kind];
            const firstTask = recommendation.relatedTaskIds[0];

            return (
              <div
                key={recommendation.id}
                className="group relative border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-hover"
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => firstTask && setOpenTaskId(firstTask)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={meta.tone}>
                        {t(`recommendation.${recommendation.kind}.label`)}
                      </Badge>
                      <EvidenceBadge level={recommendation.evidence} />
                    </div>
                    <p className="mt-1 text-[13px] font-medium leading-5 text-text">
                      {recommendation.title}
                    </p>
                    <p className="mt-0.5 text-2xs leading-4 text-text-muted">
                      {recommendation.body}
                    </p>
                    <p className="mt-1 text-2xs text-text-faint">
                      {t("recs.basedOn", { count: recommendation.relatedTaskIds.length })}
                    </p>
                  </button>

                  <Tooltip content={t("recs.dismiss")}>
                    <button
                      aria-label={t("recs.dismissNamed", { title: recommendation.title })}
                      onClick={() => {
                        setDismissed((prev) => new Set(prev).add(recommendation.id));
                        void dismissRecommendation({
                          id: recommendation.id,
                          kind: recommendation.kind,
                          title: recommendation.title,
                          body: recommendation.body,
                          relatedTaskIds: recommendation.relatedTaskIds,
                        });
                      }}
                      className="shrink-0 rounded-md p-1 text-text-faint opacity-0 transition-opacity hover:bg-raised hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })
        )}
      </div>

      {all.length > limit && (
        <div className="shrink-0 border-t border-line px-3 py-1.5">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded
              ? t("recs.showFewer")
              : t("recs.showMore", { count: all.length - limit })}
          </Button>
        </div>
      )}
    </section>
  );
}
