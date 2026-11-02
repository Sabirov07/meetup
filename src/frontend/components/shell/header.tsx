"use client";

import { Bell, ChevronRight, Plus, Search, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MemberSummary, WorkspaceSummary } from "@/shared/domain/types";
import type { ShellAlert, ShellAlertId } from "@/backend/data/overview";
import type { TranslationKey } from "@/shared/i18n";
import { useI18n } from "@/frontend/i18n";
import { Badge, Count, Kbd } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Tooltip } from "@/frontend/components/ui/feedback";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/frontend/components/ui/menu";
import { findNavItem } from "./nav";
import { SidebarTrigger } from "./sidebar";

export type HeaderAlert = ShellAlert;

/**
 * How each attention condition is presented. The server only says *which*
 * condition fired and how big it is; the link, the colour and the wording are
 * decided here, where the active language is known.
 */
const alertPresentation: Record<
  ShellAlertId,
  { href: string; tone: string; title: TranslationKey; detail: TranslationKey }
> = {
  overdue: {
    href: "/my-tasks",
    tone: "tone-danger",
    title: "alerts.overdue.title",
    detail: "alerts.overdue.detail",
  },
  today: {
    href: "/my-tasks",
    tone: "tone-warning",
    title: "alerts.today.title",
    detail: "alerts.today.detail",
  },
  review: {
    href: "/review",
    tone: "tone-accent",
    title: "alerts.review.title",
    detail: "alerts.review.detail",
  },
  unclear: {
    href: "/all-tasks",
    tone: "tone-warning",
    title: "alerts.unclear.title",
    detail: "alerts.unclear.detail",
  },
  transcripts: {
    href: "/meetings",
    tone: "tone-info",
    title: "alerts.transcripts.title",
    detail: "alerts.transcripts.detail",
  },
};

export function Header({
  workspace,
  counterpart,
  pendingReview,
  alerts,
  onOpenSidebar,
  onOpenSearch,
  onStartMeeting,
  onNewTask,
  /** Breadcrumb tail, e.g. a meeting title. */
  crumb,
}: {
  workspace: WorkspaceSummary;
  counterpart: MemberSummary | null;
  pendingReview: number;
  alerts: HeaderAlert[];
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
  onStartMeeting: () => void;
  onNewTask: () => void;
  crumb?: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const navItem = findNavItem(pathname);

  const title =
    navItem?.href === "/employer-tasks"
      ? workspace.members.length > 2
        ? t("nav.teamTasks")
        : counterpart
          ? t("nav.personTasks", { name: counterpart.name.split(" ")[0]! })
          : t(navItem.labelKey)
      : navItem
        ? t(navItem.labelKey)
        : "Meetup";

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-sm sm:px-4">
      <SidebarTrigger onClick={onOpenSidebar} />

      {/* Title / breadcrumb */}
      <div className="flex min-w-0 items-center gap-1.5">
        {crumb && navItem ? (
          <>
            <Link
              href={navItem.href}
              className="shrink-0 text-[13px] text-text-muted transition-colors hover:text-text"
            >
              {title}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 text-text-faint" aria-hidden />
            <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
              {crumb}
            </h1>
          </>
        ) : (
          <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
            {title}
          </h1>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="hidden h-8 items-center gap-2 rounded-md border border-line bg-surface pl-2.5 pr-2 text-xs text-text-faint transition-colors hover:border-line-strong hover:text-text-muted md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="pr-6">{t("header.searchPlaceholder")}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSearch}
          aria-label={t("common.search")}
          className="md:hidden"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label={
                alerts.length > 0
                  ? t("header.notificationsWithCount", { count: alerts.length })
                  : t("header.notifications")
              }
              className="relative rounded-md p-1.5 text-text-secondary transition-colors hover:bg-hover hover:text-text"
            >
              <Bell className="h-4 w-4" />
              {alerts.length > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-canvas" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[20rem] p-0">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-[13px] font-medium text-text">
                {t("header.needsAttention")}
              </span>
              {pendingReview > 0 && (
                <Link href="/review" className="text-2xs text-accent-bright hover:underline">
                  {t("header.reviewCount", { count: pendingReview })}
                </Link>
              )}
            </div>
            <div className="max-h-[18rem] overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-text-faint">
                  {t("header.nothingNeedsYou")}
                </p>
              ) : (
                alerts.map((alert) => {
                  const presentation = alertPresentation[alert.id];
                  return (
                    <Link
                      key={alert.id}
                      href={presentation.href}
                      className="flex items-start gap-2 border-b border-line px-3 py-2 transition-colors last:border-b-0 hover:bg-hover"
                    >
                      <span
                        className={`${presentation.tone} mt-1 h-1.5 w-1.5 shrink-0 rounded-full tone-dot`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-text">
                          {t(presentation.title, { count: alert.count })}
                        </span>
                        <span className="mt-0.5 block text-2xs leading-4 text-text-muted">
                          {t(presentation.detail)}
                        </span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" />

        {/* Primary actions */}
        <Tooltip content={t("header.createTask")}>
          <Button variant="secondary" size="md" onClick={onNewTask}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("header.newTask")}</span>
          </Button>
        </Tooltip>

        <Button variant="primary" size="md" onClick={onStartMeeting}>
          <Video className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("header.startMeeting")}</span>
        </Button>
      </div>
    </header>
  );
}

/** Small count chip reused by page headers. */
export function PageCount({ children }: { children: React.ReactNode }) {
  return <Count>{children}</Count>;
}

export { Badge as HeaderBadge };
