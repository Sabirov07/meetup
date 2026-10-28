import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { analysisSchema, type ExtractedAnalysis } from "./schema";
import type { MemberSummary } from "@/lib/domain/types";

/**
 * Transcript analysis.
 *
 * The prompt's whole job is to keep the model honest about three things:
 * who owns a task, how sure it is, and what in the transcript says so. It is
 * told explicitly not to assign ownership by the flavour of the work, because
 * that is the failure mode that produces plausible-looking wrong answers
 * ("it's technical, so it must be the engineer's").
 */

export const ANALYSIS_MODEL = "claude-opus-5";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set, so transcripts cannot be analysed.");
    this.name = "AiNotConfiguredError";
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  return new Anthropic({ apiKey });
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `You extract commitments from work conversations.

Your output is reviewed by the people who had the conversation, so being
transparently uncertain is far more useful than sounding confident. A wrong
owner or an invented deadline costs them real trust.

Rules, in order of importance:

1. Ground everything in the transcript. Every task carries a verbatim excerpt.
   If you cannot quote something that supports a task, do not create the task.

2. Never assign ownership by the kind of work. "This sounds technical so the
   engineer owns it" is exactly the mistake to avoid. Ownership comes only from
   who said what:
   - Someone says "I'll do X" or "leave it with me" -> they own it,
     ownerEvidence CONFIRMED, isExplicitCommitment true.
   - Someone is asked "can you do X" and agrees -> they own it, CONFIRMED.
   - Someone is asked and does not clearly agree -> ownerEvidence INFERRED,
     and set needsReview true.
   - The transcript says a thing must happen but names nobody -> ownerKey
     UNASSIGNED, ownerEvidence RECOMMENDED, needsReview true.
   - "We should decide", "let's figure it out together" -> ownerKey SHARED,
     needsReview true.

3. Never invent a deadline. A date goes in dueDate only when the transcript
   gives one, including clear relative dates like "by Friday" or "end of the
   month" resolved against the meeting date. Otherwise dueDate is an empty
   string and dueDateEvidence is RECOMMENDED.

4. Priority is CONFIRMED only when urgency was actually voiced ("this is
   blocking everything", "before the demo"). Otherwise RECOMMENDED. Do not
   mark everything high. Most tasks are MEDIUM.

5. Separate decisions from tasks. A decision is something settled. A task is
   something still to do. An unresolved question is neither — it goes in
   openQuestions.

6. Do not merge two distinct commitments into one task, and do not split one
   commitment into several. Prefer fewer, well-formed tasks.`;

function buildUserPrompt(input: {
  transcript: string;
  meetingTitle: string;
  meetingDate: string;
  participants: { key: string; name: string; role: string }[];
}): string {
  const roster = input.participants
    .map((p) => `  ${p.key} = ${p.name} (${p.role})`)
    .join("\n");

  return `Meeting: ${input.meetingTitle}
Date: ${input.meetingDate}

Participants — use these keys for ownerKey, or SHARED / UNASSIGNED:
${roster}

Transcript:
"""
${input.transcript}
"""

Extract the summary, decisions, open questions and tasks.`;
}

export type AnalysisResult = {
  analysis: ExtractedAnalysis;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Maps an ownerKey back to a member id, or null for SHARED / UNASSIGNED. */
  resolveOwner: (ownerKey: string) => string | null;
};

export async function analyseTranscript(input: {
  transcript: string;
  meetingTitle: string;
  meetingDate: string;
  members: MemberSummary[];
}): Promise<AnalysisResult> {
  if (input.transcript.trim().length < 40) {
    throw new Error("The transcript is too short to analyse.");
  }

  const client = getClient();

  // Opaque keys keep the model from inventing a participant.
  const participants = input.members.map((m, i) => ({
    key: `participant_${i + 1}`,
    name: m.name,
    role: m.role === "ADMINISTRATOR" ? "workspace administrator" : "workspace member",
    memberId: m.id,
  }));
  const keyToMemberId = new Map(participants.map((p) => [p.key, p.memberId]));

  const response = await client.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: buildUserPrompt({
          transcript: input.transcript,
          meetingTitle: input.meetingTitle,
          meetingDate: input.meetingDate,
          participants,
        }),
      },
    ],
    output_config: { format: zodOutputFormat(analysisSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to analyse this transcript.");
  }

  // `parsed_output` is null when the response could not be parsed against the
  // schema. Validating again is belt and braces, and it is cheap.
  if (!response.parsed_output) {
    throw new Error("The model's response did not match the expected schema.");
  }
  const analysis = analysisSchema.parse(response.parsed_output);

  return {
    analysis,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    resolveOwner: (ownerKey) => keyToMemberId.get(ownerKey) ?? null,
  };
}
