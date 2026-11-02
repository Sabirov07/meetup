import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  ListTodo,
  Settings,
  Sparkles,
  SquareCheckBig,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  /** Fallback label. The sidebar may substitute a person's name. */
  label: string;
  icon: LucideIcon;
  /** Which live count to show as a badge, if any. */
  badge?: "pendingReview" | "myOpen" | "theirOpen";
};

export type NavSection = { heading?: string; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    items: [{ href: "/", label: "Overview", icon: LayoutDashboard }],
  },
  {
    heading: "Tasks",
    items: [
      { href: "/my-tasks", label: "My tasks", icon: SquareCheckBig, badge: "myOpen" },
      { href: "/employer-tasks", label: "Employer’s tasks", icon: Users, badge: "theirOpen" },
      { href: "/all-tasks", label: "All tasks", icon: ListTodo },
    ],
  },
  {
    heading: "Conversations",
    items: [
      { href: "/meetings", label: "Meetings", icon: CalendarClock },
      { href: "/review", label: "AI review", icon: Sparkles, badge: "pendingReview" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings },
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
