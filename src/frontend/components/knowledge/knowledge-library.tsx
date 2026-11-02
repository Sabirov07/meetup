"use client";

import {
  FileText,
  ImageIcon,
  Library,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createKnowledgeDoc,
  deleteKnowledgeDoc,
  updateKnowledgeDoc,
} from "@/backend/actions/knowledge";
import type { KnowledgeDocSummary } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState, Tooltip } from "@/frontend/components/ui/feedback";
import { Input } from "@/frontend/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/frontend/components/ui/menu";
import { RelativeTime } from "@/frontend/components/ui/relative-time";

/**
 * The knowledge library: every page in the workspace, in one list.
 *
 * Organised by label rather than by folder. A folder tree forces one filing
 * decision per page and then hides everything that was filed badly; a label
 * can say "onboarding" and "billing" at once, and the search box covers what
 * labels miss — it reads the body text through the excerpt the server derives,
 * so a page is findable by what is written in it, not only by its title.
 */
export function KnowledgeLibrary({ docs: initial }: { docs: KnowledgeDocSummary[] }) {
  const router = useRouter();
  const t = useT();
  const [docs, setDocs] = useState(initial);
  const [query, setQuery] = useState("");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [creating, startCreating] = useTransition();

  const labels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of docs) {
      for (const label of doc.labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [docs]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (activeLabels.length > 0 && !activeLabels.every((label) => doc.labels.includes(label))) {
        return false;
      }
      if (!needle) return true;
      return (
        doc.title.toLowerCase().includes(needle) ||
        doc.excerpt.toLowerCase().includes(needle) ||
        doc.labels.some((label) => label.toLowerCase().includes(needle))
      );
    });
  }, [docs, query, activeLabels]);

  const pinned = matches.filter((doc) => doc.isPinned);
  const rest = matches.filter((doc) => !doc.isPinned);
  const filtering = query.trim().length > 0 || activeLabels.length > 0;

  function create() {
    startCreating(async () => {
      const result = await createKnowledgeDoc();
      if (!result.ok) {
        toast.error(t("knowledge.createFailed"), { description: result.error });
        return;
      }
      router.push(`/knowledge/${result.data.id}`);
    });
  }

  async function togglePin(doc: KnowledgeDocSummary) {
    const next = !doc.isPinned;
    setDocs((previous) =>
      previous.map((item) => (item.id === doc.id ? { ...item, isPinned: next } : item)),
    );
    const result = await updateKnowledgeDoc({ id: doc.id, isPinned: next });
    if (!result.ok) {
      setDocs((previous) =>
        previous.map((item) => (item.id === doc.id ? { ...item, isPinned: !next } : item)),
      );
      toast.error(t("knowledge.changeFailed"), { description: result.error });
    }
  }

  async function remove(doc: KnowledgeDocSummary) {
    const snapshot = docs;
    setDocs((previous) => previous.filter((item) => item.id !== doc.id));
    const result = await deleteKnowledgeDoc(doc.id);
    if (!result.ok) {
      setDocs(snapshot);
      toast.error(t("knowledge.deleteFailed"), { description: result.error });
      return;
    }
    toast.success(t("knowledge.deleted"), { description: doc.title });
  }

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {t("knowledge.heading")}
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-text-muted">
            {t("knowledge.description")}
          </p>
        </div>
        <Button variant="primary" size="lg" loading={creating} onClick={create}>
          <Plus className="h-3.5 w-3.5" />
          {t("knowledge.newPage")}
        </Button>
      </header>

      {docs.length > 0 && (
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("knowledge.searchPlaceholder")}
              aria-label={t("knowledge.searchLabel")}
              className="pl-8"
            />
          </div>

          {labels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {labels.map(([label, count]) => {
                const active = activeLabels.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() =>
                      setActiveLabels((previous) =>
                        active ? previous.filter((l) => l !== label) : [...previous, label],
                      )
                    }
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs transition-colors",
                      active
                        ? "border-accent bg-accent-dim text-accent-bright"
                        : "border-line bg-raised text-text-muted hover:border-line-strong hover:text-text",
                    )}
                  >
                    {label}
                    <span className="tabular-nums text-text-faint">{count}</span>
                  </button>
                );
              })}
              {activeLabels.length > 0 && (
                <button
                  onClick={() => setActiveLabels([])}
                  className="flex items-center gap-1 px-1 text-2xs text-text-faint hover:text-text"
                >
                  <X className="h-3 w-3" />
                  {t("common.clear")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState
          icon={Library}
          title={t("knowledge.empty.title")}
          description={t("knowledge.empty.description")}
          action={
            <Button variant="secondary" loading={creating} onClick={create}>
              <Plus className="h-3.5 w-3.5" />
              {t("knowledge.empty.action")}
            </Button>
          }
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("knowledge.noMatches.title")}
          description={t("knowledge.noMatches.description")}
        />
      ) : (
        <div className="space-y-5">
          {pinned.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow flex items-center gap-1.5">
                <Pin className="h-3 w-3" />
                {t("knowledge.pinned")}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {pinned.map((doc) => (
                  <DocCard key={doc.id} doc={doc} onTogglePin={togglePin} onDelete={remove} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-2">
              {pinned.length > 0 && (
                <p className="eyebrow">
                  {t(filtering ? "knowledge.otherMatches" : "knowledge.allPages")}
                </p>
              )}
              <div className="grid gap-2.5 sm:grid-cols-2">
                {rest.map((doc) => (
                  <DocCard key={doc.id} doc={doc} onTogglePin={togglePin} onDelete={remove} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DocCard({
  doc,
  onTogglePin,
  onDelete,
}: {
  doc: KnowledgeDocSummary;
  onTogglePin: (doc: KnowledgeDocSummary) => void;
  onDelete: (doc: KnowledgeDocSummary) => void;
}) {
  const t = useT();

  return (
    <article className="group/card relative flex flex-col rounded-xl border border-line bg-surface p-3 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
        <h2 className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-text">
          {/* The whole card is the link target; the menu sits above it. */}
          <Link href={`/knowledge/${doc.id}`} className="before:absolute before:inset-0">
            {doc.title}
          </Link>
        </h2>
        {doc.isPinned && (
          <Tooltip content={t("knowledge.pinned")}>
            <Pin className="h-3 w-3 shrink-0 text-accent-bright" />
          </Tooltip>
        )}
        <Menu>
          <MenuTrigger asChild>
            <button
              aria-label={t("knowledge.actionsFor", { title: doc.title })}
              className="relative z-10 shrink-0 rounded p-0.5 text-text-faint opacity-0 transition-opacity hover:text-text focus-visible:opacity-100 group-hover/card:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => onTogglePin(doc)}>
              {doc.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {t(doc.isPinned ? "knowledge.unpin" : "knowledge.pinToTop")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem destructive onSelect={() => onDelete(doc)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("knowledge.deletePage")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {doc.excerpt ? (
        <p className="mt-1.5 line-clamp-2 text-2xs leading-5 text-text-muted">{doc.excerpt}</p>
      ) : (
        <p className="mt-1.5 text-2xs italic leading-5 text-text-faint">
          {t("knowledge.emptyPage")}
        </p>
      )}

      {doc.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {doc.labels.map((label) => (
            <span key={label} className="rounded-[4px] bg-raised px-1.5 py-0.5 text-2xs text-text-muted">
              {label}
            </span>
          ))}
        </div>
      )}

      <footer className="mt-2.5 flex items-center gap-1.5 text-2xs text-text-faint">
        {doc.updatedBy && <Avatar member={doc.updatedBy} size="xs" />}
        <span className="truncate">
          {doc.updatedBy ? `${doc.updatedBy.name} · ` : ""}
          <RelativeTime value={doc.updatedAt} />
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {doc.images > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-2.5 w-2.5" />
              {doc.images}
            </span>
          )}
          <span className="tabular-nums">{t("knowledge.words", { count: doc.words })}</span>
        </span>
      </footer>
    </article>
  );
}
