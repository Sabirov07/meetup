"use client";

import {
  Check,
  GitBranch,
  Link2,
  Pencil,
  Plus,
  Quote,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addDependency, removeDependency, updateTask } from "@/backend/actions/tasks";
import {
  NO_SPACE,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskView,
} from "@/shared/domain/types";
import { evidenceMeta, priorityMeta, statusMeta } from "@/shared/domain/labels";
import {
  factorLabel,
  smartScore,
  suggestedPriority,
  unmetDependencies,
} from "@/shared/domain/priority";
import { useI18n, useT, useTx } from "@/frontend/i18n";
import { toDateInputValue } from "@/frontend/i18n/format";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Dot } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Dialog, DialogTitle, SheetContent } from "@/frontend/components/ui/dialog";
import { Separator, Tooltip } from "@/frontend/components/ui/feedback";
import { RelativeTime } from "@/frontend/components/ui/relative-time";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/frontend/components/ui/field";
import { spaceDot } from "@/frontend/components/spaces/space-color";
import { Discussion } from "./discussion";
import { TaskDoc } from "./task-doc";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskSubtasks } from "./task-subtasks";
import { taskLink, useTasks } from "./task-store";

export function TaskDetailSheet() {
  const { tasks, openTaskId, setOpenTaskId } = useTasks();
  const t = useT();
  const task = openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null;

  /**
   * Who owns Escape right now.
   *
   * While the document editor or the subtask composer is open, Escape belongs
   * to it — closing the editor, finishing the run of steps — and the drawer
   * gets the next one. Radix dismisses from a capture-phase listener, so this
   * has to be decided here rather than by stopping the event further down.
   */
  const escapeOwners = useRef(new Set<string>());
  const claimEscape = useCallback((owner: string, claimed: boolean) => {
    if (claimed) escapeOwners.current.add(owner);
    else escapeOwners.current.delete(owner);
  }, []);

  /**
   * A link naming a task this workspace does not have.
   *
   * Usually a link from a workspace the reader is not in, or one sent after
   * the task was deleted. Either way the address bar is making a promise the
   * page cannot keep, so it is corrected and the reason said out loud — an
   * ordinary-looking list with no drawer would read as the link being ignored.
   *
   * Every surface holds the whole workspace list, so a miss here is genuinely
   * "not here" rather than "not on this page".
   */
  const reportedMissing = useRef<string | null>(null);
  useEffect(() => {
    if (!openTaskId || task) return;
    if (reportedMissing.current === openTaskId) return;
    reportedMissing.current = openTaskId;
    toast.error(t("detail.link.notHere"), { description: t("detail.link.notHereWhy") });
    setOpenTaskId(null);
  }, [openTaskId, task, setOpenTaskId, t]);

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && setOpenTaskId(null)}>
      {task && (
        <SheetContent
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (escapeOwners.current.size > 0) event.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">{task.title}</DialogTitle>
          {/* Keyed by task id so opening a different task remounts with
              fresh drafts, instead of resetting them from an effect. */}
          <TaskDetail key={task.id} task={task} claimEscape={claimEscape} />
        </SheetContent>
      )}
    </Dialog>
  );
}

