"use client";

import { AlertTriangle, ArrowLeft, Check, Quote, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createTasksFromDrafts,
  draftTasksFromBrief,
  type DraftToCreate,
} from "@/backend/actions/intake";
import { MAX_BRIEF_LENGTH, MIN_BRIEF_LENGTH } from "@/shared/domain/intake";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type MemberSummary,
  type TaskBreakdown,
  type TaskCategory,
  type TaskDraft,
  type TaskPriority,
} from "@/shared/domain/types";
import { evidenceMeta } from "@/shared/domain/labels";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { CreateModeSwitch } from "./create-mode-switch";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Checkbox, Tooltip } from "@/frontend/components/ui/feedback";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Textarea,
} from "@/frontend/components/ui/field";

const UNASSIGNED = "__unassigned__";

/**
 * Describe the work in prose, get it back as tasks with an owner each.
 *
 * Two steps, and the second one is the point. Writing the text is easy; the
 * part that decides whether this feature is trustworthy is what happens
 * between the model answering and anything being saved. So the review step
 * leads with what the model was unsure about, shows the quote from your own
 * text behind every task, and lets a row be fixed or dropped in place. Nothing
 * reaches the database until the button at the bottom is pressed, and that
 * button always says how many tasks it is about to create.
 */
export function TaskIntakeDialog({
  open,
  onOpenChange,
  members,
  aiConfigured,
  /** Opens the plain create form instead, for someone who wants the fields. */
  onSwitchToForm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberSummary[];
  aiConfigured: boolean;
  onSwitchToForm?: () => void;
}) {
  const t = useT();
  const router = useRouter();

  const [brief, setBrief] = useState("");
  const [reading, setReading] = useState(false);
  const [breakdown, setBreakdown] = useState<TaskBreakdown | null>(null);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // A reused instance must never show the previous brief's answer.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setBrief("");
      setBreakdown(null);
      setDrafts([]);
      setExcluded(new Set());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open]);

  const selected = useMemo(
    () => drafts.filter((draft) => !excluded.has(draft.key)),
    [drafts, excluded],
  );
  const needsYou = useMemo(
    () => selected.filter((draft) => draft.needsReview).length,
    [selected],
  );

  /** Who ends up with what, so an uneven split is visible before saving. */
  const spread = useMemo(() => {
    const counts = new Map<string, number>();
    for (const draft of selected) {
      const key = draft.ownerMemberId ?? UNASSIGNED;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        count,
        name:
          id === UNASSIGNED
            ? t("common.unassigned")
            : (members.find((m) => m.id === id)?.name ?? t("common.unassigned")),
        member: members.find((m) => m.id === id) ?? null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [selected, members, t]);

  async function read() {
    setReading(true);
    const result = await draftTasksFromBrief(brief);
    setReading(false);

    if (!result.ok) {
      toast.error(t("intake.failed"), { description: result.error });
      return;
    }
    setBreakdown(result.data);
    setDrafts(result.data.drafts);
    setExcluded(new Set());
  }

  async function create() {
    if (selected.length === 0) return;
    setCreating(true);
    const payload: DraftToCreate[] = selected.map((draft) => ({
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      ownerMemberId: draft.ownerMemberId,
      priority: draft.priority,
      category: draft.category,
      labels: draft.labels,
      dueDate: draft.dueDate,
      estimateMinutes: draft.estimateMinutes,
      aiPriority: draft.priority,
      priorityRationale: draft.priorityRationale,
      sourceExcerpt: draft.sourceExcerpt,
      ownerEvidence: draft.ownerEvidence,
    }));

    const result = await createTasksFromDrafts(payload);
    setCreating(false);

    if (!result.ok) {
      toast.error(t("intake.createFailed"), { description: result.error });
      return;
    }

    toast.success(t("intake.created", { count: result.data.created }), {
      description: result.data.firstTitle,
    });
    // The dialog lives in the shell, above any task store, so the boards below
    // only learn about these tasks from the router.
    router.refresh();
    onOpenChange(false);
  }

  function patch(key: string, changes: Partial<TaskDraft>) {
    setDrafts((previous) =>
      previous.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );
  }

  function toggle(key: string, include: boolean) {
    setExcluded((previous) => {
      const next = new Set(previous);
      if (include) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const tooShort = brief.trim().length < MIN_BRIEF_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          {!breakdown && onSwitchToForm && (
            <CreateModeSwitch
              value="DESCRIBE"
              onChange={(mode) => {
                if (mode === "DESCRIBE") return;
                onOpenChange(false);
                onSwitchToForm();
              }}
              className="mb-3 w-fit"
            />
          )}
          <DialogTitle className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent-bright" />
            {t(breakdown ? "intake.review.title" : "intake.title")}
          </DialogTitle>
          <DialogDescription>
            {t(breakdown ? "intake.review.description" : "intake.description")}
          </DialogDescription>
        </DialogHeader>

        {breakdown ? (
          <>
            <DialogBody className="space-y-3">
              {/* What it understood, and how the work landed */}
              <div className="rounded-lg border border-line bg-canvas/40 p-3">
                <p className="eyebrow">{t("intake.review.summaryLabel")}</p>
                <p className="mt-1.5 text-xs leading-5 text-text-secondary">
                  {breakdown.summary}
                </p>

                {spread.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-2.5">
                    <span className="eyebrow">{t("intake.review.spread")}</span>
                    {spread.map((entry) => (
                      <span key={entry.name} className="flex items-center gap-1.5">
                        <Avatar member={entry.member} size="xs" />
                        <span className="text-2xs text-text-secondary">
                          {entry.name}
                        </span>
                        <span className="tnum text-2xs text-text-faint">{entry.count}</span>
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-2.5 flex items-center gap-1.5 text-2xs text-text-muted">
                  {needsYou > 0 ? (
                    <>
                      <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
                      {t("intake.review.needsYou", { count: needsYou })}
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 shrink-0 text-success" />
                      {t("intake.review.allClear")}
                    </>
                  )}
                </p>
              </div>

              {/* Uncertain tasks first: the decisions a person is here to make */}
              {[...drafts]
                .sort((a, b) => Number(b.needsReview) - Number(a.needsReview))
                .map((draft) => (
                  <DraftCard
                    key={draft.key}
                    draft={draft}
                    members={members}
                    included={!excluded.has(draft.key)}
                    onIncludedChange={(include) => toggle(draft.key, include)}
                    onChange={(changes) => patch(draft.key, changes)}
                  />
                ))}

              {breakdown.leftovers.length > 0 && (
                <div className="rounded-lg border border-dashed border-line p-3">
                  <p className="eyebrow">{t("intake.review.leftovers")}</p>
                  <ul className="mt-1.5 space-y-1">
                    {breakdown.leftovers.map((entry) => (
                      <li key={entry} className="text-2xs leading-5 text-text-muted">
                        · {entry}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-2xs text-text-faint">
                    {t("intake.review.leftoversHint")}
                  </p>
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setBreakdown(null);
                  setDrafts([]);
                  setExcluded(new Set());
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("intake.review.back")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void create()}
                disabled={selected.length === 0}
                loading={creating}
                loadingLabel={t("common.creating")}
              >
                <Check className="h-3.5 w-3.5" />
                {selected.length === 0
                  ? t("intake.review.createNone")
                  : t("intake.review.create", { count: selected.length })}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="space-y-3">
              <Field
                label={t("intake.field.brief")}
                htmlFor="intake-brief"
                hint={t("intake.field.briefHint", {
                  count: brief.length,
                  max: MAX_BRIEF_LENGTH,
                })}
              >
                <Textarea
                  id="intake-brief"
                  autoFocus
                  value={brief}
                  maxLength={MAX_BRIEF_LENGTH}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder={t("intake.field.briefPlaceholder")}
                  className="min-h-[13rem] leading-6"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xs text-text-faint">
                  {t("intake.roster", { count: members.length })}
                </span>
                {members.map((member) => (
                  <Tooltip
                    key={member.id}
                    content={member.jobTitle ?? member.name}
                  >
                    <span className="flex items-center gap-1 rounded-full border border-line bg-raised py-px pl-px pr-1.5">
                      <Avatar member={member} size="xs" />
                      <span className="text-2xs text-text-secondary">
                        {member.name.split(" ")[0]}
                      </span>
                    </span>
                  </Tooltip>
                ))}
              </div>

              {!aiConfigured && (
                <p className="tone-warning flex items-start gap-1.5 rounded-md bg-[var(--tone-bg)] px-2.5 py-2 text-2xs leading-5 text-[var(--tone-fg)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {t("intake.needsKey")}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void read()}
                disabled={tooShort || !aiConfigured}
                loading={reading}
                loadingLabel={t("intake.reading")}
              >
                <Wand2 className="h-3.5 w-3.5" />
                {t("intake.submit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * One drafted task, awaiting a decision.
 *
 * Owner, priority and date are always editable controls rather than text: the
 * three things most likely to be wrong should take one click to fix, not a
 * trip into an edit mode. The title and description do hide behind "Edit
 * text", because rewriting prose is the rarer case and twelve textareas in a
 * row is unreadable.
 */
function DraftCard({
  draft,
  members,
  included,
  onIncludedChange,
  onChange,
}: {
  draft: TaskDraft;
  members: MemberSummary[];
  included: boolean;
  onIncludedChange: (included: boolean) => void;
  onChange: (changes: Partial<TaskDraft>) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const owner = members.find((m) => m.id === draft.ownerMemberId) ?? null;
  const evidence = evidenceMeta[draft.ownerEvidence];

  return (
    <article
      className={cn(
        "rounded-xl border bg-surface transition-opacity",
        draft.needsReview ? "border-warning/35" : "border-line",
        !included && "opacity-55",
      )}
    >
      <div className="flex items-start gap-2.5 px-3 pt-3">
        <span className="pt-1">
          <Checkbox
            checked={included}
            onCheckedChange={(value) => onIncludedChange(Boolean(value))}
            aria-label={t("intake.review.include", { title: draft.title })}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tooltip content={t(`evidence.${draft.ownerEvidence}.description`)}>
              <span>
                <Badge tone={evidence.tone} variant="outline">
                  {t(`evidence.${draft.ownerEvidence}.label`)}
                </Badge>
              </span>
            </Tooltip>
            {draft.needsReview && (
              <Badge tone="tone-warning">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t("intake.draft.needsYou")}
              </Badge>
            )}
            <Badge tone="tone-neutral">{t(`category.${draft.category}.label`)}</Badge>
            {draft.estimateMinutes != null && (
              <span className="text-2xs text-text-faint">
                {t("intake.draft.estimate", {
                  hours: Math.round((draft.estimateMinutes / 60) * 10) / 10,
                })}
              </span>
            )}
            {!included && (
              <span className="text-2xs text-text-faint">
                {t("intake.review.excluded")}
              </span>
            )}
          </div>

          {editing ? (
            <Input
              value={draft.title}
              aria-label={t("intake.draft.titleLabel")}
              onChange={(event) => onChange({ title: event.target.value })}
              className="mt-2 text-[13px] font-medium"
            />
          ) : (
            <h3 className="mt-1.5 text-[13px] font-semibold leading-5 tracking-[-0.01em] text-text">
              {draft.title}
            </h3>
          )}

          {editing ? (
            <Textarea
              value={draft.description ?? ""}
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder={t("intake.draft.descriptionPlaceholder")}
              className="mt-2 min-h-[56px] text-xs"
            />
          ) : (
            draft.description && (
              <p className="mt-1 text-2xs leading-5 text-text-muted">{draft.description}</p>
            )
          )}
        </div>
      </div>

      {draft.sourceExcerpt && (
        <blockquote className="mx-3 mt-2.5 border-l-2 border-line-accent pl-2.5">
          <p className="flex gap-1.5 text-2xs italic leading-5 text-text-muted">
            <Quote className="mt-0.5 h-3 w-3 shrink-0" />
            {draft.sourceExcerpt}
          </p>
        </blockquote>
      )}

      <div className="mt-3 grid gap-2.5 border-t border-line px-3 py-3 sm:grid-cols-3">
        <Field label={t("tasks.facet.assignee")} className="space-y-1">
          <Select
            value={draft.ownerMemberId ?? UNASSIGNED}
            onValueChange={(value) =>
              onChange({ ownerMemberId: value === UNASSIGNED ? null : value })
            }
          >
            <SelectTrigger size="sm" className="w-full">
              <span className="flex items-center gap-1.5">
                <Avatar member={owner} size="xs" />
                {owner?.name ?? t("common.unassigned")}
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
        </Field>

        <Field label={t("tasks.facet.priority")} className="space-y-1">
          <Select
            value={draft.priority}
            onValueChange={(value) => onChange({ priority: value as TaskPriority })}
          >
            <SelectTrigger size="sm" className="w-full">
              {t(`priority.${draft.priority}.label`)}
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`priority.${value}.label`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t("tasks.facet.deadline")}
          hint={draft.dueDate ? undefined : t("intake.draft.noDeadline")}
          className="space-y-1"
        >
          <Input
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(event) => onChange({ dueDate: event.target.value || null })}
            className="h-7 text-xs"
          />
        </Field>
      </div>

      {(draft.ownerRationale || draft.openQuestion) && (
        <div className="space-y-1 border-t border-line px-3 py-2.5">
          {draft.ownerRationale && (
            <p className="text-2xs leading-4 text-text-faint">
              <span className="text-text-muted">{t("intake.draft.whyThisPerson")}: </span>
              {draft.ownerRationale}
            </p>
          )}
          {draft.openQuestion && (
            <p className="flex items-start gap-1.5 text-2xs leading-4 text-warning">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                <span className="font-medium">{t("intake.draft.question")}: </span>
                {draft.openQuestion}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line bg-canvas/40 px-3 py-2">
        <Select
          value={draft.category}
          onValueChange={(value) => onChange({ category: value as TaskCategory })}
        >
          <SelectTrigger size="sm" className="w-auto min-w-[9rem]">
            {t(`category.${draft.category}.label`)}
          </SelectTrigger>
          <SelectContent>
            {TASK_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`category.${value}.label`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setEditing((value) => !value)}
        >
          {t(editing ? "intake.draft.doneEditing" : "intake.draft.edit")}
        </Button>
      </div>
    </article>
  );
}
