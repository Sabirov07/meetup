"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import { requireSessionForAction } from "@/backend/auth/guards";
import { getKnowledgeDoc, listKnowledgeDocs } from "@/backend/data/knowledge";
import type { KnowledgeDocSummary, KnowledgeDocView } from "@/shared/domain/types";
import { fail, guarded, logActivity, ok, type ActionResult } from "./shared";

/**
 * Writes for the knowledge library.
 *
 * A page is a workspace-wide document, so there is no owner to check against —
 * any member may read, write and delete one. What is checked, on every call,
 * is that the page belongs to the caller's workspace.
 */

const TITLE_MAX = 200;
const BODY_MAX = 200_000;

/** Confirms a page is in the caller's workspace before it is changed. */
async function assertDocInWorkspace(id: string, workspaceId: string) {
  const doc = await db.knowledgeDoc.findFirst({
    where: { id, workspaceId },
    select: { id: true, title: true, isPinned: true },
  });
  if (!doc) throw new Error("That page no longer exists in this workspace.");
  return doc;
}

const createInput = z.object({
  title: z.string().trim().max(TITLE_MAX).optional(),
  body: z.string().max(BODY_MAX).optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

/**
 * Starts a page.
 *
 * It is created empty and untitled on purpose: the library is written in, not
 * filled in through a form, so the first thing a person should see is a
 * cursor rather than a dialog.
 */
export async function createKnowledgeDoc(
  raw: z.input<typeof createInput> = {},
): Promise<ActionResult<KnowledgeDocView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = createInput.safeParse(raw);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "That page is not valid.");
    }

    const title = parsed.data.title?.trim() || "Untitled page";

    const created = await db.knowledgeDoc.create({
      data: {
        workspaceId: session.workspace.id,
        title,
        body: parsed.data.body ?? null,
        labels: parsed.data.labels ?? [],
        createdByMemberId: session.member.id,
        updatedByMemberId: session.member.id,
      },
      select: { id: true },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "KNOWLEDGE_CREATED",
      summary: `added “${title}” to the library`,
      knowledgeDocId: created.id,
    });

    const doc = await getKnowledgeDoc(created.id, session.workspace.id);
    if (!doc) return fail("The page was created but could not be read back.");
    refresh();
    return ok(doc);
  });
}

/**
 * A change to one page, where an absent key means "leave it alone".
 *
 * Written out field by field rather than with `.partial()`, which keeps each
 * field's default and would have an autosaved body also clear the labels.
 */
const updateInput = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "A page needs a title.").max(TITLE_MAX).optional(),
  body: z.string().max(BODY_MAX).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  isPinned: z.boolean().optional(),
});

export async function updateKnowledgeDoc(
  raw: z.input<typeof updateInput>,
): Promise<ActionResult<KnowledgeDocView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = updateInput.safeParse(raw);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "That change is not valid.");
    }

    const { id, ...changes } = parsed.data;
    const before = await assertDocInWorkspace(id, session.workspace.id);

    const data: Record<string, unknown> = {};
    if (changes.title !== undefined) data.title = changes.title;
    if (changes.body !== undefined) data.body = changes.body;
    if (changes.labels !== undefined) data.labels = changes.labels;
    if (changes.isPinned !== undefined) data.isPinned = changes.isPinned;

    if (Object.keys(data).length === 0) {
      const unchanged = await getKnowledgeDoc(id, session.workspace.id);
      return unchanged ? ok(unchanged) : fail("That page no longer exists.");
    }

    data.updatedByMemberId = session.member.id;
    await db.knowledgeDoc.update({ where: { id }, data });

    // Pinning says something about the library; an edit says something about
    // the page. Only the second is worth a line in the feed, and only once —
    // autosave would otherwise write one entry per pause in typing.
    if (changes.isPinned !== undefined && changes.isPinned !== before.isPinned) {
      await logActivity({
        workspaceId: session.workspace.id,
        actorMemberId: session.member.id,
        type: "KNOWLEDGE_UPDATED",
        summary: changes.isPinned
          ? `pinned “${before.title}” in the library`
          : `unpinned “${before.title}”`,
        knowledgeDocId: id,
      });
    } else if (await isFirstEditToday(id, session.workspace.id)) {
      await logActivity({
        workspaceId: session.workspace.id,
        actorMemberId: session.member.id,
        type: "KNOWLEDGE_UPDATED",
        summary: `edited “${changes.title ?? before.title}”`,
        knowledgeDocId: id,
      });
    }

    const doc = await getKnowledgeDoc(id, session.workspace.id);
    if (!doc) return fail("That page no longer exists.");
    refresh();
    return ok(doc);
  });
}

/**
 * True when nobody has recorded an edit to this page in the last few hours.
 *
 * A document is written in passes, and the editor saves on a timer, so one
 * sitting would otherwise fill the activity feed with a dozen identical
 * lines. Collapsing them to the first keeps the feed a history of pages
 * rather than a log of keystrokes.
 */
async function isFirstEditToday(docId: string, workspaceId: string): Promise<boolean> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const recent = await db.activityEvent.findFirst({
    where: {
      workspaceId,
      knowledgeDocId: docId,
      type: "KNOWLEDGE_UPDATED",
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return recent === null;
}

export async function deleteKnowledgeDoc(id: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const before = await assertDocInWorkspace(id, session.workspace.id);

    await db.knowledgeDoc.delete({ where: { id } });

    // knowledgeDocId is omitted: the row is gone and the FK cascades.
    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "KNOWLEDGE_DELETED",
      summary: `deleted “${before.title}” from the library`,
    });

    refresh();
    return ok(undefined);
  });
}

/** Re-reads the library after a change made somewhere else in the UI. */
export async function fetchKnowledgeDocs(): Promise<ActionResult<KnowledgeDocSummary[]>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    return ok(await listKnowledgeDocs(session.workspace.id));
  });
}
