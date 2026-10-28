"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
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
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

    const userAgent = (await headers()).get("user-agent") ?? undefined;
    await createSession(user.id, userAgent);
    return ok(undefined);
  });
}

export async function signOut(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}
