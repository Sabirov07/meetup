"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { isAiConfigured } from "@/backend/ai/client";
import { breakDownBrief } from "@/backend/ai/breakdown";
import { MAX_BRIEF_LENGTH, MIN_BRIEF_LENGTH } from "@/shared/domain/intake";
import {
  EVIDENCE_LEVELS,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type TaskBreakdown,
  type TaskDraft,
} from "@/shared/domain/types";
import { message } from "@/backend/i18n/message";
import type { TranslationKey } from "@/shared/i18n";
import { fail, guarded, logActivity, ok, parseDateInput, type ActionResult } from "./shared";

/**
 * Free-text intake.
 *
 * Two actions, deliberately separate. `draftTasksFromBrief` reads the text and
 * writes nothing; `createTasksFromDrafts` writes what a person accepted. The
 * split is the whole point of the feature — the model never reaches `tasks`
 * without someone having looked at its answer first, which is the same rule
 * transcript analysis follows through `task_proposals`.
 */

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function draftTasksFromBrief(
  brief: string,
): Promise<ActionResult<TaskBreakdown>> {
  return guarded(async () => {
    const session = await requireSessionForAction();

    if (!isAiConfigured()) return fail(await message("errors.intake.needsKey"));

    const text = typeof brief === "string" ? brief.trim() : "";
    if (text.length < MIN_BRIEF_LENGTH) {
      return fail(await message("errors.intake.tooShort"));
    }
    if (text.length > MAX_BRIEF_LENGTH) {
      return fail(await message("errors.intake.tooLong"));
    }

    const result = await breakDownBrief({
      brief: text,
      today: new Date().toISOString().slice(0, 10),
      members: session.workspace.members,
      authorMemberId: session.member.id,
    });

    const drafts: TaskDraft[] = result.breakdown.drafts.map((draft, index) => {
      const ownerMemberId = result.resolveOwner(draft.ownerKey);
      const unresolvedOwner = ownerMemberId === null;
      const hours = Number.isFinite(draft.estimateHours) ? draft.estimateHours : 0;

      return {
        key: `draft-${index + 1}`,
        title: draft.title.trim().slice(0, 200),
        description: draft.description.trim() || null,
        ownerMemberId,
        // An owner the roster could not resolve is a suggestion whatever the
        // model called it, exactly as in transcript analysis.
        ownerEvidence: unresolvedOwner ? "RECOMMENDED" : draft.ownerEvidence,
        ownerRationale: draft.ownerRationale.trim() || null,
        priority: draft.priority,
        priorityRationale: draft.priorityRationale.trim() || null,
        category: draft.category,
        labels: draft.labels.map((label) => label.trim()).filter(Boolean).slice(0, 3),
        dueDate: isoDate(draft.dueDate),
        estimateMinutes: hours > 0 ? Math.round(hours * 60) : null,
        sourceExcerpt: draft.sourceExcerpt.trim() || null,
        openQuestion: draft.openQuestion.trim() || null,
        needsReview: draft.needsReview || unresolvedOwner,
      };
    });

    if (drafts.length === 0) return fail(await message("errors.intake.noTasks"));

    return ok({
      summary: result.breakdown.summary.trim(),
      drafts,
      leftovers: result.breakdown.leftovers
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 12),
    });
  });
}

/** Only `yyyy-MM-dd` survives: anything looser is the model being imprecise. */
function isoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return Number.isNaN(new Date(`${trimmed}T12:00:00Z`).getTime()) ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * What the dialog sends back after editing. It is re-validated here rather
 * than trusted: these values went out to the browser, so by the time they come
 * back they are user input like any other.
 */
const draftToCreate = z.object({
  title: z.string().trim().min(3, "errors.task.titleTooShort").max(200),
  description: z.string().trim().max(50_000, "errors.task.docTooLong").nullable(),
  ownerMemberId: z.string().nullable(),
  priority: z.enum(TASK_PRIORITIES),
  category: z.enum(TASK_CATEGORIES),
  labels: z.array(z.string().trim().min(1).max(40)).max(10),
  dueDate: z.string().nullable(),
  estimateMinutes: z.number().int().positive().max(100_000).nullable(),
  /** Carried through so the task records what the model thought. */
  aiPriority: z.enum(TASK_PRIORITIES).nullable(),
  priorityRationale: z.string().trim().max(2000).nullable(),
  sourceExcerpt: z.string().trim().max(4000).nullable(),
  ownerEvidence: z.enum(EVIDENCE_LEVELS),
});

const createInput = z.array(draftToCreate).min(1).max(50);

export type DraftToCreate = z.input<typeof draftToCreate>;

export async function createTasksFromDrafts(
  raw: DraftToCreate[],
): Promise<ActionResult<{ created: number; firstTitle: string }>> {
  return guarded(async () => {
    const session = await requireSessionForAction();

    const parsed = createInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issue(parsed.error.issues[0]?.message, "errors.intake.invalid"));
    }
    const drafts = parsed.data;

    // One query for every owner the batch mentions, rather than one per task.
    const ownerIds = [...new Set(drafts.map((d) => d.ownerMemberId).filter(Boolean))] as string[];
    if (ownerIds.length > 0) {
      const found = await db.workspaceMember.findMany({
        where: { id: { in: ownerIds }, workspaceId: session.workspace.id },
        select: { id: true },
      });
      if (found.length !== ownerIds.length) {
        return fail(await message("errors.member.notInWorkspace"));
      }
    }

    const created = await db.$transaction(
      drafts.map((draft) =>
        db.task.create({
          data: {
            workspaceId: session.workspace.id,
            title: draft.title,
            description: draft.description,
            ownerMemberId: draft.ownerMemberId,
            creatorMemberId: session.member.id,
            status: "TODO",
            priority: draft.priority,
            category: draft.category,
            labels: draft.labels.slice(0, 10),
            dueDate: parseDateInput(draft.dueDate),
            estimateMinutes: draft.estimateMinutes,
            // What the model wanted, kept beside what the person chose.
            aiSuggestedPriority: draft.aiPriority,
            aiPriorityRationale: draft.priorityRationale,
            isAiGenerated: true,
            // A person read this draft and accepted it, so it is a confirmed
            // commitment and nothing may silently overwrite it later.
            confirmedByHuman: true,
            needsReview: false,
            sourceExcerpt: draft.sourceExcerpt,
          },
          select: { id: true, title: true },
        }),
      ),
    );

    for (const task of created) {
      await logActivity({
        workspaceId: session.workspace.id,
        actorMemberId: session.member.id,
        type: "TASK_CREATED",
        summary: `created “${task.title}”`,
        taskId: task.id,
        metadata: { source: "brief" },
      });
    }

    refresh();
    return ok({ created: created.length, firstTitle: created[0]?.title ?? "" });
  });
}

/** Resolves a Zod issue's key, falling back to a generic message. */
async function issue(key: string | undefined, fallback: TranslationKey): Promise<string> {
  return message((key ?? fallback) as TranslationKey);
}
