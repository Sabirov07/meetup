"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertMeetingInWorkspace, requireSessionForAction } from "@/lib/auth/guards";
import { getMeeting } from "@/lib/data/meetings";
import { getTask } from "@/lib/data/tasks";
import { AiNotConfiguredError, analyseTranscript, isAiConfigured } from "@/lib/ai/extract";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  type MeetingView,
  type TaskView,
} from "@/lib/domain/types";
import { fail, guarded, logActivity, ok, parseDateInput, type ActionResult } from "./shared";

/**
 * Runs the model over a stored transcript and records the result as proposals.
 *
 * Nothing here writes to `tasks`. Proposals become tasks only when a person
 * approves them, which is what keeps "AI suggested" and "we agreed" distinct.
 */
export async function analyseMeeting(meetingId: string): Promise<ActionResult<MeetingView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const meeting = await assertMeetingInWorkspace(meetingId, session.workspace.id);

    if (!isAiConfigured()) {
      return fail(
        "Transcript analysis needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the server.",
      );
    }

    const transcript = await db.transcript.findUnique({
      where: { meetingId },
      select: { content: true, status: true },
    });

    if (!transcript?.content) {
      return fail(
        "There is no transcript stored for this meeting yet, so there is nothing to analyse.",
      );
    }
    if (transcript.status !== "READY") {
      return fail("The transcript is not ready yet.");
    }

    const full = await db.meeting.findUnique({
      where: { id: meetingId },
      select: { title: true, scheduledAt: true, endedAt: true },
    });

    await db.meetingAnalysis.upsert({
      where: { meetingId },
      update: { status: "RUNNING", startedAt: new Date(), failureReason: null, isSample: false },
      create: { meetingId, status: "RUNNING", startedAt: new Date() },
    });
    await db.meeting.update({ where: { id: meetingId }, data: { status: "PROCESSING" } });

    try {
      const result = await analyseTranscript({
        transcript: transcript.content,
        meetingTitle: full?.title ?? meeting.title,
        meetingDate: (full?.endedAt ?? full?.scheduledAt ?? new Date())
          .toISOString()
          .slice(0, 10),
        members: session.workspace.members,
      });

      const analysis = await db.meetingAnalysis.update({
        where: { meetingId },
        data: {
          status: "COMPLETED",
          summary: result.analysis.summary,
          decisions: result.analysis.decisions as never,
          openQuestions: result.analysis.openQuestions as never,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          failureReason: null,
          isSample: false,
        },
        select: { id: true },
      });

      // Replace any previous un-reviewed proposals for this meeting. Approved
      // and rejected ones are decisions a person made, so they stay.
      await db.taskProposal.deleteMany({ where: { meetingId, status: "PENDING" } });

      for (const task of result.analysis.tasks) {
        const ownerMemberId = result.resolveOwner(task.ownerKey);
        const unresolvedOwner = ownerMemberId === null;

        await db.taskProposal.create({
          data: {
            meetingId,
            analysisId: analysis.id,
            title: task.title.slice(0, 200),
            description: task.description || null,
            suggestedOwnerMemberId: ownerMemberId,
            ownerEvidence: unresolvedOwner ? "RECOMMENDED" : task.ownerEvidence,
            ownerRationale: task.ownerRationale || null,
            isExplicitCommitment: task.isExplicitCommitment,
            suggestedPriority: task.priority,
            priorityEvidence: task.priorityEvidence,
            priorityRationale: task.priorityRationale || null,
            suggestedDueDate: task.dueDate || null,
            dueDateEvidence: task.dueDateEvidence,
            category: task.category,
            labels: task.labels.slice(0, 3),
            transcriptExcerpt: task.transcriptExcerpt || null,
            blockers: task.blockers,
            dependsOnTitles: task.dependsOnTitles,
            // An unresolved owner always needs a person, whatever the model said.
            needsReview: task.needsReview || unresolvedOwner,
            status: "PENDING",
            isSample: false,
          },
        });
      }

      await db.meeting.update({
        where: { id: meetingId },
        data: { status: result.analysis.tasks.length > 0 ? "REVIEW_REQUIRED" : "COMPLETED" },
      });

      await logActivity({
        workspaceId: session.workspace.id,
        actorMemberId: session.member.id,
        type: "ANALYSIS_COMPLETED",
        summary: `analysed “${meeting.title}” — ${result.analysis.tasks.length} ${
          result.analysis.tasks.length === 1 ? "task" : "tasks"
        } proposed`,
        meetingId,
        metadata: { model: result.model, tasks: result.analysis.tasks.length },
      });
    } catch (error) {
      const message =
        error instanceof AiNotConfiguredError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The analysis failed.";

      await db.meetingAnalysis.update({
        where: { meetingId },
        data: { status: "FAILED", failureReason: message },
      });
      await db.meeting.update({ where: { id: meetingId }, data: { status: "FAILED" } });
      return fail(message);
    }

    const view = await getMeeting(meetingId, session.workspace.id);
    if (!view) return fail("That meeting no longer exists.");
    refresh();
    return ok(view);
  });
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

const approveInput = z.object({
  proposalId: z.string().min(1),
  /** Human edits applied at approval time; these win over the model's values. */
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  ownerMemberId: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  dueDate: z.string().nullable().optional(),
});

export type ApproveProposalInput = z.input<typeof approveInput>;

