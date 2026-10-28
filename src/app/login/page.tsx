import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";
import { isGoogleAuthConfigured } from "@/lib/google/identity";
import { AuthNotice } from "@/components/auth/auth-notice";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  // Reading the session cookie makes this route request-time, which is correct:
  // an already-signed-in person should never see the form.
  if (await getSessionContext()) redirect("/");

  const { google } = await props.searchParams;
  const status = Array.isArray(google) ? google[0] : google;

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
          <AuthNotice status={status} />

          <div className="space-y-3.5">
            <GoogleButton configured={isGoogleAuthConfigured()} />
            <OrDivider />
            <LoginForm />
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] leading-5 text-text-muted">
          New to Meetup?{" "}
          <Link href="/signup" className="font-medium text-accent-bright hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
