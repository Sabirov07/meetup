import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Reading the session cookie makes this route request-time, which is correct:
  // an already-signed-in person should never see the form.
  if (await getSessionContext()) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="flex flex-col items-center text-center">
          <Logo size={34} />
          <h1 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-text">
            Sign in to Meetup
          </h1>
          <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
            Your shared workspace for turning conversations into clear ownership.
          </p>
        </div>

        <div className="mt-7 rounded-xl border border-line bg-surface p-5 shadow-raised">
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-2xs leading-5 text-text-faint">
          Accounts are created by seeding the workspace. See{" "}
          <code className="rounded-[4px] bg-raised px-1 py-0.5 font-mono text-text-muted">
            prisma/seed.ts
          </code>
          .
        </p>
      </div>
    </main>
  );
}
