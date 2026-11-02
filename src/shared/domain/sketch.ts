/**
 * The drawing the assistant answers with: screens, and the path through them.
 *
 * When someone asks `@ai` how to build something, the useful part of the answer
 * is often not a paragraph — it is what the screen looks like and what happens
 * in which order. So the model does not return a picture and it does not return
 * markup: it returns this structure, and the app draws it with ordinary React
 * elements, in the workspace's own type scale and colours.
 *
 * That is a deliberate trade against image generation and against inline SVG:
 *
 *  * the sketch is readable in both themes, at any width, and stays legible
 *    when the palette changes, because it is drawn from the same tokens as the
 *    rest of the product rather than baked into pixels;
 *  * nothing the model produces reaches the DOM as markup. A model that emits
 *    `<script>` in a label emits text, exactly as a pasted task body does — the
 *    same reasoning that keeps `shared/doc/markdown.ts` away from HTML;
 *  * every field is text the UI places, so a sketch can be read by a screen
 *    reader instead of being an opaque image.
 *
 * The block kinds are a closed set on purpose. A fixed vocabulary is what lets
 * each one be drawn properly — a table that looks like a table, a form that
 * looks like a form — and it keeps the model choosing from a menu rather than
 * inventing layout primitives the renderer has never heard of.
 */

export const SKETCH_BLOCKS = [
  /** Page title and its supporting line. */
  "header",
  /** Filters, search, segmented controls — a row of controls. */
  "toolbar",
  /** Tabs or a side navigation list. */
  "nav",
  /** A vertical list of rows. */
  "list",
  /** A grid of cards or tiles. */
  "cards",
  /** Columns with a header row. */
  "table",
  /** Labelled fields someone fills in. */
  "form",
  /** A single record laid out as properties. */
  "detail",
  /** A chart or a row of numbers. */
  "chart",
  /** A message where content would be, before there is any. */
  "empty",
  /** A callout, warning or confirmation strip. */
  "banner",
  /** Actions at the bottom of the screen. */
  "actions",
] as const;

export type SketchBlockKind = (typeof SKETCH_BLOCKS)[number];

export type SketchBlock = {
  kind: SketchBlockKind;
  /** What this part of the screen is called, in two or three words. */
  label: string;
  /** The rows, fields, columns or tiles inside it. */
  lines: string[];
  /** The one thing the screen is really about, drawn with the accent. */
  emphasis: boolean;
};

export type SketchScreen = {
  title: string;
  /** What the person is doing here, in one line. */
  caption: string;
  blocks: SketchBlock[];
};

export const SKETCH_ACTORS = ["PERSON", "SYSTEM", "AI"] as const;
export type SketchActor = (typeof SKETCH_ACTORS)[number];

export type SketchStep = {
  actor: SketchActor;
  /** The step itself, in a few words. */
  label: string;
  /** What happens, or what it depends on. One sentence. */
  detail: string;
};

export type Sketch = {
  title: string;
  caption: string;
  screens: SketchScreen[];
  flow: SketchStep[];
};

export const EFFORTS = ["SMALL", "MEDIUM", "LARGE"] as const;
export type Effort = (typeof EFFORTS)[number];

export type Recommendation = {
  title: string;
  detail: string;
  effort: Effort;
  /** What this costs or gives up. Empty when there is nothing to trade. */
  tradeoff: string;
};

/**
 * The structured half of an assistant answer. The prose half is the message
 * body, in the same Markdown the task document uses.
 */
export type Advice = {
  recommendations: Recommendation[];
  risks: string[];
  openQuestions: string[];
  /** Null when the question did not call for a drawing. */
  sketch: Sketch | null;
};

/** True when there is a drawing worth showing. */
export function hasSketch(sketch: Sketch | null | undefined): sketch is Sketch {
  return Boolean(sketch && (sketch.screens.length > 0 || sketch.flow.length > 0));
}

/** True when the structured half holds anything at all. */
export function hasAdvice(advice: Advice | null | undefined): advice is Advice {
  if (!advice) return false;
  return (
    advice.recommendations.length > 0 ||
    advice.risks.length > 0 ||
    advice.openQuestions.length > 0 ||
    hasSketch(advice.sketch)
  );
}
