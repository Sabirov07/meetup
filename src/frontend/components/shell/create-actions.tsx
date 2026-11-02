"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * A way for a page's own create form to reach the shell's create dialogs.
 *
 * Several screens render their own `TaskFormDialog` so that a new task appears
 * in the board underneath without a round trip. All of them want to offer the
 * same way out of the form — describe the work instead and have it split up —
 * and none of them should own a second copy of that dialog, or have to be told
 * from the server whether a model key exists. So the shell keeps the one
 * instance and hands down the opener.
 */
type CreateActions = {
  /** Opens the "describe the work" dialog. */
  describeTasks: () => void;
};

const CreateActionsContext = createContext<CreateActions | null>(null);

export function CreateActionsProvider({
  value,
  children,
}: {
  value: CreateActions;
  children: ReactNode;
}) {
  return (
    <CreateActionsContext.Provider value={value}>{children}</CreateActionsContext.Provider>
  );
}

/**
 * Null outside the shell. A component rendered on its own simply has no
 * dialog to open, and the offer is left out rather than crashing.
 */
export function useCreateActions(): CreateActions | null {
  return useContext(CreateActionsContext);
}
