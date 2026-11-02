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

/** Resolves the signed-in person and their active workspace, or null. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const user = await resolveUserFromCookie();
  if (!user) return null;

  const preference = await db.userPreference.findUnique({
    where: { userId: user.id },
    select: { lastWorkspaceId: true },
  });

  const membership =
    (preference?.lastWorkspaceId
      ? await db.workspaceMember.findFirst({
          where: { userId: user.id, workspaceId: preference.lastWorkspaceId },
          select: { ...memberSelect, workspaceId: true },
        })
      : null) ??
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
      confirmedByHuman: true,
    },
  });
  if (!task) throw new Error(await message("errors.task.gone"));
  return task;
}

export async function assertMeetingInWorkspace(meetingId: string, workspaceId: string) {
  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, workspaceId },
    select: { id: true, title: true, status: true },
  });
  if (!meeting) throw new Error(await message("errors.meeting.gone"));
  return meeting;
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
