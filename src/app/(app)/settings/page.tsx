import type { Metadata } from "next";
import { db } from "@/backend/db";
import { requireSession } from "@/backend/auth/guards";
import { getTranslator } from "@/backend/i18n/locale";
import { anthropicIntegrationStatus, googleIntegrationStatus } from "@/backend/google/config";
import { getConnectedAccount } from "@/backend/google/oauth";
import { SettingsView } from "@/frontend/components/settings/settings-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.settings") };
}
export const instant = false;

export default async function SettingsPage(props: PageProps<"/settings">) {
  const session = await requireSession();
  const search = await props.searchParams;

  const [preference, googleAccount] = await Promise.all([
    db.userPreference.findUnique({
      where: { userId: session.userId },
      select: { defaultSort: true },
    }),
    getConnectedAccount(session.userId),
  ]);

  const google = googleIntegrationStatus();
  const anthropic = anthropicIntegrationStatus();

  const notice = Array.isArray(search.google) ? search.google[0] : search.google;

  return (
    <SettingsView
      workspace={session.workspace}
      member={session.member}
      defaultSort={preference?.defaultSort ?? "SMART"}
      googleNotice={notice}
      integrations={{
        google: {
          configured: google.configured,
          missing: google.missing,
          connected: Boolean(googleAccount),
          email: googleAccount?.googleEmail ?? null,
          scope: googleAccount?.scope ?? null,
        },
        anthropic: {
          configured: anthropic.configured,
          missing: anthropic.missing,
        },
        redirectUri:
          process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3100/api/google/callback",
      }}
    />
  );
}
