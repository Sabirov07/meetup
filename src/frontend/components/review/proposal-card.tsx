"use client";

import { AlertTriangle, Check, Quote, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { approveProposal, rejectProposal } from "@/backend/actions/analysis";
import {
  TASK_PRIORITIES,
  type MemberSummary,
  type ProposalView,
  type TaskPriority,
} from "@/shared/domain/types";
import { evidenceMeta } from "@/shared/domain/labels";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Checkbox, Tooltip } from "@/frontend/components/ui/feedback";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Textarea,
} from "@/frontend/components/ui/field";

const UNASSIGNED = "__unassigned__";

/**
 * One proposed task, awaiting a human decision.
 *
 * The design goal is that you can tell at a glance how much of this the model
 * actually heard. Every suggested value carries its evidence level, and the
 * owner field is pre-opened for editing whenever ownership was not confirmed —
 * the decision the model is least able to make is the one it asks about.
 */
export function ProposalCard({
  proposal,
  members,
  selected,
  onSelectedChange,
  onResolved,
}: {
  proposal: ProposalView;
  members: MemberSummary[];
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onResolved: (id: string) => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(proposal.title);
  const [description, setDescription] = useState(proposal.description ?? "");
  const [ownerId, setOwnerId] = useState(proposal.suggestedOwner?.id ?? UNASSIGNED);
  const [priority, setPriority] = useState<TaskPriority>(proposal.suggestedPriority);
  const [dueDate, setDueDate] = useState(proposal.suggestedDueDate ?? "");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [editing, setEditing] = useState(false);

  const ownerUncertain = proposal.ownerEvidence !== "CONFIRMED" || !proposal.suggestedOwner;
  const edited =
    title !== proposal.title ||
    description !== (proposal.description ?? "") ||
    ownerId !== (proposal.suggestedOwner?.id ?? UNASSIGNED) ||
    priority !== proposal.suggestedPriority ||
    dueDate !== (proposal.suggestedDueDate ?? "");

  async function approve() {
    setBusy("approve");
    const result = await approveProposal({
      proposalId: proposal.id,
      title: title.trim(),
      description: description.trim() || null,
      ownerMemberId: ownerId === UNASSIGNED ? null : ownerId,
      priority,
      dueDate: dueDate || null,
    });
    setBusy(null);
    if (!result.ok) {
      toast.error(t("proposal.approveFailed"), { description: result.error });
      return;
    }
    toast.success(t("form.created"), { description: result.data.title });
    onResolved(proposal.id);
  }

  async function reject() {
    setBusy("reject");
    const result = await rejectProposal(proposal.id);
    setBusy(null);
    if (!result.ok) {
      toast.error(t("proposal.rejectFailed"), { description: result.error });
      return;
    }
    toast.success(t("proposal.rejected"));
    onResolved(proposal.id);
  }

  return (
    <article
      className={cn(
        "rounded-xl border bg-surface transition-colors",
        proposal.needsReview ? "border-warning/35" : "border-line",
        selected && "border-line-accent",
      )}
    >
      <div className="flex items-start gap-2.5 px-3 pt-3">
        {onSelectedChange && (
          <span className="pt-1">
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => onSelectedChange(Boolean(value))}
              aria-label={t("proposal.select", { title: proposal.title })}
            />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {proposal.isExplicitCommitment ? (
              <Tooltip content={t("proposal.committedTip")}>
                <span>
                  <Badge tone="tone-success">{t("proposal.committed")}</Badge>
                </span>
              </Tooltip>
            ) : (
              <Tooltip content={t("proposal.inferredTip")}>
                <span>
                  <Badge tone="tone-info">{t("proposal.inferred")}</Badge>
                </span>
              </Tooltip>
            )}

            {proposal.needsReview && (
              <Badge tone="tone-warning">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t("proposal.needsDecision")}
              </Badge>
            )}

            {proposal.isSample && (
              <Tooltip content={t("proposal.sampleTip")}>
                <span>
                  <Badge tone="tone-neutral" variant="outline">
                    {t("meetings.sampleData")}
                  </Badge>
                </span>
              </Tooltip>
            )}

            <Badge tone="tone-neutral">{t(`category.${proposal.category}.label`)}</Badge>
          </div>

          {editing ? (
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 text-[13px] font-medium"
            />
          ) : (
            <h3 className="mt-1.5 text-[13px] font-semibold leading-5 tracking-[-0.01em] text-text">
              {title}
            </h3>
          )}

          {editing ? (
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("proposal.descriptionPlaceholder")}
              className="mt-2 min-h-[56px] text-xs"
            />
          ) : (
            description && (
              <p className="mt-1 text-2xs leading-5 text-text-muted">{description}</p>
            )
          )}
        </div>
      </div>

      {/* Evidence */}
      {proposal.transcriptExcerpt && (
        <blockquote className="mx-3 mt-2.5 border-l-2 border-line-accent pl-2.5">
          <p className="flex gap-1.5 text-2xs italic leading-5 text-text-muted">
            <Quote className="mt-0.5 h-3 w-3 shrink-0" />
            {proposal.transcriptExcerpt}
          </p>
        </blockquote>
      )}

      {/* Suggested values, each with how sure the model is */}
      <div className="mt-3 grid gap-2.5 border-t border-line px-3 py-3 sm:grid-cols-3">
        <SuggestedField
          label={t("tasks.facet.owner")}
          evidence={proposal.ownerEvidence}
          rationale={proposal.ownerRationale}
          highlight={ownerUncertain}
        >
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger size="sm" className="w-full">
              <span className="flex items-center gap-1.5">
                <Avatar
                  member={members.find((m) => m.id === ownerId) ?? null}
                  size="xs"
                />
                {members.find((m) => m.id === ownerId)?.name ?? t("common.unassigned")}
              </span>
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
              <SelectItem value={UNASSIGNED}>{t("common.unassigned")}</SelectItem>
            </SelectContent>
          </Select>
        </SuggestedField>

        <SuggestedField
          label={t("tasks.facet.priority")}
          evidence={proposal.priorityEvidence}
          rationale={proposal.priorityRationale}
        >
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as TaskPriority)}
          >
            <SelectTrigger size="sm" className="w-full">
              {t(`priority.${priority}.label`)}
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`priority.${value}.label`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SuggestedField>

        <SuggestedField
          label={t("tasks.facet.deadline")}
          evidence={proposal.dueDateEvidence}
          rationale={
            proposal.suggestedDueDate ? undefined : t("proposal.noDateMentioned")
          }
        >
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-7 text-xs"
          />
        </SuggestedField>
      </div>

      {(proposal.blockers.length > 0 || proposal.dependsOnTitles.length > 0) && (
        <div className="space-y-1 border-t border-line px-3 py-2.5">
          {proposal.blockers.map((blocker) => (
            <p key={blocker} className="flex items-start gap-1.5 text-2xs leading-4 text-warning">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {blocker}
            </p>
          ))}
          {proposal.dependsOnTitles.length > 0 && (
            <p className="text-2xs leading-4 text-text-muted">
              {t("proposal.waitingOn", { titles: proposal.dependsOnTitles.join(", ") })}
              <span className="text-text-faint">{t("proposal.waitingOnNote")}</span>
            </p>
          )}
        </div>
      )}

      {/* Decision */}
      <div className="flex items-center gap-2 border-t border-line bg-canvas/40 px-3 py-2.5">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void approve()}
          loading={busy === "approve"}
          loadingLabel={t("common.creating")}
        >
          <Check className="h-3 w-3" />
          {t(edited ? "proposal.approveEdited" : "proposal.approve")}
        </Button>

        <Button variant="ghost" size="sm" onClick={() => setEditing((value) => !value)}>
          {t(editing ? "proposal.doneEditing" : "proposal.editText")}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void reject()}
          loading={busy === "reject"}
        >
          <X className="h-3 w-3" />
          {t("proposal.reject")}
        </Button>
      </div>
    </article>
  );
}

function SuggestedField({
  label,
  evidence,
  rationale,
  highlight,
  children,
}: {
  label: string;
  evidence: ProposalView["ownerEvidence"];
  rationale?: string | null;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const meta = evidenceMeta[evidence];

  return (
    <div className={cn("min-w-0 space-y-1", highlight && "rounded-md")}>
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-2xs text-text-muted">{label}</span>
        <Tooltip content={t(`evidence.${evidence}.description`)}>
          <span>
            <Badge tone={meta.tone} variant="outline">
              {t(`evidence.${evidence}.label`)}
            </Badge>
          </span>
        </Tooltip>
      </div>
      {children}
      {rationale && <p className="text-2xs leading-4 text-text-faint">{rationale}</p>}
    </div>
  );
}
