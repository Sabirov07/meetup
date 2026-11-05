"use client";

import {
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addComment,
  answerWithAi,
  deleteComment,
  fetchComments,
  updateComment,
} from "@/backend/actions/tasks";
import type { CommentView } from "@/backend/data/tasks";
import { splitMentions } from "@/shared/domain/mentions";
import { hasAdvice, hasSketch, type Advice, type Effort } from "@/shared/domain/sketch";
import type { MemberSummary, TaskView } from "@/shared/domain/types";
import { useI18n } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge, Count } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/frontend/components/ui/menu";
import { RelativeTime } from "@/frontend/components/ui/relative-time";
import { DocContent } from "@/frontend/components/doc/doc-content";
import { SketchView } from "./discussion-sketch";
import { MentionInput } from "./mention-input";
import { useTasks } from "./task-store";

/**
 * The conversation on a task.
 *
 * Three things make this more than a note field: people can address each other
 * by name, they can address the assistant the same way, and the assistant's
 * reply is a message in the thread rather than a panel beside it. That last
 * part is the design decision worth defending — advice that lives in the
 * conversation gets argued with, and advice that lives in its own box gets
 * ignored.
 *
 * Posting and answering are two round-trips on purpose. A model answer takes
 * most of a minute; holding someone's own message behind it would make the
 * thread feel broken every time the assistant is asked anything. So the message
 * appears immediately, the assistant's seat fills with a thinking row, and a
 * failure to answer costs the answer rather than what they wrote.
 */
