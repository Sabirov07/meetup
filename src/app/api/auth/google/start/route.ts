import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/backend/auth/guards";
import { appUrlFor } from "@/backend/app-url";
import {
  GOOGLE_AUTH_STATE_COOKIE,
  GoogleAuthNotConfiguredError,
  buildGoogleAuthUrl,
  createOAuthState,
} from "@/backend/google/identity";

/**
 * Starts "Continue with Google".
 *
 * The `state` value goes into a short-lived httpOnly cookie and is compared on
 * the way back. That is what stops a third party from completing this flow in
 * someone else's browser and logging them into an account they do not own
 * (login CSRF).
 */
export async function GET() {
  // Already signed in: there is nothing to do here.
  if (await getSessionContext()) {
    return NextResponse.redirect(appUrlFor("/"));
  }

  try {
    const state = createOAuthState();
    const authUrl = buildGoogleAuthUrl(state);

    const store = await cookies();
    store.set(GOOGLE_AUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const reason = error instanceof GoogleAuthNotConfiguredError ? "not-configured" : "unknown";
    return NextResponse.redirect(appUrlFor(`/login?google=${reason}`));
  }
}
