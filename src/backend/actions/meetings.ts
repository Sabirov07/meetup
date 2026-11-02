"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/backend/db";
import {
  assertMeetingInWorkspace,
  requireSessionForAction,
} from "@/backend/auth/guards";
import { getMeeting } from "@/backend/data/meetings";
import { isMeetUrl } from "@/backend/google/config";
import { createSpace } from "@/backend/google/meet";
import { GoogleNotConfiguredError, GoogleNotConnectedError } from "@/backend/google/oauth";
import type { MeetingView } from "@/shared/domain/types";
import { fail, guarded, logActivity, ok, type ActionResult } from "./shared";

const createInput = z.object({
  title: z.string().trim().min(3, "Give the meeting a title.").max(160),
  /** `google` asks Google for a real space; `link` stores a link you provide. */
  mode: z.enum(["google", "link", "none"]),
  meetUrl: z.string().trim().optional(),
  scheduledAt: z.string().optional(),
  participantMemberIds: z.array(z.string()).max(50).default([]),
  guestEmails: z.array(z.string().trim().email()).max(50).default([]),
});

export type CreateMeetingInput = z.input<typeof createInput>;

export async function createMeeting(
  raw: CreateMeetingInput,
): Promise<ActionResult<MeetingView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = createInput.safeParse(raw);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "That meeting is not valid.");
    }
    const input = parsed.data;

    let meetUrl: string | null = null;
    let googleSpaceId: string | null = null;
    let source: "MANUAL" | "GOOGLE_MEET" = "MANUAL";

    if (input.mode === "google") {
      // A real API call or a clear error. There is no third option here —
      // the app never produces a plausible-looking fake meet.google.com URL.
      try {
        const space = await createSpace(session.userId);
        meetUrl = space.meetingUri;
        googleSpaceId = space.name;
        source = "GOOGLE_MEET";
      } catch (error) {
        if (error instanceof GoogleNotConfiguredError) {
          return fail(
            "Google Meet is not configured on the server yet. Add a link manually, or set the Google credentials in Settings.",
          );
        }
        if (error instanceof GoogleNotConnectedError) {
          return fail("Connect your Google account in Settings first.");
        }
        return fail(
          error instanceof Error
            ? `Google could not create the meeting: ${error.message}`
            : "Google could not create the meeting.",
        );
      }
    } else if (input.mode === "link") {
      if (!input.meetUrl) return fail("Paste the meeting link.");
      if (!isMeetUrl(input.meetUrl)) {
        return fail("That does not look like a Google Meet link (meet.google.com).");
      }
      meetUrl = input.meetUrl;
    }

    // Validate every participant belongs to this workspace before writing.
    const members = await db.workspaceMember.findMany({
      where: { id: { in: input.participantMemberIds }, workspaceId: session.workspace.id },
      select: { id: true, user: { select: { name: true, email: true } } },
    });

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();

    const meeting = await db.meeting.create({
      data: {
        workspaceId: session.workspace.id,
        title: input.title,
        source,
        status: meetUrl ? "READY_TO_JOIN" : "SCHEDULED",
        scheduledAt: Number.isNaN(scheduledAt.getTime()) ? new Date() : scheduledAt,
        meetUrl,
        googleSpaceId,
        createdByMemberId: session.member.id,
        participants: {
          create: [
            ...members.map((m) => ({
              memberId: m.id,
              displayName: m.user.name,
              email: m.user.email,
              speakerLabel: m.user.name,
            })),
            ...input.guestEmails.map((email) => ({
              displayName: email.split("@")[0] ?? email,
              email,
            })),
          ],
        },
      },
      select: { id: true },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEETING_CREATED",
      summary: `scheduled “${input.title}”`,
      meetingId: meeting.id,
    });

    const view = await getMeeting(meeting.id, session.workspace.id);
    if (!view) return fail("The meeting was created but could not be read back.");
    refresh();
    return ok(view);
  });
}

