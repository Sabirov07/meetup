"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db, isUniqueViolationOn } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { provisionAccount } from "@/lib/auth/provision";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { fail, guarded, ok, type ActionResult } from "./shared";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(raw: {
  email: string;
  password: string;
}): Promise<ActionResult<undefined>> {
  return guarded(async () => {
    const parsed = credentials.safeParse(raw);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Those details are not valid.");
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true },
    });

    // Same message either way, so this cannot be used to enumerate accounts.
    const invalid = fail("That email and password do not match an account.");
    if (!user) return invalid;

    // A Google-only account has no password to check. Saying so is more useful
    // than "wrong password", and it leaks nothing an attempted Google sign-in
    // would not already reveal.
    if (!user.passwordHash) {
      return fail("That account signs in with Google. Use “Continue with Google” below.");
    }

    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

    const userAgent = (await headers()).get("user-agent") ?? undefined;
    await createSession(user.id, userAgent);
    return ok(undefined);
  });
}

const MIN_PASSWORD = 8;

const signUpInput = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "That name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`)
    // scrypt hashes whatever it is given; the cap is only to keep a single
    // request from burning CPU on a megabyte-long "password".
    .max(200, "That password is too long."),
});

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
      return fail(parsed.error.issues[0]?.message ?? "Those details are not valid.");
    }
    const input = parsed.data;

    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      return fail("An account already exists for that email. Sign in instead.");
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
        return fail("An account already exists for that email. Sign in instead.");
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
