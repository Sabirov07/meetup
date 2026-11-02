import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/backend/auth/guards";
import { isGoogleAuthConfigured } from "@/backend/google/identity";
import { getTranslator } from "@/backend/i18n/locale";
import { findUsableInvite, readRememberedInvite } from "@/backend/team/invites";
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
  const invitedTo = await invitedWorkspace();

  return (
    <AuthScreen
      mode="signUp"
      googleConfigured={isGoogleAuthConfigured()}
      notice={status}
      invitedTo={invitedTo}
    >
      <SignUpForm />
    </AuthScreen>
  );
}

/**
 * The workspace a pending invite points at, if one is waiting in the cookie.
 *
 * Both auth pages ask, so that someone who arrived from a link is not told to
 * "create your workspace" when they were asked to join one.
 */
async function invitedWorkspace(): Promise<string | null> {
  const token = await readRememberedInvite();
  if (!token) return null;
  const lookup = await findUsableInvite(token);
  return lookup.ok ? lookup.invite.workspaceName : null;
}
