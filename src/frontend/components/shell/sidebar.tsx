"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, LogOut, PanelLeft, Plus, Sparkles, SquarePen, Users, Video } from "lucide-react";
import { signOut } from "@/backend/actions/auth";
import type {
  MemberSummary,
  WorkspaceOption,
  WorkspaceSummary,
} from "@/shared/domain/types";
import { cn } from "@/frontend/lib/utils";
import { Logo } from "@/frontend/components/brand";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Button } from "@/frontend/components/ui/button";
import { Count } from "@/frontend/components/ui/badge";
import { Tooltip } from "@/frontend/components/ui/feedback";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/frontend/components/ui/menu";
import { WorkspaceSwitcher } from "@/frontend/components/team/workspace-switcher";
import { useI18n } from "@/frontend/i18n";
import { LanguageMenuSection } from "./language-switch";
import { ThemeMenuSection } from "./theme-switch";
import { navSections, type NavItem } from "./nav";

export type NavCounts = { pendingReview: number; myOpen: number; theirOpen: number };

export function Sidebar({
  workspace,
  workspaces,
  member,
  counterpart,
  counts,
  collapsed,
  onToggle,
  onNavigate,
  onNewTask,
  onDescribeTasks,
  onStartMeeting,
}: {
  workspace: WorkspaceSummary;
  /** Every workspace this person belongs to, for the switcher. */
  workspaces: WorkspaceOption[];
  member: MemberSummary;
  counterpart: MemberSummary | null;
  counts: NavCounts;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  /** Opens the plain create form. */
  onNewTask: () => void;
  /** Opens the "describe the work and have it split up" dialog. */
  onDescribeTasks: () => void;
  onStartMeeting: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  /** The counterpart's own name beats a generic label in a two-person workspace. */
  function labelFor(item: NavItem): string {
    if (item.href !== "/team-tasks") return t(item.labelKey);
    if (workspace.members.length > 2) return t("nav.teamTasks");
    return counterpart
      ? t("nav.personTasks", { name: counterpart.name.split(" ")[0]! })
      : t(item.labelKey);
  }

  function isActive(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand + workspace */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-2" : "gap-1 px-3",
        )}
      >
        {collapsed ? (
          <Tooltip content={workspace.name} side="right">
            <button
              onClick={onToggle}
              aria-label={t("sidebar.expand")}
              className="rounded-md p-0.5 transition-opacity hover:opacity-80"
            >
              <Logo />
            </button>
          </Tooltip>
        ) : (
          <>
            <WorkspaceSwitcher workspaces={workspaces} activeName={workspace.name} />
            <Tooltip content={t("sidebar.collapse")} side="right">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggle}
                aria-label={t("sidebar.collapse")}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>

      {/* Create — the one place every kind of new thing starts */}
      <div className="shrink-0 px-2 pt-3">
        <Menu>
          {collapsed ? (
            <Tooltip content={t("sidebar.create")} side="right">
              <MenuTrigger asChild>
                <Button
                  variant="primary"
                  size="icon-sm"
                  className="w-full"
                  aria-label={t("sidebar.createLabel")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </MenuTrigger>
            </Tooltip>
          ) : (
            <MenuTrigger asChild>
              <Button variant="primary" size="md" className="w-full justify-start">
                <Plus className="h-3.5 w-3.5" />
                {t("sidebar.create")}
              </Button>
            </MenuTrigger>
          )}
          <MenuContent align="start" side="bottom" className="w-[17rem]">
            <MenuLabel>{t("nav.section.tasks")}</MenuLabel>
            {/* Listed first: it is the one that does the work for you. */}
            <MenuItem className="items-start py-2" onSelect={onDescribeTasks}>
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-bright" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-text">
                  {t("intake.open")}
                </span>
                <span className="mt-0.5 block text-2xs leading-4 text-text-faint">
                  {t("intake.openHint")}
                </span>
              </span>
            </MenuItem>
            <MenuItem className="items-start py-2" onSelect={onNewTask}>
              <SquarePen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-text">
                  {t("intake.blankTask")}
                </span>
                <span className="mt-0.5 block text-2xs leading-4 text-text-faint">
                  {t("intake.blankTaskHint")}
                </span>
              </span>
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={onStartMeeting}>
              <Video className="h-3.5 w-3.5" />
              {t("header.startMeeting")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2" aria-label={t("nav.main")}>
        {navSections.map((section, index) => (
          <div key={section.headingKey ?? index} className={index > 0 ? "mt-4" : undefined}>
            {section.headingKey && !collapsed && (
              <p className="eyebrow px-2 pb-1.5">{t(section.headingKey)}</p>
            )}
            {section.headingKey && collapsed && index > 0 && (
              <div className="mx-2 mb-2 h-px bg-line" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const count = item.badge ? counts[item.badge] : 0;
                const label = labelFor(item);

                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-7 items-center rounded-md text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "gap-2 px-2",
                      active
                        ? "bg-raised text-text"
                        : "text-text-secondary hover:bg-hover hover:text-text",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-accent-bright" : "text-text-faint group-hover:text-text-muted",
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {count > 0 && (
                          <Count
                            className={
                              item.badge === "pendingReview"
                                ? "tone-accent bg-[var(--tone-bg)] text-[var(--tone-fg)]"
                                : undefined
                            }
                          >
                            {count}
                          </Count>
                        )}
                      </>
                    )}
                    {collapsed && count > 0 && (
                      <span
                        className={cn(
                          "absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full",
                          item.badge === "pendingReview" ? "bg-accent" : "bg-text-faint",
                        )}
                      />
                    )}
                  </Link>
                );

                return (
                  <li key={item.href} className="relative">
                    {collapsed ? (
                      <Tooltip
                        content={count > 0 ? `${label} · ${count}` : label}
                        side="right"
                        delay={120}
                      >
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Person */}
      <div className={cn("shrink-0 border-t border-line p-2")}>
        <Menu>
          <MenuTrigger asChild>
            <button
              aria-label={t("sidebar.accountMenu")}
              className={cn(
                "flex w-full items-center rounded-md transition-colors hover:bg-hover",
                collapsed ? "justify-center p-1.5" : "gap-2 px-1.5 py-1.5",
              )}
            >
              <Avatar member={member} size="lg" />
              {!collapsed && (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium leading-4 text-text">
                    {member.name}
                  </span>
                  <span className="block truncate text-2xs leading-4 text-text-faint">
                    {member.jobTitle ??
                      (member.role === "ADMINISTRATOR"
                        ? t("sidebar.role.administrator")
                        : t("sidebar.role.member"))}
                  </span>
                </span>
              )}
            </button>
          </MenuTrigger>
          <MenuContent align="start" side="top" className="w-60">
            <div className="px-2 py-1.5">
              <p className="truncate text-[13px] font-medium text-text">{member.name}</p>
              <p className="truncate text-2xs text-text-muted">{member.email}</p>
            </div>
            <MenuSeparator />
            <LanguageMenuSection />
            <MenuSeparator />
            <ThemeMenuSection />
            <MenuSeparator />
            <MenuItem asChild>
              <Link href="/team">
                <Users className="h-3.5 w-3.5" />
                {t("team.switcher.manage")}
              </Link>
            </MenuItem>
            <MenuItem asChild>
              <Link href="/settings">{t("sidebar.workspaceSettings")}</Link>
            </MenuItem>
            <MenuSeparator />
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-hover hover:text-text"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("sidebar.signOut")}
              </button>
            </form>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}

/** Shown in the header on small screens, where the sidebar is a drawer. */
export function SidebarTrigger({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={t("sidebar.openNavigation")}
      className="lg:hidden"
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
}