function TaskDetail({
  task,
  claimEscape,
}: {
  task: TaskView;
  /** Tells the drawer that a control inside it has a claim on Escape. */
  claimEscape: (owner: string, claimed: boolean) => void;
}) {
  const { members, spaces, now, move, remove, upsertTask, setOpenTaskId, tasks } = useTasks();
  const { t, f } = useI18n();
  const tx = useTx();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editOpen, setEditOpen] = useState(false);

  const [addingDependency, setAddingDependency] = useState(false);

  // Stable per owner, so the effects downstream that watch these do not
  // re-run on every render of the drawer.
  const docClaimsEscape = useCallback(
    (claims: boolean) => claimEscape("doc", claims),
    [claimEscape],
  );
  const subtasksClaimEscape = useCallback(
    (claims: boolean) => claimEscape("subtasks", claims),
    [claimEscape],
  );

  async function save(change: Parameters<typeof updateTask>[0]) {
    const result = await updateTask(change);
    if (result.ok) upsertTask(result.data);
    else toast.error(t("detail.saveFailed"), { description: result.error });
  }

  const due = f.dueDate(task.dueDate, now);
  const unmet = unmetDependencies(task);
  const activeDependents = task.dependents.filter((d) => d.status !== "COMPLETED");
  const liveSuggestion = suggestedPriority(task, now);
  const factors = smartScore(task, now).factors;

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-3">
        <button
          onClick={() =>
            move(task.id, { status: task.status === "COMPLETED" ? "TODO" : "COMPLETED" })
          }
          aria-label={
            task.status === "COMPLETED" ? t("tasks.row.markTodo") : t("tasks.row.markComplete")
          }
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            task.status === "COMPLETED"
              ? "border-success bg-success text-canvas"
              : "border-line-strong text-transparent hover:border-accent hover:text-accent",
          )}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        </button>

        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <Input
              value={titleDraft}
              autoFocus
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                if (titleDraft.trim() !== task.title && titleDraft.trim().length >= 3) {
                  void save({ id: task.id, title: titleDraft.trim() });
                } else {
                  setTitleDraft(task.title);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setTitleDraft(task.title);
                  setEditingTitle(false);
                }
              }}
              className="h-7 text-sm font-semibold"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="group/title -mx-1 flex w-full items-start gap-1.5 rounded px-1 text-left hover:bg-hover"
            >
              <h2
                className={cn(
                  "text-sm font-semibold leading-5 tracking-[-0.01em]",
                  task.status === "COMPLETED" ? "text-text-muted line-through" : "text-text",
                )}
              >
                {task.title}
              </h2>
              <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-text-faint opacity-0 transition-opacity group-hover/title:opacity-100" />
            </button>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-text-faint">
            <span>
              {tx("detail.createdAgo", { when: <RelativeTime value={task.createdAt} /> })}
            </span>
            {task.creator && (
              <>
                <span aria-hidden>·</span>
                <span>{t("detail.byPerson", { name: task.creator.name })}</span>
              </>
            )}
            {task.completedAt && (
              <>
                <span aria-hidden>·</span>
                <span className="text-success">
                  {tx("detail.completedAgo", {
                    when: <RelativeTime value={task.completedAt} />,
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <CopyLinkButton task={task} />
          <Tooltip content={t("detail.editAllFields")}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={t("detail.editTask")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={t("detail.deleteTask")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("detail.deleteTask")}
              onClick={() => remove(task.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpenTaskId(null)}
            aria-label={t("common.close")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Properties */}
        <div className="space-y-2.5 px-4 py-3.5">
          <Property label={t("detail.property.status")}>
            <Select
              value={task.status}
              onValueChange={(value) => move(task.id, { status: value as TaskView["status"] })}
            >
              <SelectTrigger size="sm" className="w-full">
                <span className="flex items-center gap-1.5">
                  <Dot tone={statusMeta[task.status].tone} />
                  {t(`status.${task.status}.label`)}
                </span>
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}.label`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Property>

          <Property label={t("detail.property.assignee")}>
            <Select
              value={task.owner?.id ?? "UNASSIGNED"}
              onValueChange={(value) =>
                move(task.id, { ownerMemberId: value === "UNASSIGNED" ? null : value })
              }
            >
              <SelectTrigger size="sm" className="w-full">
                <span className="flex items-center gap-1.5">
                  <Avatar member={task.owner} size="xs" />
                  {task.owner?.name ?? t("common.unassigned")}
                </span>
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
                <SelectItem value="UNASSIGNED">{t("common.unassigned")}</SelectItem>
              </SelectContent>
            </Select>
          </Property>

          <Property label={t("detail.property.priority")}>
            <div className="space-y-1.5">
              <Select
                value={task.priority}
                onValueChange={(value) => void save({ id: task.id, priority: value as TaskView["priority"] })}
              >
                <SelectTrigger size="sm" className="w-full">
                  <span className="flex items-center gap-1.5">
                    <Dot tone={priorityMeta[task.priority].tone} />
                    {t(`priority.${task.priority}.label`)}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {t(`priority.${priority}.label`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* An AI or engine suggestion is shown, never applied silently. */}
              {task.aiSuggestedPriority && task.aiSuggestedPriority !== task.priority && (
                <Suggestion
                  text={t("detail.suggested", {
                    value: t(`priority.${task.aiSuggestedPriority}.label`),
                  })}
                  detail={task.aiPriorityRationale}
                  onApply={() => void save({ id: task.id, priority: task.aiSuggestedPriority! })}
                />
              )}
              {!task.aiSuggestedPriority && liveSuggestion && liveSuggestion !== task.priority && (
                <Suggestion
                  text={t("detail.consider", {
                    value: t(`priority.${liveSuggestion}.label`),
                  })}
                  detail={t("detail.considerWhy")}
                  onApply={() => void save({ id: task.id, priority: liveSuggestion })}
                />
              )}
            </div>
          </Property>

          <Property label={t("detail.property.deadline")}>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={toDateInputValue(task.dueDate)}
                onChange={(event) => void save({ id: task.id, dueDate: event.target.value || null })}
                className="h-7 text-xs"
              />
              {task.dueDate && (
                <span
                  className={cn(
                    "shrink-0 text-2xs",
                    due.overdue ? "font-medium text-danger" : "text-text-faint",
                  )}
                >
                  {due.text}
                </span>
              )}
            </div>
          </Property>

          {spaces.length > 0 && (
            <Property label={t("spaces.field")}>
              <Select
                value={task.space?.id ?? NO_SPACE}
                onValueChange={(value) =>
                  void save({ id: task.id, spaceId: value === NO_SPACE ? null : value })
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {task.space && (
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          spaceDot(task.space.colorToken),
                        )}
                      />
                    )}
                    <span className="truncate">{task.space?.name ?? t("spaces.unfiled")}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SPACE}>{t("spaces.unfiled")}</SelectItem>
                  {spaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Property>
          )}

          <Property label={t("detail.property.category")}>
            <Select
              value={task.category}
              onValueChange={(value) => void save({ id: task.id, category: value as TaskView["category"] })}
            >
              <SelectTrigger size="sm" className="w-full">
                {t(`category.${task.category}.label`)}
              </SelectTrigger>
              <SelectContent>
                {TASK_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {t(`category.${category}.label`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Property>

          {task.labels.length > 0 && (
            <Property label={t("detail.property.labels")}>
              <div className="flex flex-wrap gap-1 py-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-[4px] bg-raised px-1.5 py-0.5 text-2xs text-text-muted"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Property>
          )}
        </div>

        <Separator />

        {/* The task's document: rich text, checklists and screenshots. */}
        <TaskDoc task={task} onCapturesEscapeChange={docClaimsEscape} />

        {/* The steps inside it. Under the brief, because that is the order the
            work is read in: what this is, then what it breaks down into. */}
        <Separator />
        <TaskSubtasks task={task} onCapturesEscapeChange={subtasksClaimEscape} />

        {/* Why it ranks where it does */}
        {task.status !== "COMPLETED" && factors.length > 0 && (
          <>
            <Separator />
            <section className="px-4 py-3.5">
              <p className="eyebrow mb-2">{t("detail.ranking.heading")}</p>
              <ul className="space-y-1">
                {factors.map((factor) => (
                  <li key={factor.key} className="flex items-center gap-2 text-2xs">
                    <span
                      className={cn(
                        "w-9 shrink-0 text-right tabular-nums",
                        factor.weight < 0 ? "text-success" : "text-text-faint",
                      )}
                    >
                      {factor.weight < 0 ? "↑" : "↓"} {Math.abs(factor.weight)}
                    </span>
                    <span className="text-text-secondary">{factorLabel(factor, t)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-2xs leading-4 text-text-faint">
                {t("detail.ranking.note")}
              </p>
            </section>
          </>
        )}

        {/* Dependencies */}
        <Separator />
        <section className="px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">{t("detail.dependencies")}</p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setAddingDependency((value) => !value)}
            >
              <Plus className="h-3 w-3" />
              {t("common.add")}
            </Button>
          </div>

          {addingDependency && (
            <DependencyPicker
              task={task}
              candidates={tasks}
              onDone={() => setAddingDependency(false)}
            />
          )}

          {task.dependencies.length === 0 && activeDependents.length === 0 && !addingDependency && (
            <p className="text-2xs text-text-faint">{t("detail.dependencies.empty")}</p>
          )}

          {task.dependencies.length > 0 && (
            <div className="space-y-1">
              <p className="text-2xs text-text-muted">{t("detail.dependencies.waitingOn")}</p>
              {task.dependencies.map((dependency) => (
                <div
                  key={dependency.id}
                  className="flex items-center gap-2 rounded-md bg-raised px-2 py-1.5"
                >
                  <Dot tone={statusMeta[dependency.status].tone} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-2xs",
                      dependency.status === "COMPLETED"
                        ? "text-text-faint line-through"
                        : "text-text-secondary",
                    )}
                  >
                    {dependency.title}
                  </span>
                  <button
                    onClick={() =>
                      void removeDependency({
                        taskId: task.id,
                        dependsOnTaskId: dependency.id,
                      }).then((result) => {
                        if (result.ok) upsertTask(result.data);
                      })
                    }
                    aria-label={t("detail.dependencies.unlink", { title: dependency.title })}
                    className="shrink-0 rounded p-0.5 text-text-faint hover:text-danger"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {unmet.length > 0 && (
                <p className="pt-0.5 text-2xs text-warning">
                  {t("detail.dependencies.unfinished", { count: unmet.length })}
                </p>
              )}
            </div>
          )}

          {activeDependents.length > 0 && (
            <div className="mt-2.5 space-y-1">
              <p className="flex items-center gap-1 text-2xs text-text-muted">
                <GitBranch className="h-3 w-3" />
                {t("detail.dependencies.blocking")}
              </p>
              {activeDependents.map((dependent) => (
                <div
                  key={dependent.id}
                  className="flex items-center gap-2 rounded-md bg-raised px-2 py-1.5"
                >
                  <Dot tone={statusMeta[dependent.status].tone} />
                  <span className="min-w-0 flex-1 truncate text-2xs text-text-secondary">
                    {dependent.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Where it came from */}
        {(task.sourceMeeting || task.sourceExcerpt) && (
          <>
            <Separator />
            <section className="px-4 py-3.5">
              <p className="eyebrow mb-2">{t("detail.source.heading")}</p>
              {task.sourceMeeting && (
                <Link
                  href={`/meetings/${task.sourceMeeting.id}`}
                  className="flex items-center gap-1.5 text-2xs text-accent-bright hover:underline"
                >
                  <Link2 className="h-3 w-3" />
                  {task.sourceMeeting.title}
                </Link>
              )}
              {task.sourceExcerpt && (
                <blockquote className="mt-2 border-l-2 border-line-accent pl-2.5">
                  <p className="flex gap-1.5 text-2xs italic leading-5 text-text-muted">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                    {task.sourceExcerpt}
                  </p>
                </blockquote>
              )}
              {task.isAiGenerated && (
                <p className="mt-2 flex items-center gap-1.5 text-2xs text-text-faint">
                  <Sparkles className="h-3 w-3" />
                  {t(
                    task.confirmedByHuman
                      ? "detail.source.proposedConfirmed"
                      : "detail.source.proposed",
                  )}
                </p>
              )}
            </section>
          </>
        )}

        {/* The conversation on this task */}
        <Separator />
        <Discussion task={task} />

        <div className="px-4 pb-5 pt-1 text-2xs text-text-faint">
          {t("detail.lastUpdated", { when: f.dateTime(task.updatedAt, now) })}
        </div>
      </div>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        members={members}
        spaces={spaces}
        task={task}
        onSaved={upsertTask}
      />
    </>
  );
}

/**
 * Copies a link that opens this task for anyone in the workspace.
 *
 * The clipboard needs a secure context, which localhost and HTTPS both are —
 * but it can still be refused by permission policy, so a failure falls back to
 * showing the address rather than leaving the click with nothing to show for
 * it.
 */
function CopyLinkButton({ task }: { task: TaskView }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    const url = new URL(taskLink(task.id), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.message(t("detail.link.copyFailed"), { description: url });
    }
  }

  return (
    <Tooltip content={t(copied ? "detail.link.copied" : "detail.link.copy")}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("detail.link.copy")}
        onClick={() => void copy()}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </Tooltip>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
      <span className="text-2xs text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function Suggestion({
  text,
  detail,
  onApply,
}: {
  text: string;
  detail?: string | null;
  onApply: () => void;
}) {
  const t = useT();

  return (
    <div className="tone-accent rounded-md bg-[var(--tone-bg)] px-2 py-1.5">
      <div className="flex items-start gap-1.5">
        <Sparkles className="mt-px h-3 w-3 shrink-0 text-[var(--tone-fg)]" />
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-medium text-[var(--tone-fg)]">{text}</p>
          {detail && <p className="mt-0.5 text-2xs leading-4 text-text-muted">{detail}</p>}
        </div>
        <button
          onClick={onApply}
          className="shrink-0 rounded-[4px] bg-accent-solid px-1.5 py-0.5 text-2xs font-medium text-white hover:bg-accent-solid-hover"
        >
          {t("detail.apply")}
        </button>
      </div>
    </div>
  );
}

function DependencyPicker({
  task,
  candidates,
  onDone,
}: {
  task: TaskView;
  candidates: TaskView[];
  onDone: () => void;
}) {
  const { upsertTask } = useTasks();
  const t = useT();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);

  const existing = new Set(task.dependencies.map((d) => d.id));
  const matches = candidates
    .filter(
      (candidate) =>
        candidate.id !== task.id &&
        !existing.has(candidate.id) &&
        candidate.title.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 6);

  return (
    <div className="mb-2 space-y-1.5 rounded-md border border-line-strong bg-canvas p-2">
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("detail.dependencies.find")}
        className="h-7 text-xs"
      />
      {matches.length === 0 ? (
        <p className="px-1 py-1 text-2xs text-text-faint">{t("detail.dependencies.noMatch")}</p>
      ) : (
        matches.map((candidate) => (
          <button
            key={candidate.id}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const result = await addDependency({
                taskId: task.id,
                dependsOnTaskId: candidate.id,
              });
              setPending(false);
              if (result.ok) {
                upsertTask(result.data);
                onDone();
              } else {
                toast.error(t("detail.dependencies.linkFailed"), { description: result.error });
              }
            }}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-hover disabled:opacity-50"
          >
            <Dot tone={statusMeta[candidate.status].tone} />
            <span className="min-w-0 flex-1 truncate text-2xs text-text-secondary">
              {candidate.title}
            </span>
          </button>
        ))
      )}
      <button onClick={onDone} className="px-1 text-2xs text-text-faint hover:text-text">
        {t("common.cancel")}
      </button>
    </div>
  );
}

/** Small helper used by the review page to show evidence level consistently. */
export function EvidenceBadge({ level }: { level: keyof typeof evidenceMeta }) {
  const t = useT();
  const meta = evidenceMeta[level];

  return (
    <Tooltip content={t(`evidence.${level}.description`)}>
      <span>
        <Badge tone={meta.tone} variant="outline">
          {t(`evidence.${level}.label`)}
        </Badge>
      </span>
    </Tooltip>
  );
}
