import "server-only";

import { headers } from "next/headers";

/**
 * The app's public origin, resolved once and guaranteed to be a valid absolute
 * URL.
 *
 * This exists because `new URL(path, base)` throws on a base that is not an
 * absolute URL, and the OAuth routes build every redirect that way. A bare
 * hostname in `APP_URL` therefore used to take out the whole route with a 500 —
 * including, in one case, from inside the `catch` block meant to handle the
 * failure, so there was nothing left to catch it.
 *
 * A bare hostname is the natural mistake to make: Vercel, Netlify and Render
 * all display a deployment's domain without a scheme, so that is what gets
 * pasted into the dashboard. Rather than fail on it, it is repaired.
 */

const DEV_FALLBACK = "http://localhost:3100";

/**
 * Returns the origin of `raw`, or null when it cannot be read as one.
 *
 * A missing scheme is assumed to be https — the only plausible intent for a
 * deployed host, and the one shape of malformed value worth repairing rather
 * than discarding.
 */
export function normaliseOrigin(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(withScheme);
    // Anything exotic (file:, javascript:) is a configuration error, not a
    // host this app should ever redirect to.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // `origin` drops any path and trailing slash, which is what every caller
    // wants as a base: the paths they join on are absolute.
    return url.origin;
  } catch {
    return null;
  }
}

let resolved: string | null | undefined;

/**
 * The configured public origin, e.g. `https://meetup24.vercel.app`.
 *
 * `fallback` is used when `APP_URL` is unset or unusable — pass a request's
 * own origin where one is available, since it beats guessing. It is itself
 * validated, so a caller can never reintroduce the throw this guards against.
 */
export function appUrl(fallback: string = DEV_FALLBACK): string {
  if (resolved === undefined) {
    resolved = normaliseOrigin(process.env.APP_URL);
    if (!resolved && process.env.APP_URL?.trim()) {
      // Loud, because the symptom downstream (redirects to the wrong host) is
      // otherwise very hard to trace back to this value.
      console.warn(
        `[app-url] APP_URL is not a usable URL: ${JSON.stringify(process.env.APP_URL)}. ` +
          `Set it to an absolute URL such as https://example.com.`,
      );
    }
  }
  return resolved ?? normaliseOrigin(fallback) ?? DEV_FALLBACK;
}

/**
 * The origin the current request actually arrived on.
 *
 * `APP_URL` still wins wherever it is set — this is the fallback for a
 * deployment where nobody remembered to set it, which would otherwise hand a
 * person an invite link pointing at `http://localhost:3100`. A link nobody can
 * open is a worse failure than the one this guards against: the forwarded host
 * is in principle attacker-controlled, but the only thing built from it here is
 * a link rendered straight back to the administrator who made the request, in
 * the response to that same request, so the only host anyone can poison is
 * their own.
 */
export async function requestOrigin(): Promise<string | undefined> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host");
  if (!host) return undefined;

  const protocol = incoming.get("x-forwarded-proto") ?? "https";
  return normaliseOrigin(`${protocol}://${host}`) ?? undefined;
}

/** Builds an absolute URL under the app's origin. Never throws on config. */
export function appUrlFor(path: string, fallback?: string): URL {
  return new URL(path, appUrl(fallback));
}