const statusInput = z.object({
  id: z.string().min(1),
  status: z.enum([
    "SCHEDULED",
    "READY_TO_JOIN",
    "IN_PROGRESS",
    "AWAITING_TRANSCRIPT",
    "PROCESSING",
    "REVIEW_REQUIRED",
    "COMPLETED",
    "FAILED",
  ]),
});

export async function setMeetingStatus(
  raw: z.input<typeof statusInput>,
): Promise<ActionResult<MeetingView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = statusInput.safeParse(raw);
    if (!parsed.success) return fail("That status is not valid.");

    const meeting = await assertMeetingInWorkspace(parsed.data.id, session.workspace.id);

    await db.meeting.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
        ...(parsed.data.status === "AWAITING_TRANSCRIPT" || parsed.data.status === "COMPLETED"
          ? { endedAt: new Date() }
          : {}),
      },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEETING_UPDATED",
      summary: `marked “${meeting.title}” as ${parsed.data.status.toLowerCase().replace(/_/g, " ")}`,
      meetingId: parsed.data.id,
    });

    const view = await getMeeting(parsed.data.id, session.workspace.id);
    if (!view) return fail("That meeting no longer exists.");
    refresh();
    return ok(view);
  });
}

/**
 * Stores a transcript the user supplied themselves.
 *
 * This exists so the analysis pipeline is genuinely usable before the Google
 * integration is configured — you can copy a transcript out of Meet, Zoom or
 * anywhere else and get real extraction. It is recorded as `source: MANUAL`,
 * so nothing claims it came from Google.
 */
export async function saveManualTranscript(input: {
  meetingId: string;
  content: string;
}): Promise<ActionResult<MeetingView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const content = input.content.trim();
    if (content.length < 40) {
      return fail("That transcript is too short to be useful.");
    }
    if (content.length > 400_000) {
      return fail("That transcript is too large. Trim it to the relevant part.");
    }

    const meeting = await assertMeetingInWorkspace(input.meetingId, session.workspace.id);

    await db.transcript.upsert({
      where: { meetingId: input.meetingId },
      update: {
        content,
        status: "READY",
        source: "MANUAL",
        fetchedAt: new Date(),
        failureReason: null,
      },
      create: {
        meetingId: input.meetingId,
        content,
        status: "READY",
        source: "MANUAL",
        fetchedAt: new Date(),
      },
    });

    await db.meeting.update({
      where: { id: input.meetingId },
      data: { status: "PROCESSING", endedAt: meeting.status === "COMPLETED" ? undefined : new Date() },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "TRANSCRIPT_READY",
      summary: `added a transcript to “${meeting.title}”`,
      meetingId: input.meetingId,
      metadata: { source: "MANUAL" },
    });

    const view = await getMeeting(input.meetingId, session.workspace.id);
    if (!view) return fail("That meeting no longer exists.");
    refresh();
    return ok(view);
  });
}

export async function deleteMeeting(id: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const meeting = await assertMeetingInWorkspace(id, session.workspace.id);
    await db.meeting.delete({ where: { id } });
    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "MEETING_UPDATED",
      summary: `deleted the meeting “${meeting.title}”`,
    });
    refresh();
    return ok(undefined);
  });
}

/**
 * Returns the stored transcript text for a meeting.
 *
 * Transcripts are not included in list payloads — they are the most sensitive
 * thing in the workspace — so the detail view fetches one on demand, after the
 * same workspace-membership check as every other read.
 */
export async function getTranscriptText(
  meetingId: string,
): Promise<ActionResult<{ content: string; source: "MANUAL" | "GOOGLE_MEET"; fetchedAt: string | null }>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    await assertMeetingInWorkspace(meetingId, session.workspace.id);

    const transcript = await db.transcript.findUnique({
      where: { meetingId },
      select: { content: true, source: true, fetchedAt: true },
    });

    if (!transcript?.content) return fail("No transcript is stored for this meeting.");

    return ok({
      content: transcript.content,
      source: transcript.source,
      fetchedAt: transcript.fetchedAt?.toISOString() ?? null,
    });
  });
}
