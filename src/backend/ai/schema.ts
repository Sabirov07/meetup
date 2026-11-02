import { z } from "zod";
import { TASK_CATEGORIES, TASK_PRIORITIES } from "@/shared/domain/types";

/**
 * The contract for transcript analysis.
 *
 * This schema is enforced two ways: the model is constrained to it via
 * structured outputs, and the parsed result is validated again before anything
 * is written to the database. Nothing reaches `task_proposals` unvalidated.
 */

const evidence = z.enum(["CONFIRMED", "INFERRED", "RECOMMENDED"]);

/**
 * Owner is returned as an opaque key rather than a name, so the model cannot
 * invent a person. `SHARED` and `UNASSIGNED` are the only other legal values,
 * and both force human review.
 */
const ownerKey = z.string();

export const extractedTaskSchema = z.object({
  title: z
    .string()
    .describe("An imperative task title, under 90 characters. No trailing period."),
  description: z
    .string()
    .describe("One or two sentences of context drawn only from the transcript."),
  ownerKey: ownerKey.describe(
    "The participant key of the person who owns this, or 'SHARED' when the transcript says two or more people will do it together, or 'UNASSIGNED' when the transcript does not say who owns it.",
  ),
  ownerEvidence: evidence.describe(
    "CONFIRMED when a speaker explicitly accepted or claimed the work. INFERRED when ownership is read from surrounding context. RECOMMENDED when nobody was named and this is a guess.",
  ),
  ownerRationale: z
    .string()
    .describe("Why this owner, in one sentence. Say plainly when it is uncertain."),
  isExplicitCommitment: z
    .boolean()
    .describe(
      "True only when someone said they would do this ('I'll do X', 'leave it with me') or explicitly accepted it when asked.",
    ),
  priority: z.enum(TASK_PRIORITIES),
  priorityEvidence: evidence.describe(
    "CONFIRMED only when urgency was stated in the conversation. Otherwise RECOMMENDED.",
  ),
  priorityRationale: z.string().describe("One sentence explaining the priority."),
  dueDate: z
    .string()
    .describe(
      "An ISO date (YYYY-MM-DD) if a date or clear relative deadline was given, otherwise an empty string. Never invent a date.",
    ),
  dueDateEvidence: evidence,
  category: z.enum(TASK_CATEGORIES),
  labels: z.array(z.string()).describe("Up to three short lowercase labels."),
  transcriptExcerpt: z
    .string()
    .describe("A short verbatim quote from the transcript that supports this task."),
  blockers: z
    .array(z.string())
    .describe("Anything the transcript says must happen first. Empty when none."),
  dependsOnTitles: z
    .array(z.string())
    .describe("Titles of other tasks in this same response that must finish first."),
  needsReview: z
    .boolean()
    .describe(
      "True when the owner, the deadline or the scope is genuinely unclear and a person should decide.",
    ),
});

export const analysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "A factual 2–4 sentence summary of what the conversation covered and where it landed.",
    ),
  decisions: z
    .array(
      z.object({
        text: z.string().describe("The decision, stated plainly."),
        evidence: evidence,
        excerpt: z.string().describe("Verbatim supporting quote."),
      }),
    )
    .describe("Things that were actually settled. Empty when nothing was decided."),
  openQuestions: z
    .array(
      z.object({
        text: z.string().describe("A question the conversation left unresolved."),
        excerpt: z.string(),
      }),
    )
    .describe("Questions a person still needs to answer."),
  tasks: z.array(extractedTaskSchema),
});

export type ExtractedAnalysis = z.infer<typeof analysisSchema>;
export type ExtractedTask = z.infer<typeof extractedTaskSchema>;
