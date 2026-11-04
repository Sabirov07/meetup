import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  Library,
  Workflow,
  ListTodo,
  Settings,
  Sparkles,
  SquareCheckBig,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TranslationKey } from "@/shared/i18n";

export type NavItem = {
  href: string;
  /** Fallback label. The sidebar may substitute a person's name. */
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Which live count to show as a badge, if any. */
  badge?: "pendingReview" | "myOpen" | "theirOpen";
};

export type NavSection = { headingKey?: TranslationKey; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    items: [{ href: "/", labelKey: "nav.overview", icon: LayoutDashboard }],
  },
  {
    headingKey: "nav.section.tasks",
    items: [
      { href: "/my-tasks", labelKey: "nav.myTasks", icon: SquareCheckBig, badge: "myOpen" },
      {
        href: "/team-tasks",
        labelKey: "nav.teamTasks",
        icon: Users,
        badge: "theirOpen",
      },
      { href: "/all-tasks", labelKey: "nav.allTasks", icon: ListTodo },
    ],
  },
  {
    headingKey: "nav.section.conversations",
    items: [
      { href: "/meetings", labelKey: "nav.meetings", icon: CalendarClock },
      { href: "/review", labelKey: "nav.review", icon: Sparkles, badge: "pendingReview" },
    ],
  },
  {
    headingKey: "nav.section.workspace",
    items: [
      { href: "/team", labelKey: "nav.team", icon: UsersRound },
      { href: "/knowledge", labelKey: "nav.knowledge", icon: Library },
      { href: "/flowcharts", labelKey: "nav.flowcharts", icon: Workflow },
      { href: "/activity", labelKey: "nav.activity", icon: Activity },
      { href: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

/** Longest-prefix match, so /meetings/abc resolves to the Meetings item. */
export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return allNavItems[0];
  return allNavItems
    .filter((item) => item.href !== "/" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
