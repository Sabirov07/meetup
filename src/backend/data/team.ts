import "server-only";

import { db } from "@/backend/db";
import { toMemberSummary } from "@/backend/auth/guards";
import { requestOrigin } from "@/backend/app-url";
import { inviteLink } from "@/backend/team/invites";
import type {
  InviteView,
  SessionContext,
  TeamMember,
  TeamView,
  WorkspaceOption,
} from "@/shared/domain/types";

/**
 * The read side of team management.
 *
 * Both functions are scoped by a workspace id that came from the session, never
 * from a parameter the browser chose — see the note in `auth/guards.ts` about
 * where isolation is actually enforced.
 */

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, accentToken: true } },
} as const;

/**
 * Members with their workload, plus pending invites for an administrator.
 *
 * The per-member counts come from one grouped query rather than a count per
 * person: a twenty-person workspace would otherwise fire sixty round trips to
 * draw one page.
 */
export async function getTeam(
  session: SessionContext,
  now: Date,
): Promise<TeamView> {
  const workspaceId = session.workspace.id;
  const isAdmin = session.member.role === "ADMINISTRATOR";

  const [rows, open, overdue, completed, unassignedTasks, invites] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId },
      select: memberSelect,
      orderBy: { createdAt: "asc" },
    }),
    db.task.groupBy({
      by: ["ownerMemberId"],
      where: { workspaceId, status: { not: "COMPLETED" } },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["ownerMemberId"],
      where: { workspaceId, status: { not: "COMPLETED" }, dueDate: { lt: now } },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["ownerMemberId"],
      where: { workspaceId, status: "COMPLETED" },
      _count: { _all: true },
    }),
    db.task.count({
      where: { workspaceId, ownerMemberId: null, status: { not: "COMPLETED" } },
    }),
    isAdmin
      ? db.workspaceInvite.findMany({
          where: { workspaceId, status: "PENDING", expiresAt: { gt: now } },
          select: {
            id: true,
            token: true,
            email: true,
            role: true,
            jobTitle: true,
            expiresAt: true,
            createdAt: true,
            invitedBy: { select: memberSelect },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Falls back to this request's own origin when APP_URL is not configured,
  // so a copied link always points somewhere the recipient can reach.
  const origin = isAdmin && invites.length > 0 ? await requestOrigin() : undefined;

  const tally = (
    groups: { ownerMemberId: string | null; _count: { _all: number } }[],
  ): Map<string, number> =>
    new Map(
      groups
        .filter((g): g is { ownerMemberId: string; _count: { _all: number } } =>
          Boolean(g.ownerMemberId),
        )
        .map((g) => [g.ownerMemberId, g._count._all]),
    );

  const openBy = tally(open);
  const overdueBy = tally(overdue);
  const completedBy = tally(completed);

  const members: TeamMember[] = rows.map((row) => ({
    ...toMemberSummary(row),
    openTasks: openBy.get(row.id) ?? 0,
    overdueTasks: overdueBy.get(row.id) ?? 0,
    completedTasks: completedBy.get(row.id) ?? 0,
    joinedAt: row.createdAt.toISOString(),
  }));

  const inviteViews: InviteView[] = invites.map((row) => ({
    id: row.id,
    link: inviteLink(row.token, origin),
    email: row.email,
    role: row.role,
    jobTitle: row.jobTitle,
    invitedBy: row.invitedBy ? toMemberSummary(row.invitedBy) : null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));

  return { members, invites: inviteViews, unassignedTasks };
}

/**
 * Every workspace this person belongs to, for the sidebar switcher.
 *
 * One query with a member count, so the menu can say "Acme · 6 people"
 * without a second pass per row.
 */
export async function listMyWorkspaces(
  userId: string,
  activeWorkspaceId: string,
): Promise<WorkspaceOption[]> {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
    memberCount: m.workspace._count.members,
    isActive: m.workspace.id === activeWorkspaceId,
  }));
}
