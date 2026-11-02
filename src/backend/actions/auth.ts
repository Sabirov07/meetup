"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db, isUniqueViolationOn } from "@/backend/db";
import { hashPassword, verifyPassword } from "@/backend/auth/password";
import { provisionAccount } from "@/backend/auth/provision";
import { createSession, destroyCurrentSession } from "@/backend/auth/session";
import { message } from "@/backend/i18n/message";
import type { TranslationKey } from "@/shared/i18n";
import { fail, guarded, ok, type ActionResult } from "./shared";

/**
 * Validation messages are translation keys. The schemas are module-level, built
 * long before a request exists, so they cannot know which language to speak;
 * the key is resolved when the failure is returned.
 */
const credentials = z.object({
  email: z.string().trim().toLowerCase().email("errors.auth.invalidEmail"),
  password: z.string().min(1, "errors.auth.enterPassword"),
});

export async function signIn(raw: {
  email: string;
  password: string;
}): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const parsed = credentials.safeParse(raw);
    if (!parsed.success) {
      return fail(await issueMessage(parsed.error.issues[0]?.message));
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true },
    });

    // Same message either way, so this cannot be used to enumerate accounts.
    const invalid = fail(await message("errors.auth.noMatch"));
    if (!user) return invalid;

    // A Google-only account has no password to check. Saying so is more useful
    // than "wrong password", and it leaks nothing an attempted Google sign-in
    // would not already reveal.
    if (!user.passwordHash) {
      return fail(await message("errors.auth.useGoogle"));
    }

    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

    const userAgent = (await headers()).get("user-agent") ?? undefined;
    await createSession(user.id, userAgent);
    return ok(undefined);
  });
}

const MIN_PASSWORD = 8;

const signUpInput = z.object({
  name: z.string().trim().min(2, "errors.auth.enterName").max(80, "errors.auth.nameTooLong"),
  email: z.string().trim().toLowerCase().email("errors.auth.invalidEmail"),
  password: z
    .string()
    .min(MIN_PASSWORD, "errors.auth.passwordTooShort")
    // scrypt hashes whatever it is given; the cap is only to keep a single
    // request from burning CPU on a megabyte-long "password".
    .max(200, "errors.auth.passwordTooLong"),
});

/** Turns a Zod issue's key back into a sentence, with the one variable it uses. */
async function issueMessage(key: string | undefined): Promise<string> {
  if (!key) return message("errors.auth.invalidDetails");
  return message(key as TranslationKey, { count: MIN_PASSWORD });
}

/**
 * Creates an account and signs the person straight in — no email confirmation
 * step, because nothing in the product is sent to that address yet.
 */
export async function signUp(raw: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const parsed = signUpInput.safeParse(raw);
    if (!parsed.success) {
      return fail(await issueMessage(parsed.error.issues[0]?.message));
    }
    const input = parsed.data;

    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      return fail(await message("errors.auth.emailTaken"));
    }

    let userId: string;
    try {
      ({ userId } = await provisionAccount({
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      }));
    } catch (error) {
      // Two sign-ups for the same email can race past the check above; the
      // unique index is what actually decides it.
      if (isUniqueViolationOn(error, "email")) {
        return fail(await message("errors.auth.emailTaken"));
      }
      throw error;
    }

    const userAgent = (await headers()).get("user-agent") ?? undefined;
    await createSession(userId, userAgent);
    return ok(undefined);
  });
}

export async function signOut(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}
