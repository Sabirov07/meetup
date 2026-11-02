import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/backend/db";
import { GOOGLE_SCOPES, getGoogleConfig } from "./config";

/**
 * OAuth 2.0 authorisation-code flow with refresh tokens.
 *
 * Tokens live in `google_accounts` and are only ever read by server code.
 * None of them is selected into a client component or a server action's
 * return value.
 */

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super(
      "Google Meet is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.",
    );
    this.name = "GoogleNotConfiguredError";
  }
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("This account has not connected Google Meet yet.");
    this.name = "GoogleNotConnectedError";
  }
}

export function buildAuthUrl(state: string): string {
  const config = getGoogleConfig();
  if (!config) throw new GoogleNotConfiguredError();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // Needed to receive a refresh token at all.
    access_type: "offline",
    // Forces the consent screen so a refresh token is re-issued even if the
    // person has authorised before.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${config.authUrl}?${params.toString()}`;
}

export function createOAuthState(): string {
  return randomBytes(16).toString("base64url");
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const config = getGoogleConfig();
  if (!config) throw new GoogleNotConfiguredError();

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...body,
    }),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google rejected the token request (${response.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

/** Decodes the email claim without verifying — it came straight from Google. */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
    };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

export async function exchangeCodeForTokens(
  code: string,
  userId: string,
): Promise<{ googleEmail: string }> {
  const config = getGoogleConfig();
  if (!config) throw new GoogleNotConfiguredError();

  const tokens = await postToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const googleEmail = emailFromIdToken(tokens.id_token) ?? "unknown";
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.googleAccount.upsert({
    where: { userId },
    update: {
      googleEmail,
      accessToken: tokens.access_token,
      // Google only returns a refresh token on first consent; keep the old one
      // if this response omits it.
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      scope: tokens.scope,
      expiresAt,
    },
    create: {
      userId,
      googleEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      scope: tokens.scope,
      expiresAt,
    },
  });

  return { googleEmail };
}

/**
 * Returns a usable access token, refreshing it when it is within a minute of
 * expiry. Throws `GoogleNotConnectedError` when there is nothing to refresh.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const account = await db.googleAccount.findUnique({
    where: { userId },
    select: { accessToken: true, refreshToken: true, expiresAt: true },
  });
  if (!account) throw new GoogleNotConnectedError();

  if (account.expiresAt.getTime() - 60_000 > Date.now()) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new Error(
      "The Google access token has expired and no refresh token is stored. Reconnect the account.",
    );
  }

  const tokens = await postToken({
    refresh_token: account.refreshToken,
    grant_type: "refresh_token",
  });

  await db.googleAccount.update({
    where: { userId },
    data: {
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });

  return tokens.access_token;
}

export async function getConnectedAccount(userId: string) {
  return db.googleAccount.findUnique({
    where: { userId },
    // Deliberately excludes the tokens.
    select: { googleEmail: true, scope: true, expiresAt: true, createdAt: true },
  });
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await db.googleAccount.deleteMany({ where: { userId } });
}
