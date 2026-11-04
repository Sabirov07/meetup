"use client";

import { useCallback, useMemo } from "react";
import { statusMeta } from "@/shared/domain/labels";
import { findStatus, isBuiltinStatus, toneClass } from "@/shared/domain/statuses";
import type { TaskStatus, TaskStatusDef } from "@/shared/domain/types";
import type { Translate } from "@/shared/i18n";
import { useT } from "@/frontend/i18n";
import { useTasks } from "./task-store";

export type StatusPresentation = {
  key: TaskStatus;
  /** The full name, e.g. "In progress" or a custom "In review". */
  label: string;
  /** The compact name used in the row, e.g. "Active". Custom ones use the label. */
  short: string;
  /** A `.tone-*` class name. */
  tone: string;
  builtin: boolean;
};

/**
 * How one status is shown: a built-in is translated from its key, a custom
 * one carries its own name and colour on its definition.
 */
export function presentStatus(def: TaskStatusDef, t: Translate): StatusPresentation {
  if (isBuiltinStatus(def.key)) {
    return {
      key: def.key,
      label: t(`status.${def.key}.label`),
      short: t(`status.${def.key}.short`),
      tone: toneClass(def.tone || statusMeta[def.key].tone.replace("tone-", "")),
      builtin: true,
    };
  }
  return {
    key: def.key,
    label: def.label || def.key,
    short: def.label || def.key,
    tone: toneClass(def.tone),
    builtin: false,
  };
}

type StatusLookup = {
  statuses: TaskStatusDef[];
  /** One status, with a readable stand-in for a key that is no longer listed. */
  meta: (status: TaskStatus) => StatusPresentation;
  /** Every status, presented, in workspace order. */
  all: StatusPresentation[];
};

/** Presents a list handed in as a prop, for a dialog that sits outside the store. */
export function useStatusPresentation(statuses: TaskStatusDef[]): StatusLookup {
  const t = useT();
  const meta = useCallback(
    (status: TaskStatus) => presentStatus(findStatus(statuses, status), t),
    [statuses, t],
  );
  const all = useMemo(() => statuses.map((s) => presentStatus(s, t)), [statuses, t]);
  return { statuses, meta, all };
}

/**
 * The workspace's statuses from the task store, so every surface agrees on
 * the order and the names without each one looking them up.
 */
export function useStatusMeta(): StatusLookup {
  const { statuses } = useTasks();
  return useStatusPresentation(statuses);
}
