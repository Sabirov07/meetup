/**
 * Limits for free-text intake, shared because both ends need them: the dialog
 * caps the textarea and greys out the button, and the action re-checks the
 * same numbers on text that has crossed the network. The AI module that
 * actually spends the tokens is `server-only`, so the constants cannot live
 * there.
 */

/** Below this there is nothing to divide up and a model call would be waste. */
export const MIN_BRIEF_LENGTH = 12;

/** Roughly fifteen pages. Beyond it, the brief is a document, not a brief. */
export const MAX_BRIEF_LENGTH = 24_000;
