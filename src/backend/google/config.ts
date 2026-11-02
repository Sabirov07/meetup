import "server-only";

/**
 * Google Meet integration configuration.
 *
 * Nothing in this module ever runs with partial configuration. If credentials
 * are missing the rest of the product keeps working and the meeting surfaces
 * explain exactly what is absent — they never pretend a call succeeded.
 */

/**
 * Scopes requested at consent.
 *
 *  - meetings.space.created  — create and manage spaces this app created, and
 *    read artifacts (including transcripts) from those conferences.
 *  - meetings.space.readonly — read spaces and artifacts for conferences the
 *    signed-in person took part in but this app did not create.
 *
 * Verified against the Meet REST API v2 reference; both are listed as accepted
 * scopes for conferenceRecords.transcripts.entries.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const MEET_API_BASE = "https://meet.googleapis.com/v2";
const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
};

/** Returns null when the integration is not configured. Never throws. */
export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return {
    clientId,
    clientSecret,
    redirectUri,
    authUrl: OAUTH_AUTH_URL,
    tokenUrl: OAUTH_TOKEN_URL,
  };
}

export type IntegrationStatus = {
  configured: boolean;
  /** Which env vars are still missing, for the Settings page to display. */
  missing: string[];
};

export function googleIntegrationStatus(): IntegrationStatus {
  const missing = (
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"] as const
  ).filter((key) => !process.env[key]);
  return { configured: missing.length === 0, missing };
}

export function anthropicIntegrationStatus(): IntegrationStatus {
  const missing = process.env.ANTHROPIC_API_KEY ? [] : ["ANTHROPIC_API_KEY"];
  return { configured: missing.length === 0, missing };
}

/** Accepts the forms Google actually hands out for a Meet link. */
export function isMeetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "meet.google.com" || url.hostname.endsWith(".meet.google.com"))
    );
  } catch {
    return false;
  }
}
