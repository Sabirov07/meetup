import { z } from "zod";
import { TASK_CATEGORIES, TASK_PRIORITIES } from "@/shared/domain/types";
import { EFFORTS, SKETCH_ACTORS, SKETCH_BLOCKS } from "@/shared/domain/sketch";

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

// ---------------------------------------------------------------------------
// Discussion: answering an @ai mention
// ---------------------------------------------------------------------------

/**
 * The contract for an answer in a task discussion.
 *
 * Shaped like the two schemas above — nothing optional, nothing nullable — for
 * the same reason: a model held to a schema says "none" far more reliably with
 * an empty array than with an absent key. `wantsSketch` is the one flag that
 * governs a whole sub-object, so the model can decline to draw without having
 * to produce a convincing empty drawing.
 *
 * The block vocabulary comes from `shared/domain/sketch.ts`, so the set the
 * model may choose from and the set the renderer can draw are the same list.
 */
const sketchBlockSchema = z.object({
  kind: z.enum(SKETCH_BLOCKS).describe("The part of the screen this is."),
  label: z
    .string()
    .describe("What this part is called, two or three words. Not a sentence."),
  lines: z
    .array(z.string())
    .describe(
      "What is inside it — rows, fields, columns, tiles — each in a few words. Two to five of them. Real content from this task, never 'Item 1'.",
    ),
  emphasis: z
    .boolean()
    .describe("True for the one block the screen exists for. At most one per screen."),
});

const sketchScreenSchema = z.object({
  title: z.string().describe("The screen's name, two or three words."),
  caption: z.string().describe("What the person is doing here, in one short line."),
  blocks: z.array(sketchBlockSchema).describe("Two to five blocks, in the order they appear."),
});

const sketchStepSchema = z.object({
  actor: z
    .enum(SKETCH_ACTORS)
    .describe("PERSON when someone acts, SYSTEM when the app does, AI for a model step."),
  label: z.string().describe("The step, in a few words."),
  detail: z.string().describe("What happens, or what it waits on. One sentence."),
});

const sketchSchema = z.object({
  title: z.string().describe("What the drawing shows. Empty when wantsSketch is false."),
  caption: z.string().describe("One line of context under the title."),
  screens: z
    .array(sketchScreenSchema)
    .describe("One to three screens. Empty when wantsSketch is false."),
  flow: z
    .array(sketchStepSchema)
    .describe("Three to six steps end to end. Empty when there is no sequence worth drawing."),
});

export const adviceSchema = z.object({
  reply: z
    .string()
    .describe(
      "The answer itself, in Markdown — headings, short paragraphs, lists. Address the people in the thread directly and answer what they actually asked. No preamble, no restating the question, no sign-off.",
    ),
  recommendations: z
    .array(
      z.object({
        title: z.string().describe("The recommendation as an instruction, under 70 characters."),
        detail: z.string().describe("Why, and what it means in practice. One to three sentences."),
        effort: z.enum(EFFORTS).describe("SMALL is hours, MEDIUM is days, LARGE is a week or more."),
        tradeoff: z
          .string()
          .describe("What this costs or gives up, in one line. Empty when there is nothing to trade."),
      }),
    )
    .describe("Two to five, strongest first. Empty when the question was not asking for advice."),
  risks: z
    .array(z.string())
    .describe(
      "What goes wrong if this is built the obvious way — each a specific failure, not a platitude. Empty when there is nothing real to flag.",
    ),
  openQuestions: z
    .array(z.string())
    .describe(
      "What the team has to settle before this can be built, each addressed to them. Empty when nothing is genuinely unresolved.",
    ),
  wantsSketch: z
    .boolean()
    .describe(
      "True only when an interface or a sequence is being decided and a drawing would settle something words cannot.",
    ),
  sketch: sketchSchema,
});

export type ExtractedAdvice = z.infer<typeof adviceSchema>;
