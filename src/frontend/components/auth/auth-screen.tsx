"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/frontend/i18n";
import { Logo } from "@/frontend/components/brand";
import { LanguageInlineToggle } from "@/frontend/components/shell/language-switch";
import { ThemeInlineToggle } from "@/frontend/components/shell/theme-switch";
import { AuthNotice } from "./auth-notice";
import { GoogleButton, OrDivider } from "./google-button";

/**
 * The frame both auth pages share.
 *
 * It is a client component so that every word on it — including the heading the
 * server would otherwise have baked into HTML — re-renders the instant someone
 * picks a different language from the toggle at the bottom. The pages above stay
 * server components: they still do the session check and read the query string.
 */
export function AuthScreen({
  mode,
  googleConfigured,
  notice,
  invitedTo,
  children,
}: {
  mode: "signIn" | "signUp";
  googleConfigured: boolean;
  notice?: string;
  /**
   * The workspace an invite link is waiting on, when one is. "Create your
   * workspace" is actively misleading to someone who was asked to join an
   * existing one, so the heading changes rather than the page.
   */
  invitedTo?: string | null;
  children: ReactNode;
}) {
  const t = useT();
  const other = mode === "signIn" ? "/signup" : "/login";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[22rem]">
        <div className="flex flex-col items-center text-center">
          <Logo size={34} />
          <h1 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-text">
            {invitedTo
              ? t("auth.invited.title", { workspace: invitedTo })
              : t(`auth.${mode}.title`)}
          </h1>
          <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
            {invitedTo
              ? t(
                  mode === "signUp"
                    ? "auth.invited.signUpSubtitle"
                    : "auth.invited.signInSubtitle",
                )
              : t(`auth.${mode}.subtitle`)}
          </p>
        </div>

        <div className="mt-7 rounded-xl border border-line bg-surface p-5 shadow-raised">
          <AuthNotice status={notice} />

          <div className="space-y-3.5">
            <GoogleButton
              configured={googleConfigured}
              label={mode === "signUp" ? "auth.google.signUp" : "auth.google.continue"}
            />
            <OrDivider />
            {children}
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] leading-5 text-text-muted">
          {t(`auth.${mode}.footer`)}{" "}
          <Link href={other} className="font-medium text-accent-bright hover:underline">
            {t(`auth.${mode}.footerLink`)}
          </Link>
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <LanguageInlineToggle />
          <ThemeInlineToggle />
        </div>
      </div>
    </main>
  );
}
