"use client";

import { useT, useTx } from "@/frontend/i18n";
import { Button } from "@/frontend/components/ui/button";

/** Google's four-colour mark, drawn at the size the button uses. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1.0v2.33A8.99 8.99 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.71V4.96H1.0A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 1.0 4.96l3.01 2.33C4.68 5.17 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Starts the sign-in flow. A plain link, not a fetch: the browser has to follow
 * Google's redirect, and the state cookie has to be set on a real navigation.
 *
 * `configured` comes from the server page. When Google is not set up the button
 * is replaced with the one line of setup that is missing, rather than offering
 * something that would dead-end.
 */
export function GoogleButton({
  configured,
  label = "auth.google.continue",
}: {
  configured: boolean;
  /** Which of the two wordings to use; the sign-up page overrides it. */
  label?: "auth.google.continue" | "auth.google.signUp";
}) {
  const t = useT();
  const tx = useTx();

  if (!configured) {
    const code = (name: string) => (
      <code className="font-mono text-text-muted">{name}</code>
    );
    return (
      <p className="rounded-md border border-dashed border-line-strong px-2.5 py-2 text-2xs leading-5 text-text-faint">
        {tx("auth.google.off", {
          clientId: code("GOOGLE_CLIENT_ID"),
          clientSecret: code("GOOGLE_CLIENT_SECRET"),
          envFile: code(".env.local"),
        })}
      </p>
    );
  }

  return (
    <Button asChild variant="secondary" size="lg" className="w-full">
      <a href="/api/auth/google/start">
        <GoogleMark />
        {t(label)}
      </a>
    </Button>
  );
}

/** "or" rule between the Google button and the email form. */
export function OrDivider() {
  const t = useT();

  return (
    <div className="flex items-center gap-2.5" aria-hidden>
      <span className="h-px flex-1 bg-line" />
      <span className="text-2xs uppercase tracking-[0.08em] text-text-faint">
        {t("common.or")}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
