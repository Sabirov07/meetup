import "server-only";

import { randomBytes } from "node:crypto";

/**
 * "Continue with Google" — sign-in only.
 *
 * Deliberately separate from `./oauth.ts`, which connects Google *Meet*:
 *
 *  - Different scopes. Signing in needs `openid email profile` and nothing
 *    more; asking for Meet scopes at the door would make the consent screen
 *    alarming for someone who only wants an account.
 *  - Different redirect URI, so the two flows can never be confused for one
 *    another on the way back.
 *  - Nothing is stored. There is no access token to keep: the ID token is read
 *    once to learn who this is, and then discarded. Meet tokens stay the sole
 *    business of `google_accounts`.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile"] as const;

export const GOOGLE_AUTH_CALLBACK_PATH = "/api/auth/google/callback";

/** Short-lived CSRF cookie for the sign-in flow. */
export const GOOGLE_AUTH_STATE_COOKIE = "google_auth_state";

export class GoogleAuthNotConfiguredError extends Error {
  constructor() {
    super("Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    this.name = "GoogleAuthNotConfiguredError";
  }
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3100";
}

type GoogleAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Returns null when sign-in with Google is not set up, so the login page can
 * simply not offer it rather than showing a button that fails.
 *
 * The redirect URI is derived from APP_URL by default — one less value to keep
 * in sync — but can be overridden when the app sits behind a proxy whose
 * public URL differs from APP_URL.
 */
export function getGoogleAuthConfig(): GoogleAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const redirectUri =
    process.env.GOOGLE_AUTH_REDIRECT_URI ?? new URL(GOOGLE_AUTH_CALLBACK_PATH, appUrl()).toString();

  return { clientId, clientSecret, redirectUri };
}

export function isGoogleAuthConfigured(): boolean {
  return getGoogleAuthConfig() !== null;
}

export function createOAuthState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildGoogleAuthUrl(state: string): string {
  const config = getGoogleAuthConfig();
  if (!config) throw new GoogleAuthNotConfiguredError();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_AUTH_SCOPES.join(" "),
    // Lets someone pick which Google account to use instead of silently
    // reusing whichever one the browser is already signed in to.
    prompt: "select_account",
  });
  params.set("state", state);

  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

export type GoogleIdentity = {
  /** Google's stable account id (`sub`). */
  subject: string;
  email: string;
  name: string;
};

type IdTokenClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
};

const ALLOWED_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

function decodeClaims(idToken: string): IdTokenClaims | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
  } catch {
    return null;
  }
}

export class GoogleIdentityError extends Error {}

/**
 * Exchanges the authorisation code for an ID token and reads who signed in.
 *
 * The signature is not verified, and does not need to be: this response came
 * back from Google's own token endpoint over TLS, in a server-to-server request
 * authenticated with our client secret — there is no untrusted party in that
 * path. (Google's documentation makes the same point for tokens received
 * directly from the token endpoint.) The claims below are still checked,
 * because they are cheap and they catch a misconfigured client.
 */
export async function exchangeCodeForIdentity(code: string): Promise<GoogleIdentity> {
  const config = getGoogleAuthConfig();
  if (!config) throw new GoogleAuthNotConfiguredError();

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new GoogleIdentityError(
      `Google rejected the token request (${response.status}): ${text.slice(0, 300)}`,
    );
  }

  const { id_token: idToken } = JSON.parse(text) as { id_token?: string };
  if (!idToken) throw new GoogleIdentityError("Google did not return an ID token.");

  const claims = decodeClaims(idToken);
  if (!claims) throw new GoogleIdentityError("Google's ID token could not be read.");

  if (!claims.iss || !ALLOWED_ISSUERS.has(claims.iss)) {
    throw new GoogleIdentityError("Unexpected ID token issuer.");
  }
  if (claims.aud !== config.clientId) {
    throw new GoogleIdentityError("That ID token was issued for a different OAuth client.");
  }
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
    throw new GoogleIdentityError("Google's ID token has already expired.");
  }
  if (!claims.sub) throw new GoogleIdentityError("Google's ID token carries no account id.");
  if (!claims.email) throw new GoogleIdentityError("That Google account exposes no email address.");

  // An unverified address must not be allowed to claim an existing account by
  // matching on email.
  if (claims.email_verified === false) {
    throw new GoogleIdentityError("That Google account's email address is not verified.");
  }

  return {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    name: claims.name?.trim() || claims.given_name?.trim() || claims.email.split("@")[0],
  };
}
