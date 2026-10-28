import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "meetup_session";
const SESSION_DAYS = 30;

/**
 * Sessions are opaque random bearer tokens. Only the SHA-256 digest is stored,
 * so a database leak does not hand over live sessions. There is no signed
 * payload to forge because the cookie carries no claims of its own.
 */
function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { userId, tokenHash: digest(token), expiresAt, userAgent: userAgent ?? null },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: digest(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export type ResolvedUser = {
  id: string;
  email: string;
  name: string;
  accentToken: string;
};

/** Returns null rather than throwing, so callers decide how to handle absence. */
export async function resolveUserFromCookie(): Promise<ResolvedUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, accentToken: true } },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { tokenHash: digest(token) } });
    return null;
  }

  return session.user;
}
