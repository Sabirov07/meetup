import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/backend/auth/guards";
import { isGoogleAuthConfigured } from "@/backend/google/identity";
import { getTranslator } from "@/backend/i18n/locale";
import { AuthScreen } from "@/frontend/components/auth/auth-screen";
import { SignUpForm } from "./signup-form";

// Session-gated, same as /login: there is no useful static shell to prerender
// before knowing whether someone is already signed in.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("auth.signUp.submit") };
}

export default async function SignUpPage(props: PageProps<"/signup">) {
  if (await getSessionContext()) redirect("/");

  const { google } = await props.searchParams;
  const status = Array.isArray(google) ? google[0] : google;

  return (
    <AuthScreen mode="signUp" googleConfigured={isGoogleAuthConfigured()} notice={status}>
      <SignUpForm />
    </AuthScreen>
  );
}
