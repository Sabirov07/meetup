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

// ---------------------------------------------------------------------------
// Free-text intake
// ---------------------------------------------------------------------------

/**
 * The contract for turning a pasted brief into assigned tasks.
 *
 * It mirrors the transcript schema on purpose — same evidence levels, same
 * opaque owner key — because the review step makes the same promise in both
 * places: you can always see how much of this the model read and how much it
 * decided for itself.
 *
 * As there, nothing is nullable or optional. A model constrained to a schema
 * answers an "unknown" far more reliably with an empty string or a zero than
 * with an absent key, and the action turns those back into nulls.
 */
export const draftedTaskSchema = z.object({
  title: z
    .string()
    .describe("An imperative task title, under 90 characters. No trailing period."),
  description: z
    .string()
    .describe(
      "One to three sentences of context, drawn only from the brief. Say what done looks like when the brief says so.",
    ),
  ownerKey: ownerKey.describe(
    "The participant key of the person who should own this, or 'UNASSIGNED' when there is no reasonable way to choose.",
  ),
  ownerEvidence: evidence.describe(
    "CONFIRMED when the brief names this person for this work. INFERRED when their stated job title or the surrounding context points at them. RECOMMENDED when this is a sensible distribution of work rather than something the brief says.",
  ),
  ownerRationale: z
    .string()
    .describe(
      "Why this person, in one sentence, in the second person where it helps ('the brief names Ann for the migration'). Say plainly when it is a guess.",
    ),
  priority: z.enum(TASK_PRIORITIES),
  priorityRationale: z
    .string()
    .describe("One short sentence explaining the priority, or an empty string for a plain MEDIUM."),
  dueDate: z
    .string()
    .describe(
      "An ISO date (YYYY-MM-DD) when the brief gives a date or a clear relative deadline, resolved against today. An empty string otherwise. Never invent a date.",
    ),
  category: z.enum(TASK_CATEGORIES),
  labels: z.array(z.string()).describe("Up to three short lowercase labels."),
  estimateHours: z
    .number()
    .describe(
      "Rough size in hours when the brief states or clearly implies one, otherwise 0. Never guess an estimate the brief does not support.",
    ),
  sourceExcerpt: z
    .string()
    .describe("A short verbatim quote from the brief that this task came from."),
  openQuestion: z
    .string()
    .describe(
      "The one thing a person has to settle before this task is actionable, or an empty string when nothing is unclear.",
    ),
  needsReview: z
    .boolean()
    .describe(
      "True when the owner, the deadline or the scope is genuinely unclear and a person should decide.",
    ),
});

export const breakdownSchema = z.object({
  summary: z
    .string()
    .describe(
      "One or two sentences saying what the brief asked for and how the work was divided. Factual, no praise.",
    ),
  drafts: z.array(draftedTaskSchema),
  leftovers: z
    .array(z.string())
    .describe(
      "Parts of the brief that are context, opinion or already done rather than work to do, each in a few words. Empty when everything became a task.",
    ),
});

export type ExtractedBreakdown = z.infer<typeof breakdownSchema>;
export type DraftedTask = z.infer<typeof draftedTaskSchema>;
