"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type DocSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/** How long to sit on a keystroke before writing the body back. */
const AUTOSAVE_DELAY = 900;

/**
 * Holds a document draft and writes it back on a timer.
 *
 * Saving is on a timer rather than a button because a document is written in
 * passes and nobody should have to remember to commit one. The draft is also
 * flushed when the component goes away — a drawer closing, a page navigating —
 * so a paragraph in progress is never lost to a click elsewhere.
 *
 * `save` returns null when it worked, or a message to show when it did not.
 */
export function useAutosavedDoc({
  initial,
  save,
  errorTitle,
  delay = AUTOSAVE_DELAY,
}: {
  initial: string;
  save: (value: string) => Promise<string | null>;
  errorTitle: string;
  delay?: number;
}) {
  const [draft, setDraft] = useState(initial);
  const [state, setState] = useState<DocSaveState>("idle");

  // Refs so the debounce, the explicit save and the unmount flush all read the
  // same truth without re-arming effects on every keystroke.
  const draftRef = useRef(draft);
  const savedRef = useRef(initial);
  const saveRef = useRef(save);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const commit = useCallback(
    async (next: string) => {
      if (next === savedRef.current) return;
      // Claimed before the await, so a second save started while this one is
      // in flight does not write the same body twice.
      savedRef.current = next;
      setState("saving");

      const error = await saveRef.current(next);
      if (error === null) {
        setState("saved");
      } else {
        savedRef.current = `${next}\u0000unsaved`;
        setState("error");
        toast.error(errorTitle, { description: error });
      }
    },
    [errorTitle],
  );

  useEffect(() => {
    if (draft === savedRef.current) return;
    setState("dirty");
    const timer = window.setTimeout(() => void commit(draft), delay);
    return () => window.clearTimeout(timer);
  }, [draft, commit, delay]);

  // "Saved" is a confirmation, not a status; it fades back out.
  useEffect(() => {
    if (state !== "saved") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Flush on the way out — the drawer or the page can close mid-sentence.
  useEffect(
    () => () => {
      if (draftRef.current !== savedRef.current) void saveRef.current(draftRef.current);
    },
    [],
  );

  const flush = useCallback(() => void commit(draftRef.current), [commit]);

  /** Replaces the body and saves at once — a checkbox tick, not typing. */
  const replace = useCallback(
    (next: string) => {
      setDraft(next);
      void commit(next);
    },
    [commit],
  );

  return { draft, setDraft, replace, state, flush };
}