export function Discussion({ task }: { task: TaskView }) {
  const { members, currentMemberId, upsertTask } = useTasks();
  const { t } = useI18n();

  const [comments, setComments] = useState<CommentView[] | null>(null);
  /**
   * Why the thread could not be read.
   *
   * Kept apart from an empty thread rather than folded into it. A failed load
   * that renders as "nothing here yet" is the worst kind of bug: it looks like
   * an answer, so nobody reports it, and the person concludes their colleague
   * never replied.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, startPosting] = useTransition();
  /** The message the assistant is currently answering. */
  const [answering, setAnswering] = useState<string | null>(null);
  /** A question whose answer failed, so it can be asked again. */
  const [failed, setFailed] = useState<string | null>(null);
  /** The message being rewritten in place, if any. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** The message whose deletion is waiting for a confirmation. */
  const [deleting, setDeleting] = useState<CommentView | null>(null);
  const [removing, setRemoving] = useState(false);

  // Not part of the task list payload, so the thread loads when the drawer
  // opens. The component is keyed by task id upstream, so this starts as null.
  const [reloads, setReloads] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void fetchComments(task.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setComments(result.data);
      else setLoadError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, reloads]);

  const endRef = useRef<HTMLDivElement>(null);
  const count = comments?.length ?? task.commentCount;

  function sync(next: CommentView[]) {
    setComments(next);
    upsertTask({ ...task, commentCount: next.length });
  }

  /** Runs the model call, and leaves a retry behind when it does not land. */
  function requestAnswer(commentId: string) {
    setAnswering(commentId);
    setFailed(null);
    void answerWithAi({ taskId: task.id, commentId })
      .then((result) => {
        if (result.ok) sync(result.data);
        else {
          setFailed(commentId);
          toast.error(t("discussion.ai.failed"), { description: result.error });
        }
      })
      .finally(() => setAnswering(null));
  }

  function send() {
    const body = draft.trim();
    if (!body) return;
    startPosting(async () => {
      const result = await addComment({ taskId: task.id, body });
      if (!result.ok) {
        toast.error(t("discussion.sendFailed"), { description: result.error });
        return;
      }
      sync(result.data.comments);
      setDraft("");
      // The thread grew; keep the newest message in view.
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
      if (result.data.awaitingAiFor) requestAnswer(result.data.awaitingAiFor);
    });
  }

  async function saveEdit(commentId: string, body: string): Promise<boolean> {
    const result = await updateComment({ taskId: task.id, commentId, body });
    if (!result.ok) {
      toast.error(t("discussion.editFailed"), { description: result.error });
      return false;
    }
    sync(result.data);
    setEditingId(null);
    return true;
  }

  async function confirmDelete() {
    if (!deleting || removing) return;
    setRemoving(true);
    const result = await deleteComment({ taskId: task.id, commentId: deleting.id });
    setRemoving(false);
    if (!result.ok) {
      toast.error(t("discussion.delete.failed"), { description: result.error });
      return;
    }
    sync(result.data);
    setDeleting(null);
    toast.success(t("discussion.deleted"));
  }

  /**
   * Who may act on a message: its author, or — for the assistant's answer —
   * whoever asked. The server checks the same thing and also lets an
   * administrator through; the client only decides whether to draw the menu.
   */
  function ownerOf(comment: CommentView): string | null {
    if (comment.kind !== "AI_ANSWER") return comment.author?.id ?? null;
    const question = comments?.find((item) => item.id === comment.answersId);
    return question?.author?.id ?? null;
  }

  const deletingHasAnswer =
    deleting !== null && (comments?.some((item) => item.answersId === deleting.id) ?? false);

  return (
    <section className="px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-1.5">
        <p className="eyebrow flex items-center gap-1.5">
          <MessagesSquare className="h-3 w-3" />
          {t("discussion.heading")}
        </p>
        {count > 0 && <Count>{count}</Count>}
      </div>

      {loadError !== null ? (
        <div className="flex items-start justify-between gap-2 rounded-md border border-line bg-canvas px-2 py-1.5">
          <div className="min-w-0">
            <p className="text-2xs text-text">{t("discussion.loadFailed")}</p>
            <p className="mt-0.5 text-2xs leading-4 text-text-muted">{loadError}</p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0"
            onClick={() => {
              setComments(null);
              setLoadError(null);
              setReloads((value) => value + 1);
            }}
          >
            <RefreshCw className="h-3 w-3" />
            {t("common.retry")}
          </Button>
        </div>
      ) : comments === null ? (
        <div className="flex items-center gap-2 text-2xs text-text-faint">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("discussion.loading")}
        </div>
      ) : (
        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="text-2xs leading-5 text-text-faint">{t("discussion.empty")}</p>
          )}

          {comments.map((comment) => (
            <Fragment key={comment.id}>
              <Message
                comment={comment}
                members={members}
                mine={ownerOf(comment) === currentMemberId}
                editing={editingId === comment.id}
                onEdit={() => setEditingId(comment.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(body) => saveEdit(comment.id, body)}
                onDelete={() => setDeleting(comment)}
              />
              {answering === comment.id && <Thinking />}
              {failed === comment.id && (
                <RetryRow onRetry={() => requestAnswer(comment.id)} />
              )}
            </Fragment>
          ))}

          <div ref={endRef} />

          <div className="pt-0.5">
            <MentionInput
              value={draft}
              onChange={setDraft}
              members={members}
              disabled={posting}
              placeholder={t("discussion.placeholder")}
              onSubmit={send}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-2xs text-text-faint">{t("discussion.shortcut")}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={!draft.trim()}
                loading={posting}
                onClick={send}
              >
                {t("discussion.send")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !removing && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("discussion.delete.title")}</DialogTitle>
            <DialogDescription>
              {t("discussion.delete.body")}
              {deletingHasAnswer && <> {t("discussion.delete.withAnswer")}</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={removing}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={removing}
              loadingLabel={t("common.saving")}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Message({
  comment,
  members,
  mine,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  comment: CommentView;
  members: MemberSummary[];
  /** Whether the viewer may change or remove this message. */
  mine: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (body: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const isAi = comment.kind === "AI_ANSWER";

  return (
    <article
      className={cn("group flex gap-2", isAi && "rounded-lg bg-raised/60 p-2 -mx-0.5")}
    >
      {isAi ? (
        <span
          aria-hidden
          className="tone-accent mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tone-bg)]"
        >
          <Sparkles className="h-3 w-3 text-[var(--tone-fg)]" />
        </span>
      ) : (
        <Avatar
          member={
            comment.author
              ? {
                  name: comment.author.name,
                  initials: comment.author.initials,
                  accentToken: comment.author.accentToken,
                }
              : null
          }
          size="md"
          className="mt-0.5"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-2xs font-medium text-text">
            {isAi ? t("discussion.ai.name") : (comment.author?.name ?? t("activity.someone"))}
          </span>
          <span className="text-2xs text-text-faint">
            <RelativeTime value={comment.createdAt} />
          </span>
          {comment.editedAt && (
            <span className="text-2xs text-text-faint" title={comment.editedAt}>
              · {t("discussion.edited")}
            </span>
          )}

          {mine && !editing && (
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("discussion.messageMenu")}
                  className="ml-auto -my-1 rounded-md p-1 text-text-faint opacity-0 transition hover:bg-raised hover:text-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                {!isAi && (
                  <MenuItem onSelect={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    {t("discussion.edit")}
                  </MenuItem>
                )}
                <MenuItem destructive onSelect={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("common.delete")}
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
        </p>

        {/* The assistant writes Markdown; a person writes text with mentions. */}
        {isAi ? (
          <div className="mt-1">
            <DocContent markdown={comment.body} className="text-[13px]" />
          </div>
        ) : editing ? (
          <EditForm
            initial={comment.body}
            members={members}
            onCancel={onCancelEdit}
            onSave={onSave}
          />
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-2xs leading-5 text-text-secondary">
            <MentionText body={comment.body} members={members} />
          </p>
        )}

        {isAi && hasAdvice(comment.advice) && (
          <div className="mt-2.5 space-y-2.5">
            <AdviceBody advice={comment.advice} />
          </div>
        )}

        {isAi && (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-text-faint">
            <span>{t("discussion.ai.disclaimer")}</span>
            {comment.model && (
              <>
                <span aria-hidden>·</span>
                <span>{t("discussion.ai.model", { model: comment.model })}</span>
              </>
            )}
          </p>
        )}
      </div>
    </article>
  );
}

/** Rewrites a message in place, with the same mention picker as the composer. */
function EditForm({
  initial,
  members,
  onCancel,
  onSave,
}: {
  initial: string;
  members: MemberSummary[];
  onCancel: () => void;
  onSave: (body: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  const [saving, startSaving] = useTransition();
  const changed = draft.trim() !== initial.trim() && draft.trim().length > 0;

  function save() {
    if (!changed || saving) return;
    startSaving(async () => {
      await onSave(draft.trim());
    });
  }

  return (
    <div
      className="mt-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <MentionInput
        value={draft}
        onChange={setDraft}
        members={members}
        disabled={saving}
        onSubmit={save}
        autoFocus
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-2xs text-text-faint">{t("discussion.editHint")}</span>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button size="xs" variant="secondary" disabled={!changed} loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Highlights the spans the backend resolved as mentions, from the same scan. */
function MentionText({ body, members }: { body: string; members: MemberSummary[] }) {
  const segments = splitMentions(body, members);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "text") return <Fragment key={index}>{segment.value}</Fragment>;

        const known =
          segment.kind === "member"
            ? members.some((member) => member.id === segment.memberId)
            : true;

        return (
          <span
            key={index}
            className={cn(
              "rounded-[3px] px-0.5 font-medium",
              segment.kind === "ai"
                ? "bg-accent-dim text-accent-bright"
                : known
                  ? "bg-accent-dim/70 text-text"
                  : "text-text-secondary",
            )}
          >
            @{segment.handle}
          </span>
        );
      })}
    </>
  );
}

const effortTone: Record<Effort, string> = {
  SMALL: "tone-success",
  MEDIUM: "tone-info",
  LARGE: "tone-warning",
};

function AdviceBody({ advice }: { advice: Advice }) {
  const { t } = useI18n();

  return (
    <>
      {advice.recommendations.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5 flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3" />
            {t("discussion.advice.recommendations")}
          </p>
          <ol className="space-y-1.5">
            {advice.recommendations.map((item, index) => (
              <li
                key={index}
                className="rounded-md border border-line bg-canvas px-2 py-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-2xs font-medium leading-4 text-text">
                    {item.title}
                  </p>
                  <Badge tone={effortTone[item.effort]} variant="soft">
                    {t(`effort.${item.effort}.label`)}
                  </Badge>
                </div>
                {item.detail && (
                  <p className="mt-1 text-2xs leading-4 text-text-secondary">{item.detail}</p>
                )}
                {item.tradeoff && (
                  <p className="mt-1 text-2xs leading-4 text-text-muted">
                    {t("discussion.advice.tradeoff", { text: item.tradeoff })}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {hasSketch(advice.sketch) && <SketchView sketch={advice.sketch} />}

      {advice.risks.length > 0 && (
        <PointList
          icon={<AlertTriangle className="h-3 w-3" />}
          heading={t("discussion.advice.risks")}
          items={advice.risks}
          tone="text-warning"
        />
      )}

      {advice.openQuestions.length > 0 && (
        <PointList
          icon={<HelpCircle className="h-3 w-3" />}
          heading={t("discussion.advice.questions")}
          items={advice.openQuestions}
          tone="text-text-faint"
        />
      )}
    </>
  );
}

function PointList({
  icon,
  heading,
  items,
  tone,
}: {
  icon: React.ReactNode;
  heading: string;
  items: string[];
  tone: string;
}) {
  return (
    <div>
      <p className="eyebrow mb-1 flex items-center gap-1.5">
        {icon}
        {heading}
      </p>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className="flex gap-1.5 text-2xs leading-4 text-text-secondary">
            <span className={cn("mt-1 h-1 w-1 shrink-0 rounded-full bg-current", tone)} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The assistant's seat in the thread while it reads. */
function Thinking() {
  const { t } = useI18n();

  return (
    <div className="-mx-0.5 flex gap-2 rounded-lg bg-raised/60 p-2">
      <span
        aria-hidden
        className="tone-accent mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tone-bg)]"
      >
        <Sparkles className="h-3 w-3 animate-pulse text-[var(--tone-fg)]" />
      </span>
      <div className="min-w-0 flex-1" role="status">
        <p className="text-2xs font-medium text-text">{t("discussion.ai.name")}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("discussion.ai.thinking")}
        </p>
        <p className="mt-0.5 text-2xs text-text-faint">{t("discussion.ai.thinkingNote")}</p>
      </div>
    </div>
  );
}

function RetryRow({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-canvas px-2 py-1.5">
      <p className="text-2xs text-text-muted">{t("discussion.ai.failed")}</p>
      <Button variant="ghost" size="xs" onClick={onRetry}>
        <RefreshCw className="h-3 w-3" />
        {t("discussion.ai.retry")}
      </Button>
    </div>
  );
}
