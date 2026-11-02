"use client";

import { Fragment, useCallback, type ReactNode } from "react";
import type { TranslationKey } from "@/shared/i18n";
import { useI18n } from "./provider";

/**
 * Translation with React nodes substituted into the placeholders.
 *
 * Some sentences genuinely contain markup — an environment variable in a
 * `<code>`, a link, a bolded term. Splitting such a sentence into three keys
 * puts its word order beyond the translator's reach, which is exactly the thing
 * that makes translated UI read like a machine wrote it. Here the sentence stays
 * one string with `{named}` holes, and the nodes drop into them wherever the
 * language happens to put them.
 */
export function useTx(): (key: TranslationKey, nodes: Record<string, ReactNode>) => ReactNode[] {
  const { t } = useI18n();

  return useCallback(
    (key, nodes) => {
      const template = t(key);
      const out: ReactNode[] = [];
      const pattern = /\{(\w+)\}/g;

      let cursor = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(template)) !== null) {
        if (match.index > cursor) out.push(template.slice(cursor, match.index));
        const node = nodes[match[1]!];
        out.push(
          node === undefined ? (
            match[0]
          ) : (
            <Fragment key={`${match[1]}-${match.index}`}>{node}</Fragment>
          ),
        );
        cursor = match.index + match[0].length;
      }
      if (cursor < template.length) out.push(template.slice(cursor));

      return out;
    },
    [t],
  );
}
