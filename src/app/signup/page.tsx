import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";
import { isGoogleAuthConfigured } from "@/lib/google/identity";
import { AuthNotice } from "@/components/auth/auth-notice";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { SignUpForm } from "./signup-form";
import { Logo } from "@/components/brand";

// Session-gated, same as /login: there is no useful static shell to prerender
// before knowing whether someone is already signed in.
export const instant = false;

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage(props: PageProps<"/signup">) {
  if (await getSessionContext()) redirect("/");

  const { google } = await props.searchParams;
  const status = Array.isArray(google) ? google[0] : google;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="flex flex-col items-center text-center">
          <Logo size={34} />
          <h1 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-text">
            Create your workspace
          </h1>
          <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
            Takes a moment. You can invite the people you work with afterwards.
          </p>
        </div>

        <div className="mt-7 rounded-xl border border-line bg-surface p-5 shadow-raised">
          <AuthNotice status={status} />

          <div className="space-y-3.5">
            <GoogleButton configured={isGoogleAuthConfigured()} label="Sign up with Google" />
            <OrDivider />
            <SignUpForm />
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] leading-5 text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-bright hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
