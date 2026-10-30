import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/guards";
import { appUrl } from "@/lib/app-url";
import { exchangeCodeForTokens } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

function settingsUrl(request: NextRequest, status: string): URL {
  const base = appUrl(request.nextUrl.origin);
  return new URL(`/settings?google=${status}`, base);
}

/**
 * Completes the Google consent flow.
 *
 * Tokens are written straight to `google_accounts` server-side and never pass
 * through a query string, a client component, or this response body.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl(request.nextUrl.origin)));
  }

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  const params = request.nextUrl.searchParams;
  const error = params.get("error");
  if (error) {
    // The person declined consent, or Google refused the request.
    return NextResponse.redirect(settingsUrl(request, `denied`));
  }

  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(settingsUrl(request, "state-mismatch"));
  }

  try {
    await exchangeCodeForTokens(code, session.userId);
    return NextResponse.redirect(settingsUrl(request, "connected"));
  } catch {
    return NextResponse.redirect(settingsUrl(request, "exchange-failed"));
  }
}
