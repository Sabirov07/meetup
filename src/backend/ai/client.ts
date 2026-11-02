import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * The one place the model client is built.
 *
 * Both callers — transcript analysis and free-text intake — need the same
 * three things: a client, a way to ask whether a key is configured at all, and
 * one error type the actions can recognise. Sharing them keeps "is the AI
 * switched on?" a single answer rather than one per feature.
 */

/**
 * Model used for everything that reads work out of language. Both features
 * make the same kind of judgement call — who owns what, and how sure we are —
 * so they are deliberately held to the same model.
 */
export const WORK_MODEL = "claude-opus-5";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set, so the model cannot be called.");
    this.name = "AiNotConfiguredError";
  }
}

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  return new Anthropic({ apiKey });
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
