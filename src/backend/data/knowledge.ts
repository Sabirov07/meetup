import "server-only";

import { db } from "@/backend/db";
import { toMemberSummary } from "@/backend/auth/guards";
import { docStats, plainText } from "@/shared/doc/markdown";
import type { KnowledgeDocSummary, KnowledgeDocView } from "@/shared/domain/types";

/**
 * Reads for the knowledge library.
 *
 * As everywhere else in `data/`, `workspaceId` must come from
 * `requireSession()` — see the note in `auth/guards.ts` about why the
 * database's RLS policies do not constrain these queries.
 */

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  user: { select: { id: true, name: true, email: true, accentToken: true } },
} as const;

/** How much of a page the list card shows. */
const EXCERPT_LENGTH = 180;

function summarise(row: {
  id: string;
  title: string;
  body: string | null;
  labels: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: Parameters<typeof toMemberSummary>[0] | null;
}): KnowledgeDocSummary {
  const stats = docStats(row.body);
  const text = plainText(row.body);

  return {
    id: row.id,
    title: row.title,
    excerpt: text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…` : text,
    labels: row.labels,
    isPinned: row.isPinned,
    words: stats.words,
    images: stats.images,
    updatedBy: row.updatedBy ? toMemberSummary(row.updatedBy) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Every page in the library, pinned ones first.
 *
 * The body is read here only to derive the excerpt and the counts, and is not
 * returned — the list card never needs the full text, and a library of long
 * pages would otherwise be a heavy payload for a page of headlines.
 */
export async function listKnowledgeDocs(workspaceId: string): Promise<KnowledgeDocSummary[]> {
  const rows = await db.knowledgeDoc.findMany({
    where: { workspaceId },
    select: {
      id: true,
      title: true,
      body: true,
      labels: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      updatedBy: { select: memberSelect },
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return rows.map(summarise);
}

export async function getKnowledgeDoc(
  id: string,
  workspaceId: string,
): Promise<KnowledgeDocView | null> {
  const row = await db.knowledgeDoc.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      title: true,
      body: true,
      labels: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: memberSelect },
      updatedBy: { select: memberSelect },
    },
  });
  if (!row) return null;

  return {
    ...summarise(row),
    body: row.body,
    createdBy: row.createdBy ? toMemberSummary(row.createdBy) : null,
  };
}

/** Every label in use, with how many pages carry it — the library's index. */
export async function listKnowledgeLabels(workspaceId: string): Promise<string[]> {
  const rows = await db.knowledgeDoc.findMany({
    where: { workspaceId },
    select: { labels: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const label of row.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}
