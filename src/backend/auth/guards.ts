import "server-only";

import { redirect } from "next/navigation";
import { db } from "@/backend/db";
import { message } from "@/backend/i18n/message";
import { initialsFor } from "@/shared/domain/labels";
import type { MemberSummary, SessionContext, WorkspaceRole } from "@/shared/domain/types";
import { resolveUserFromCookie } from "./session";

/**
 * Authorization chokepoint.
 *
 * Prisma connects as the Postgres owner role, which carries BYPASSRLS, so the
 * row-level policies in the database do NOT constrain application queries.
 * (They are still valuable: they lock down Supabase's public PostgREST
 * endpoint, which is exposed on every project by default.)
 *
 * The consequence is that workspace isolation is enforced *here* and in the
 * data-access functions, which must always filter by a workspaceId that came
 * from `requireSession()` — never from user input.
 */

export function toMemberSummary(row: {
  id: string;
  role: WorkspaceRole;
  jobTitle: string | null;
  user: { id: string; name: string; email: string; accentToken: string };
}): MemberSummary {
  return {
    id: row.id,
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    initials: initialsFor(row.user.name),
    role: row.role,
    jobTitle: row.jobTitle,
    accentToken: row.user.accentToken,
  };
}

const memberSelect = {
  id: true,
  role: true,
  jobTitle: true,
  user: { select: { id: true, name: true, email: true, accentToken: true } },
} as const;

/**
 * The membership behind a remembered workspace id, or null when the id is
 * stale — a workspace they have left, or one that has been deleted. Looking it
 * up by membership rather than trusting the pointer is what lets both pointers
 * be plain nullable columns with no foreign key behind them.
 */
async function membershipIn(userId: string, workspaceId: string | null | undefined) {
  if (!workspaceId) return null;
  return db.workspaceMember.findFirst({
    where: { userId, workspaceId },
    select: { ...memberSelect, workspaceId: true },
  });
}

/** Resolves the signed-in person and their active workspace, or null. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await resolveUserFromCookie();
  if (!user) return null;

  const preference = await db.userPreference.findUnique({
    where: { userId: user.id },
    select: { lastWorkspaceId: true, primaryWorkspaceId: true },
  });

  // In order: where they were, then the one they call their main one, then
  // whatever they belong to. The last step is creation order, which for an
  // account that signed up alone and joined a team later means the empty
  // personal workspace — so it is a floor, not a preference.
  const membership =
    (await membershipIn(user.id, preference?.lastWorkspaceId)) ??
    (await membershipIn(user.id, preference?.primaryWorkspaceId)) ??
    (await db.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { ...memberSelect, workspaceId: true },
    }));

  if (!membership) return null;

  const workspace = await db.workspace.findUnique({
    where: { id: membership.workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      members: { select: memberSelect, orderBy: { createdAt: "asc" } },
    },
  });

  if (!workspace) return null;

  return {
    userId: user.id,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      members: workspace.members.map(toMemberSummary),
    },
    member: toMemberSummary(membership),
  };
}

/** Redirects to the sign-in page when there is no valid session. */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return context;
}

/** For server actions: throws rather than redirecting, so the client sees an error. */
export async function requireSessionForAction(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) throw new Error(await message("errors.sessionExpired"));
  return context;
}

export async function requireAdministrator(): Promise<SessionContext> {
  const context = await requireSessionForAction();
  if (context.member.role !== "ADMINISTRATOR") {
    throw new Error(await message("errors.adminOnly"));
  }
  return context;
}

/**
 * Confirms a task belongs to the caller's workspace before it is mutated.
 * Returns the task's current state, which actions use to write accurate
 * activity entries.
 */
export async function assertTaskInWorkspace(taskId: string, workspaceId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, workspaceId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      ownerMemberId: true,
      spaceId: true,
      confirmedByHuman: true,
    },
  });
  if (!task) throw new Error(await message("errors.task.gone"));
  return task;
}

/**
 * Confirms a step belongs to a task in the caller's workspace.
 *
 * The workspace filter goes through the task, because `subtasks` carries no
 * workspace of its own — the task is what it belongs to, and that is the only
 * tenancy there is to check.
 */
export async function assertSubtaskInWorkspace(subtaskId: string, workspaceId: string) {
  const subtask = await db.subtask.findFirst({
    where: { id: subtaskId, task: { workspaceId } },
    select: {
      id: true,
      title: true,
      done: true,
      taskId: true,
      task: { select: { title: true } },
    },
  });
  if (!subtask) throw new Error(await message("errors.subtask.gone"));
  return subtask;
}

export async function assertMeetingInWorkspace(meetingId: string, workspaceId: string) {
  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, workspaceId },
    select: { id: true, title: true, status: true },
  });
  if (!meeting) throw new Error(await message("errors.meeting.gone"));
  return meeting;
}

/**
 * Confirms a space id names a section of the caller's workspace.
 *
 * Filing a task into a section from another workspace would be a quiet
 * cross-tenant leak — the task would appear on a board its owners never
 * opened — so the id is checked on every write that carries one.
 */
export async function assertSpaceInWorkspace(spaceId: string, workspaceId: string) {
  const space = await db.space.findFirst({
    where: { id: spaceId, workspaceId },
    select: { id: true, name: true },
  });
  if (!space) throw new Error(await message("errors.space.gone"));
  return space;
}

/** Confirms a member id names someone in the caller's workspace. */
export async function assertMemberInWorkspace(memberId: string, workspaceId: string) {
  const member = await db.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!member) throw new Error(await message("errors.member.notInWorkspace"));
  return member;
}
