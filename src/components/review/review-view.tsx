"use client";

import { CheckCheck, CircleHelp, FileText, Gavel, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { approveProposals } from "@/lib/actions/analysis";
import type { AnalysisView, MemberSummary } from "@/lib/domain/types";
import { evidenceMeta, transcriptStatusMeta } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import { Badge, Count } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, EmptyState, Tooltip } from "@/components/ui/feedback";
import { ProposalCard } from "./proposal-card";

/**
 * AI review.
 *
 * The page is organised so the three kinds of statement never blur together:
 * what was *decided* (settled in the conversation), what is *proposed* (needs
 * a human yes), and what is *unresolved* (a question for a person to answer).
 */
export function ReviewView({
  analyses: initial,
  members,
  aiConfigured,
  serverNow,
}: {
  analyses: AnalysisView[];
  members: MemberSummary[];
  aiConfigured: boolean;
  serverNow: string;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const now = useMemo(() => new Date(serverNow), [serverNow]);

  const analyses = initial
    .map((analysis) => ({
      ...analysis,
      proposals: analysis.proposals.filter(
        (p) => p.status === "PENDING" && !resolved.has(p.id),
      ),
    }))
    .filter(
      (analysis) =>
        analysis.proposals.length > 0 ||
        analysis.summary ||
        analysis.status === "FAILED" ||
        analysis.status === "RUNNING",
    );

  const pendingTotal = analyses.reduce((sum, a) => sum + a.proposals.length, 0);

  function resolve(id: string) {
    setResolved((prev) => new Set(prev).add(id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function approveSelected() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    const result = await approveProposals(ids);
    setBulkBusy(false);

    if (!result.ok) {
      toast.error("Bulk approval failed", { description: result.error });
      return;
    }
    ids.forEach(resolve);
    toast.success(
      `${result.data.approved} ${result.data.approved === 1 ? "task" : "tasks"} created`,
      result.data.failed > 0
        ? { description: `${result.data.failed} could not be approved.` }
        : undefined,
    );
  }

  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">AI review</h1>
          <p className="mt-1 max-w-[46rem] text-[13px] leading-5 text-text-muted">
            Nothing here is a commitment yet. Approve a proposal and it becomes a real task;
            your edits are kept, and a later re-analysis will not overwrite them.
          </p>
        </div>

        {pendingTotal > 0 && (
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => void approveSelected()}
                loading={bulkBusy}
                loadingLabel="Approving…"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Approve {selected.size} selected
              </Button>
            )}
          </div>
        )}
      </header>

      {/* How to read this page */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line bg-surface px-3 py-2">
        {(["CONFIRMED", "INFERRED", "RECOMMENDED"] as const).map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <Badge tone={evidenceMeta[level].tone} variant="outline">
              {evidenceMeta[level].label}
            </Badge>
            <span className="text-2xs text-text-muted">{evidenceMeta[level].description}</span>
          </span>
        ))}
      </div>

      {!aiConfigured && (
        <div className="tone-warning rounded-lg bg-[var(--tone-bg)] px-3 py-2.5">
          <p className="text-xs font-medium text-[var(--tone-fg)]">
            Transcript analysis is switched off
          </p>
          <p className="mt-0.5 text-2xs leading-4 text-text-secondary">
            Add <code className="rounded-[3px] bg-canvas px-1 font-mono">ANTHROPIC_API_KEY</code>{" "}
            to <code className="rounded-[3px] bg-canvas px-1 font-mono">.env.local</code> and
            restart the dev server. Existing proposals below can still be reviewed.
          </p>
        </div>
      )}

      {analyses.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={Sparkles}
            title="Nothing waiting for review"
            description="Add a transcript to a meeting and run the analysis. Proposed tasks, decisions and open questions will appear here for you to approve."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/meetings">Go to meetings</Link>
              </Button>
            }
          />
        </div>
      ) : (
        analyses.map((analysis) => (
          <section key={analysis.id} className="space-y-3">
            {/* Meeting header */}
            <div className="rounded-xl border border-line bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/meetings/${analysis.meetingId}`}
                      className="text-[13px] font-semibold tracking-[-0.01em] text-text hover:underline"
                    >
                      {analysis.meetingTitle}
                    </Link>
                    {analysis.isSample && (
                      <Tooltip content="Seeded example content. Not a real transcript analysis.">
                        <span>
                          <Badge tone="tone-neutral" variant="outline">
                            Sample data
                          </Badge>
                        </span>
                      </Tooltip>
                    )}
                    <Badge tone={transcriptStatusMeta[analysis.transcriptStatus].tone}>
                      {transcriptStatusMeta[analysis.transcriptStatus].label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-2xs text-text-faint">
                    {analysis.meetingDate ? formatDate(analysis.meetingDate, now) : "No date"}
                    {analysis.model && ` · analysed with ${analysis.model}`}
                  </p>
                </div>

                {analysis.proposals.length > 0 && (
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-2xs text-text-muted">
                    <Checkbox
                      checked={analysis.proposals.every((p) => selected.has(p.id))}
                      onCheckedChange={(value) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const p of analysis.proposals) {
                            if (value) next.add(p.id);
                            else next.delete(p.id);
                          }
                          return next;
                        })
                      }
                    />
                    Select all
                  </label>
                )}
              </div>

              {analysis.status === "FAILED" ? (
                <div className="tone-danger px-3 py-2.5">
                  <p className="text-xs font-medium text-[var(--tone-fg)]">Analysis failed</p>
                  <p className="mt-0.5 text-2xs leading-4 text-text-secondary">
                    {analysis.failureReason ?? "No reason was recorded."}
                  </p>
                </div>
              ) : analysis.status === "RUNNING" ? (
                <p className="px-3 py-2.5 text-2xs text-text-muted">Analysis in progress…</p>
              ) : (
                <>
                  {analysis.summary && (
                    <div className="px-3 py-2.5">
                      <p className="eyebrow mb-1 flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        Summary
                      </p>
                      <p className="text-[13px] leading-6 text-text-secondary">
                        {analysis.summary}
                      </p>
                    </div>
                  )}

                  {analysis.decisions.length > 0 && (
                    <div className="border-t border-line px-3 py-2.5">
                      <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                        <Gavel className="h-3 w-3" />
                        Decisions
                        <Count>{analysis.decisions.length}</Count>
                      </p>
                      <ul className="space-y-2">
                        {analysis.decisions.map((decision, index) => (
                          <li key={index} className="space-y-0.5">
                            <div className="flex items-start gap-1.5">
                              <Badge tone={evidenceMeta[decision.evidence].tone} variant="outline">
                                {evidenceMeta[decision.evidence].label}
                              </Badge>
                              <p className="min-w-0 flex-1 text-2xs leading-5 text-text-secondary">
                                {decision.text}
                              </p>
                            </div>
                            {decision.excerpt && (
                              <p className="pl-1 text-2xs italic leading-4 text-text-faint">
                                “{decision.excerpt}”
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.openQuestions.length > 0 && (
                    <div className="border-t border-line px-3 py-2.5">
                      <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                        <CircleHelp className="h-3 w-3" />
                        Still unresolved
                        <Count>{analysis.openQuestions.length}</Count>
                      </p>
                      <ul className="space-y-1.5">
                        {analysis.openQuestions.map((question, index) => (
                          <li key={index}>
                            <p className="text-2xs leading-5 text-text-secondary">
                              {question.text}
                            </p>
                            {question.excerpt && (
                              <p className="text-2xs italic leading-4 text-text-faint">
                                “{question.excerpt}”
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Proposals */}
            {analysis.proposals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="eyebrow">Proposed tasks</h3>
                  <Count>{analysis.proposals.length}</Count>
                </div>
                {analysis.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    members={members}
                    selected={selected.has(proposal.id)}
                    onSelectedChange={(value) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (value) next.add(proposal.id);
                        else next.delete(proposal.id);
                        return next;
                      })
                    }
                    onResolved={resolve}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
