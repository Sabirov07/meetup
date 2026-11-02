import { AlertCircle } from "lucide-react";

/**
 * Explains a failed Google sign-in. The routes only ever put one of these
 * short codes in the query string — never a message from Google, and never
 * anything an attacker could use the page to render.
 */
const MESSAGES: Record<string, string> = {
  denied: "You cancelled the Google sign-in. Nothing was changed.",
  "state-mismatch":
    "That sign-in link had expired. Start again from this page and it will work.",
  "not-configured":
    "Google sign-in is not configured on this deployment. Use an email and password instead.",
  failed: "Google could not complete the sign-in. Try again, or use an email and password.",
  unknown: "Something went wrong starting the Google sign-in. Please try again.",
};

export function AuthNotice({ status }: { status?: string }) {
  const message = status ? MESSAGES[status] : undefined;
  if (!message) return null;

  return (
    <div
      role="alert"
      className="tone-danger mb-4 flex items-start gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-2 text-xs leading-5 text-[var(--tone-fg)]"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}
