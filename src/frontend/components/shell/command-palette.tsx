"use client";

import {
  CalendarClock,
  CornerDownLeft,
  Library,
  Loader2,
  Search,
  SquareCheckBig,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { searchWorkspace, type SearchHit } from "@/backend/actions/search";
import { priorityMeta, statusMeta } from "@/shared/domain/labels";
import { useI18n, useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Badge, Dot, Kbd } from "@/frontend/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/frontend/components/ui/dialog";
import { allNavItems } from "./nav";

type Command =
  | {
      kind: "nav";
      href: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  | { kind: "hit"; hit: SearchHit };

/** ⌘K search across tasks, meetings and navigation. */
export function CommandPalette({
  open,
  onOpenChange,
  onOpenTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="top-[18%] max-w-xl translate-y-0 p-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        {/* Inside the portal: closing unmounts this and clears the query. */}
        <PaletteBody onOpenChange={onOpenChange} onOpenTask={onOpenTask} />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({
  onOpenChange,
  onOpenTask,
}: {
  onOpenChange: (open: boolean) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced server search; the cancelled flag drops out-of-order responses.
  useEffect(() => {
    const trimmed = query.trim();
    // Too short to search: nothing to schedule. Stale hits are filtered out
    // during render instead of being cleared from here.
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      // Set inside the timer rather than in the effect body: it keeps the
      // spinner from flashing on every keystroke, and keeps this effect free
      // of synchronous state updates.
      setLoading(true);
      void searchWorkspace(trimmed).then((result) => {
        if (cancelled) return;
        setHits(result.ok ? result.data : []);
        setLoading(false);
        setActive(0);
      });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const searching = query.trim().length >= 2;
  // Derived, not stored: below the minimum length there are simply no hits.
  const visibleHits = searching ? hits : [];

  // Matched against the *translated* label, so searching in the language on
  // screen finds the page the person can see.
  const needle = query.trim().toLowerCase();
  const navMatches = allNavItems
    .map((item) => ({ ...item, label: t(item.labelKey) }))
    .filter((item) => item.label.toLowerCase().includes(needle));

  const commands: Command[] = [
    ...visibleHits.map((hit): Command => ({ kind: "hit", hit })),
    ...(needle.length === 0 || navMatches.length > 0
      ? navMatches.map((item): Command => ({
          kind: "nav",
          href: item.href,
          label: item.label,
          icon: item.icon,
        }))
      : []),
  ];

  function run(command: Command) {
    onOpenChange(false);
    if (command.kind === "nav") {
      router.push(command.href);
      return;
    }
    if (command.hit.kind === "meeting") {
      router.push(`/meetings/${command.hit.id}`);
      return;
    }
    if (command.hit.kind === "doc") {
      router.push(`/knowledge/${command.hit.id}`);
      return;
    }
    if (onOpenTask) onOpenTask(command.hit.id);
    else router.push(`/all-tasks?task=${command.hit.id}`);
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-faint" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-text-faint" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("palette.placeholder")}
          aria-label={t("common.search")}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, commands.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && commands[active]) {
              event.preventDefault();
              run(commands[active]);
            }
          }}
        />
        <Kbd>esc</Kbd>
      </div>

      <div className="max-h-[22rem] overflow-y-auto p-1.5">
        {commands.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-text-faint">
            {query.trim().length < 2
              ? t("palette.minChars")
              : t("palette.noResults", { query: query.trim() })}
          </p>
        ) : (
          commands.map((command, index) => {
            const selected = index === active;
            return (
              <button
                key={command.kind === "nav" ? command.href : command.hit.id}
                onMouseEnter={() => setActive(index)}
                onClick={() => run(command)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                  selected ? "bg-hover" : "hover:bg-hover",
                )}
              >
                {command.kind === "nav" ? (
                  <>
                    <command.icon className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                      {t("palette.goTo", { label: command.label })}
                    </span>
                  </>
                ) : command.hit.kind === "task" ? (
                  <>
                    <SquareCheckBig className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-text">
                        {command.hit.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-2xs text-text-faint">
                        <Dot tone={statusMeta[command.hit.status].tone} />
                        {t(`status.${command.hit.status}.label`)}
                        {command.hit.ownerName && (
                          <>
                            <span aria-hidden>·</span>
                            {command.hit.ownerName}
                          </>
                        )}
                      </span>
                    </span>
                    <Badge tone={priorityMeta[command.hit.priority].tone}>
                      {t(`priority.${command.hit.priority}.label`)}
                    </Badge>
                  </>
                ) : command.hit.kind === "doc" ? (
                  <>
                    <Library className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-text">
                        {command.hit.title}
                      </span>
                      {command.hit.excerpt && (
                        <span className="block truncate text-2xs text-text-faint">
                          {command.hit.excerpt}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-2xs text-text-faint">
                      {t("palette.kind.page")}
                    </span>
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-3.5 w-3.5 shrink-0 text-text-faint" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">
                      {command.hit.title}
                    </span>
                    <span className="text-2xs text-text-faint">{t("palette.kind.meeting")}</span>
                  </>
                )}
                {selected && (
                  <CornerDownLeft className="h-3 w-3 shrink-0 text-text-faint" />
                )}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
