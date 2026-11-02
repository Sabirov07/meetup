import { cookies, headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { resolveGoogleSignIn } from "@/backend/auth/provision";
import { createSession } from "@/backend/auth/session";
import { appUrl } from "@/backend/app-url";
import { GOOGLE_AUTH_STATE_COOKIE, exchangeCodeForIdentity } from "@/backend/google/identity";

/** Prefers the configured public URL, falling back to the request's origin. */
function base(request: NextRequest): string {
  return appUrl(request.nextUrl.origin);
}

function loginUrl(request: NextRequest, status: string): URL {
  return new URL(`/login?google=${status}`, base(request));
}

/**
 * Completes "Continue with Google" and establishes a session.
 *
 * The authorisation code is exchanged server-side; no token ever reaches the
 * browser, a query string or this response body.
 */
export async function GET(request: NextRequest) {
  const store = await cookies();
  const expectedState = store.get(GOOGLE_AUTH_STATE_COOKIE)?.value;
  store.delete(GOOGLE_AUTH_STATE_COOKIE);

  const params = request.nextUrl.searchParams;
  if (params.get("error")) {
    // Consent was declined, or Google refused the request.
    return NextResponse.redirect(loginUrl(request, "denied"));
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(loginUrl(request, "state-mismatch"));
  }

  try {
    const identity = await exchangeCodeForIdentity(code);
    const { userId } = await resolveGoogleSignIn(identity);
    const userAgent = (await headers()).get("user-agent") ?? undefined;
    await createSession(userId, userAgent);
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("[google-signin]", error);
    return NextResponse.redirect(loginUrl(request, "failed"));
  }

  return NextResponse.redirect(new URL("/", base(request)));
}
