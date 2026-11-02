"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Building2, Check, UserPlus } from "lucide-react";
import { acceptInviteForMe, beginJoin, signOutToJoin } from "@/backend/actions/team";
import type { WorkspaceRole } from "@/shared/domain/types";
import { useI18n, useT } from "@/frontend/i18n";
import { Logo } from "@/frontend/components/brand";
import { Button } from "@/frontend/components/ui/button";
import { LanguageInlineToggle } from "@/frontend/components/shell/language-switch";

export type InviteProblemReason =
  | "unknown"
  | "revoked"
  | "accepted"
  | "expired"
  | "wrongEmail";

export type JoinInvite = {
  token: string;
  workspaceName: string;
  role: WorkspaceRole;
  /** Null when the link is open to whoever holds it. */
  email: string | null;
  invitedByName: string | null;
  /** Null when the screen is reporting an existing membership, not an offer. */
  expiresAt: string | null;
};

/**
 * The screen a new colleague lands on.
 *
 * It has to read sensibly in four states, which is most of why it is one
 * component rather than four pages: invited and signed in; invited and not
 * signed in; invited as someone else; and already a member. The signed-out
 * buttons are forms rather than links because the token has to be put in a
 * cookie before the browser leaves for /signup or Google, and only a Server
 * Function may write one.
 */
export function JoinInvite({
  invite,
  viewer,
  alreadyMember,
}: {
  invite: JoinInvite;
  /** The signed-in person, or null. */
  viewer: { email: string } | null;
  alreadyMember: boolean;
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const roleLabel = t(
    invite.role === "ADMINISTRATOR" ? "sidebar.role.administrator" : "sidebar.role.member",
  );
  const mismatched =
    Boolean(viewer && invite.email) && viewer!.email.toLowerCase() !== invite.email;

  return (
    <Frame>
      <div className="flex flex-col items-center text-center">
        <span className="tone-accent flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--tone-bg)]">
          <UserPlus className="h-5 w-5 text-[var(--tone-fg)]" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-text">
          {alreadyMember ? t("join.alreadyMember", { workspace: invite.workspaceName }) : t("join.title")}
        </h1>
        {!alreadyMember && (
          <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
            {invite.invitedByName
              ? t("join.subtitle", {
                  inviter: invite.invitedByName,
                  workspace: invite.workspaceName,
                })
              : t("join.subtitleNoInviter", { workspace: invite.workspaceName })}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-raised">
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 py-2.5">
          <Building2 className="h-4 w-4 shrink-0 text-text-faint" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text">{invite.workspaceName}</p>
            {/* "You will join as…" is a promise, and already-member is a fact. */}
            {!alreadyMember && (
              <p className="truncate text-2xs text-text-muted">
                {t("join.asRole", { role: roleLabel })}
              </p>
            )}
          </div>
        </div>

        <ul className="mt-3 space-y-1 text-2xs leading-4 text-text-muted">
          {invite.email && !alreadyMember && (
            <li>{t("join.pinnedTo", { email: invite.email })}</li>
          )}
          {invite.expiresAt && (
            <li>{t("join.expires", { when: f.relative(invite.expiresAt) })}</li>
          )}
          {viewer && <li>{t("join.signedInAs", { email: viewer.email })}</li>}
        </ul>

        {error && (
          <div
            role="alert"
            className="tone-danger mt-3 flex items-start gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-2 text-xs leading-5 text-[var(--tone-fg)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {alreadyMember ? (
            <Button variant="primary" size="lg" className="w-full" asChild>
              <Link href="/">{t("join.openWorkspace", { workspace: invite.workspaceName })}</Link>
            </Button>
          ) : mismatched ? (
            <>
              <p className="text-xs leading-5 text-text-secondary">
                {t("join.wrongAccount", {
                  email: invite.email ?? "",
                  current: viewer?.email ?? "",
                })}
              </p>
              <form action={signOutToJoin.bind(null, invite.token)}>
                <Button type="submit" variant="primary" size="lg" className="w-full">
                  {t("join.switchAccount", { email: invite.email ?? "" })}
                </Button>
              </form>
            </>
          ) : viewer ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={pending}
              loadingLabel={t("join.accepting")}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await acceptInviteForMe(invite.token);
                  if (result.ok) {
                    router.replace("/");
                    // The shell is a server component: the new membership has
                    // to be fetched rather than read from the router cache.
                    router.refresh();
                  } else {
                    setError(result.error);
                  }
                })
              }
            >
              <Check className="h-3.5 w-3.5" />
              {t("join.accept", { workspace: invite.workspaceName })}
            </Button>
          ) : (
            <>
              <form action={beginJoin}>
                <input type="hidden" name="token" value={invite.token} />
                <input type="hidden" name="to" value="signup" />
                <Button type="submit" variant="primary" size="lg" className="w-full">
                  {t("join.createAccount")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </form>
              <form action={beginJoin}>
                <input type="hidden" name="token" value={invite.token} />
                <input type="hidden" name="to" value="login" />
                <Button type="submit" variant="secondary" size="lg" className="w-full">
                  {t("join.haveAccount")}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <LanguageInlineToggle className="mt-6" />
    </Frame>
  );
}

/** The same dead-end screen for every reason a link does not work. */
export function InviteProblem({ reason }: { reason: InviteProblemReason }) {
  const t = useT();

  return (
    <Frame>
      <div className="flex flex-col items-center text-center">
        <Logo size={34} />
        <h1 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-text">
          {t("join.problem.heading")}
        </h1>
        <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
          {t(`join.problem.${reason}`)}
        </p>
      </div>

      <Button variant="secondary" size="lg" className="mt-6 w-full" asChild>
        <Link href="/">{t("join.backToApp")}</Link>
      </Button>

      <LanguageInlineToggle className="mt-6" />
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[22rem]">{children}</div>
    </main>
  );
}
