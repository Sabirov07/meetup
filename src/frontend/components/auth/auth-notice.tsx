"use client";

import { AlertCircle } from "lucide-react";
import type { TranslationKey } from "@/shared/i18n";
import { useT } from "@/frontend/i18n";

/**
 * Explains a failed Google sign-in. The routes only ever put one of these
 * short codes in the query string — never a message from Google, and never
 * anything an attacker could use the page to render.
 */
const MESSAGES: Record<string, TranslationKey> = {
  denied: "auth.notice.denied",
  "state-mismatch": "auth.notice.state-mismatch",
  "not-configured": "auth.notice.not-configured",
  failed: "auth.notice.failed",
  unknown: "auth.notice.unknown",
};

export function AuthNotice({ status }: { status?: string }) {
  const t = useT();
  const key = status ? MESSAGES[status] : undefined;
  if (!key) return null;

  return (
    <div
      role="alert"
      className="tone-danger mb-4 flex items-start gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-2 text-xs leading-5 text-[var(--tone-fg)]"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {t(key)}
    </div>
  );
}