export async function approveProposal(
  raw: ApproveProposalInput,
): Promise<ActionResult<TaskView>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const parsed = approveInput.safeParse(raw);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "That approval is not valid.");
    }
    const input = parsed.data;

    const proposal = await db.taskProposal.findFirst({
      where: { id: input.proposalId, meeting: { workspaceId: session.workspace.id } },
      select: {
        id: true,
        meetingId: true,
        title: true,
        description: true,
        suggestedOwnerMemberId: true,
        suggestedPriority: true,
        suggestedDueDate: true,
        category: true,
        labels: true,
        transcriptExcerpt: true,
        priorityRationale: true,
        dependsOnTitles: true,
        status: true,
        createdTaskId: true,
      },
    });

    if (!proposal) return fail("That proposal no longer exists.");
    if (proposal.status === "APPROVED" && proposal.createdTaskId) {
      const existing = await getTask(proposal.createdTaskId, session.workspace.id);
      if (existing) return ok(existing);
    }

    const ownerMemberId =
      input.ownerMemberId !== undefined ? input.ownerMemberId : proposal.suggestedOwnerMemberId;

    if (ownerMemberId) {
      const member = await db.workspaceMember.findFirst({
        where: { id: ownerMemberId, workspaceId: session.workspace.id },
        select: { id: true },
      });
      if (!member) return fail("That person is not a member of this workspace.");
    }

    const dueDateValue =
      input.dueDate !== undefined ? input.dueDate : proposal.suggestedDueDate;

    const task = await db.task.create({
      data: {
        workspaceId: session.workspace.id,
        title: input.title ?? proposal.title,
        description:
          input.description !== undefined ? input.description : proposal.description,
        ownerMemberId,
        creatorMemberId: session.member.id,
        status: "TODO",
        priority: input.priority ?? proposal.suggestedPriority,
        category: input.category ?? proposal.category,
        labels: proposal.labels,
        dueDate: parseDateInput(dueDateValue),
        // Keep what the model wanted, separately from what the human chose.
        aiSuggestedPriority: proposal.suggestedPriority,
        aiPriorityRationale: proposal.priorityRationale,
        isAiGenerated: true,
        // A person approved this, so later re-analysis must not overwrite it.
        confirmedByHuman: true,
        needsReview: false,
        sourceMeetingId: proposal.meetingId,
        sourceExcerpt: proposal.transcriptExcerpt,
      },
      select: { id: true, title: true },
    });

    await db.taskProposal.update({
      where: { id: proposal.id },
      data: {
        status: "APPROVED",
        reviewedByMemberId: session.member.id,
        reviewedAt: new Date(),
        createdTaskId: task.id,
        needsReview: false,
      },
    });

    // Resolve dependencies by title against tasks from the same meeting.
    if (proposal.dependsOnTitles.length > 0) {
      const candidates = await db.task.findMany({
        where: { workspaceId: session.workspace.id, id: { not: task.id } },
        select: { id: true, title: true },
      });
      for (const wanted of proposal.dependsOnTitles) {
        const match = candidates.find(
          (c) => c.title.toLowerCase().trim() === wanted.toLowerCase().trim(),
        );
        if (!match) continue;
        await db.taskDependency.upsert({
          where: { taskId_dependsOnTaskId: { taskId: task.id, dependsOnTaskId: match.id } },
          create: { taskId: task.id, dependsOnTaskId: match.id },
          update: {},
        });
      }
    }

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "PROPOSAL_APPROVED",
      summary: `approved “${task.title}” from a meeting`,
      taskId: task.id,
      meetingId: proposal.meetingId,
    });

    await settleMeetingStatus(proposal.meetingId);

    const view = await getTask(task.id, session.workspace.id);
    if (!view) return fail("The task was created but could not be read back.");
    refresh();
    return ok(view);
  });
}

export async function rejectProposal(proposalId: string): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const session = await requireSessionForAction();
    const proposal = await db.taskProposal.findFirst({
      where: { id: proposalId, meeting: { workspaceId: session.workspace.id } },
      select: { id: true, title: true, meetingId: true },
    });
    if (!proposal) return fail("That proposal no longer exists.");

    await db.taskProposal.update({
      where: { id: proposalId },
      data: {
        status: "REJECTED",
        reviewedByMemberId: session.member.id,
        reviewedAt: new Date(),
        needsReview: false,
      },
    });

    await logActivity({
      workspaceId: session.workspace.id,
      actorMemberId: session.member.id,
      type: "PROPOSAL_REJECTED",
      summary: `rejected the proposed task “${proposal.title}”`,
      meetingId: proposal.meetingId,
    });

    await settleMeetingStatus(proposal.meetingId);
    refresh();
    return ok(undefined);
  });
}

/** Approves several proposals as they stand. Returns how many succeeded. */
export async function approveProposals(
  proposalIds: string[],
): Promise<ActionResult<{ approved: number; failed: number }>> {
  return guarded(async () => {
    await requireSessionForAction();
    let approved = 0;
    let failed = 0;
    for (const id of proposalIds.slice(0, 50)) {
      const result = await approveProposal({ proposalId: id });
      if (result.ok) approved++;
      else failed++;
    }
    refresh();
    return ok({ approved, failed });
  });
}

/** Moves a meeting to COMPLETED once nothing is left to review. */
async function settleMeetingStatus(meetingId: string): Promise<void> {
  const pending = await db.taskProposal.count({ where: { meetingId, status: "PENDING" } });
  await db.meeting.update({
    where: { id: meetingId },
    data: { status: pending > 0 ? "REVIEW_REQUIRED" : "COMPLETED" },
  });
}
