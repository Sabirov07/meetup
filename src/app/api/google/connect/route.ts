import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/backend/auth/guards";
import { appUrlFor } from "@/backend/app-url";
import { buildAuthUrl, createOAuthState, GoogleNotConfiguredError } from "@/backend/google/oauth";

const STATE_COOKIE = "google_oauth_state";

/**
 * Starts the Google consent flow.
 *
 * The `state` value is stored in a short-lived httpOnly cookie and compared on
 * the way back, which is what stops a third party from completing this flow on
 * someone else's behalf (CSRF).
 */
export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.redirect(appUrlFor("/login"));
  }

  try {
    const state = createOAuthState();
    const store = await cookies();
    store.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(buildAuthUrl(state));
  } catch (error) {
    const reason =
      error instanceof GoogleNotConfiguredError
        ? "not-configured"
        : "unknown";
    return NextResponse.redirect(appUrlFor(`/settings?google=${reason}`));
  }
}
