"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleCheck,
  ExternalLink,
  Sparkles,
  Unplug,
  Users,
  Video,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDefaultSort } from "@/backend/actions/preferences";
import {
  disconnectGoogleAccount,
  renameWorkspace,
  updateMemberProfile,
} from "@/backend/actions/workspace";
import {
  ACCENT_TOKENS,
  SORT_MODES,
  type AccentToken,
  type MemberSummary,
  type SortMode,
  type WorkspaceSummary,
} from "@/shared/domain/types";
import type { TranslationKey } from "@/shared/i18n";
import { useT, useTx } from "@/frontend/i18n";
import { LanguageChoice } from "@/frontend/components/shell/language-switch";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Separator, Tooltip } from "@/frontend/components/ui/feedback";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/frontend/components/ui/field";

export type IntegrationState = {
  google: { configured: boolean; missing: string[]; connected: boolean; email: string | null; scope: string | null };
  anthropic: { configured: boolean; missing: string[] };
  redirectUri: string;
};

export function SettingsView({
  workspace,
  member,
  integrations,
  defaultSort,
  googleNotice,
}: {
  workspace: WorkspaceSummary;
  member: MemberSummary;
  integrations: IntegrationState;
  defaultSort: SortMode;
  googleNotice?: string;
}) {
  const t = useT();
  const tx = useTx();
  const isAdmin = member.role === "ADMINISTRATOR";
  const [name, setName] = useState(workspace.name);
  const [sort, setSort] = useState(defaultSort);
  const [savingName, startName] = useTransition();

  return (
    <div className="mx-auto w-full max-w-[52rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header>
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">
          {t("settings.heading")}
        </h1>
        <p className="mt-1 text-[13px] leading-5 text-text-muted">
          {t("settings.description")}
        </p>
      </header>

      {googleNotice && <GoogleNotice status={googleNotice} />}

      {/* Language. First, because it decides how everything below reads. */}
      <Section title={t("language.heading")} description={t("language.description")}>
        <LanguageChoice />
      </Section>

      {/* Workspace */}
      <Section
        title={t("settings.workspace.title")}
        description={t("settings.workspace.description")}
      >
        <div className="flex items-end gap-2">
          <Field label={t("settings.workspace.name")} htmlFor="workspace-name" className="flex-1">
            <Input
              id="workspace-name"
              value={name}
              disabled={!isAdmin}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            disabled={!isAdmin || name.trim() === workspace.name}
            loading={savingName}
            onClick={() =>
              startName(async () => {
                const result = await renameWorkspace(name);
                if (result.ok) toast.success(t("settings.workspace.renamed"));
                else {
                  toast.error(t("settings.workspace.renameFailed"), {
                    description: result.error,
                  });
                }
              })
            }
          >
            {t("common.save")}
          </Button>
        </div>
        {!isAdmin && (
          <p className="text-2xs text-text-faint">{t("settings.workspace.adminOnly")}</p>
        )}
      </Section>

      {/* Your profile. The roster, roles and invites live on the Team page:
          one place to answer "who can see this workspace?". */}
      <Section
        title={t("settings.profile.title")}
        description={t("settings.profile.description")}
      >
        <MemberRow person={member} />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5">
          <p className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Users className="h-4 w-4 shrink-0 text-text-faint" />
            {t("settings.profile.teamPointer", { count: workspace.members.length })}
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/team">
              {t("team.switcher.manage")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Integrations */}
      <Section
        title={t("settings.integrations.title")}
        description={t("settings.integrations.description")}
      >
        {/* Google */}
        <div className="rounded-lg border border-line bg-canvas p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-text">
                  {t("settings.google.title")}
                  {integrations.google.connected ? (
                    <Badge tone="tone-success">
                      <CircleCheck className="h-2.5 w-2.5" />
                      {t("common.connected")}
                    </Badge>
                  ) : integrations.google.configured ? (
                    <Badge tone="tone-warning">{t("common.notConnected")}</Badge>
                  ) : (
                    <Badge tone="tone-neutral">{t("settings.integrations.notConfigured")}</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-2xs leading-4 text-text-muted">
                  {integrations.google.connected
                    ? t("settings.google.connectedBody", {
                        email: integrations.google.email ?? "",
                      })
                    : t(
                        integrations.google.configured
                          ? "settings.google.configuredBody"
                          : "settings.google.missingBody",
                      )}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              {integrations.google.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const result = await disconnectGoogleAccount();
                    if (result.ok) toast.success(t("settings.google.disconnected"));
                    else {
                      toast.error(t("settings.google.disconnectFailed"), {
                        description: result.error,
                      });
                    }
                  }}
                >
                  <Unplug className="h-3 w-3" />
                  {t("settings.google.disconnect")}
                </Button>
              ) : (
                <Tooltip
                  content={
                    integrations.google.configured
                      ? undefined
                      : t("settings.google.missingTip")
                  }
                >
                  <Button
                    variant="primary"
                    size="sm"
                    asChild={integrations.google.configured}
                    disabled={!integrations.google.configured}
                  >
                    {integrations.google.configured ? (
                      <a href="/api/google/connect">{t("settings.google.connect")}</a>
                    ) : (
                      <span>{t("settings.google.connect")}</span>
                    )}
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>

          {integrations.google.missing.length > 0 && (
            <EnvChecklist missing={integrations.google.missing} />
          )}

          <Separator className="my-3" />

          <details className="group">
            <summary className="cursor-pointer text-2xs font-medium text-text-secondary hover:text-text">
              {t("settings.google.requirements")}
            </summary>
            <div className="mt-2 space-y-1.5 text-2xs leading-5 text-text-muted">
              <p>
                <span className="font-medium text-text-secondary">
                  {t("settings.google.req.account")}
                </span>{" "}
                {t("settings.google.req.accountBody")}
              </p>
              <p>
                <span className="font-medium text-text-secondary">
                  {t("settings.google.req.transcription")}
                </span>{" "}
                {t("settings.google.req.transcriptionBody")}
              </p>
              <p>
                <span className="font-medium text-text-secondary">
                  {t("settings.google.req.delay")}
                </span>{" "}
                {tx("settings.google.req.delayBody", {
                  state: <em>{t("transcriptStatus.AWAITING.label")}</em>,
                })}
              </p>
              <p>
                <span className="font-medium text-text-secondary">
                  {t("settings.google.req.scopes")}
                </span>{" "}
                {tx("settings.google.req.scopesBody", {
                  created: (
                    <code className="rounded-[3px] bg-surface px-1 font-mono">
                      meetings.space.created
                    </code>
                  ),
                  readonly: (
                    <code className="rounded-[3px] bg-surface px-1 font-mono">
                      meetings.space.readonly
                    </code>
                  ),
                })}
              </p>
              <p>
                <span className="font-medium text-text-secondary">
                  {t("settings.google.req.redirect")}
                </span>{" "}
                {tx("settings.google.req.redirectBody", {
                  uri: (
                    <code className="break-all rounded-[3px] bg-surface px-1 font-mono">
                      {integrations.redirectUri}
                    </code>
                  ),
                })}
              </p>
            </div>
          </details>
        </div>

        {/* Anthropic */}
        <div className="rounded-lg border border-line bg-canvas p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-text">
                  {t("settings.anthropic.title")}
                  {integrations.anthropic.configured ? (
                    <Badge tone="tone-success">
                      <CircleCheck className="h-2.5 w-2.5" />
                      {t("settings.integrations.ready")}
                    </Badge>
                  ) : (
                    <Badge tone="tone-neutral">{t("settings.integrations.notConfigured")}</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-2xs leading-4 text-text-muted">
                  {t(
                    integrations.anthropic.configured
                      ? "settings.anthropic.readyBody"
                      : "settings.anthropic.missingBody",
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
                {t("settings.anthropic.getKey")}
              </a>
            </Button>
          </div>

          {integrations.anthropic.missing.length > 0 && (
            <EnvChecklist missing={integrations.anthropic.missing} />
          )}
        </div>
      </Section>

      {/* Preferences */}
      <Section
        title={t("settings.preferences.title")}
        description={t("settings.preferences.description")}
      >
        <Field label={t("settings.preferences.defaultOrdering")}>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SortMode);
              void setDefaultSort(value as SortMode).then((result) => {
                if (result.ok) toast.success(t("settings.preferences.orderingSaved"));
              });
            }}
          >
            <SelectTrigger className="w-full sm:w-72">
              {t(`sort.${sort}.label`)}
            </SelectTrigger>
            <SelectContent>
              {SORT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`sort.${mode}.label`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-2xs text-text-faint">{t("settings.preferences.orderingNote")}</p>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
        {description && (
          <p className="mt-0.5 text-2xs leading-4 text-text-muted">{description}</p>
        )}
      </div>
      <div className="space-y-3 px-4 py-3.5">{children}</div>
    </section>
  );
}

function EnvChecklist({ missing }: { missing: string[] }) {
  const t = useT();
  const tx = useTx();

  return (
    <div className="tone-warning mt-2.5 rounded-md bg-[var(--tone-bg)] px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-2xs font-medium text-[var(--tone-fg)]">
        <AlertTriangle className="h-3 w-3" />
        {t("settings.env.missing")}
      </p>
      <ul className="mt-1 space-y-0.5">
        {missing.map((key) => (
          <li key={key} className="font-mono text-2xs text-text-secondary">
            {key}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-2xs leading-4 text-text-muted">
        {tx("settings.env.help", {
          file: <code className="font-mono">.env.local</code>,
        })}
      </p>
    </div>
  );
}

function MemberRow({ person }: { person: MemberSummary }) {
  const t = useT();
  const [name, setName] = useState(person.name);
  const [jobTitle, setJobTitle] = useState(person.jobTitle ?? "");
  const [accent, setAccent] = useState(person.accentToken);
  const [pending, startTransition] = useTransition();

  const dirty =
    name.trim() !== person.name ||
    jobTitle.trim() !== (person.jobTitle ?? "") ||
    accent !== person.accentToken;

  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <div className="flex items-start gap-3">
        <Avatar member={{ ...person, accentToken: accent }} size="xl" />

        <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2">
          <Field label={t("settings.people.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("settings.people.jobTitle")} hint={t("common.optional")}>
            <Input
              value={jobTitle}
              placeholder={t("settings.people.jobTitlePlaceholder")}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </Field>

          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-xs font-medium text-text-secondary">
              {t("settings.people.avatarColour")}
            </p>
            <div className="flex gap-1.5">
              {ACCENT_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setAccent(token)}
                  aria-label={t("settings.people.useColour", { colour: token })}
                  aria-pressed={accent === token}
                  className={cn(
                    "rounded-full p-0.5 transition-all",
                    accent === token ? "ring-2 ring-accent" : "hover:opacity-80",
                  )}
                >
                  <Avatar
                    member={{ name: person.name, initials: person.initials, accentToken: token }}
                    size="md"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="truncate text-2xs text-text-faint">
          {person.email} ·{" "}
          {t(
            person.role === "ADMINISTRATOR"
              ? "sidebar.role.administrator"
              : "sidebar.role.member",
          )}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateMemberProfile({
                memberId: person.id,
                name,
                jobTitle: jobTitle.trim() || null,
                accentToken: accent as AccentToken,
              });
              if (result.ok) toast.success(t("settings.people.profileSaved"));
              else {
                toast.error(t("settings.people.profileFailed"), {
                  description: result.error,
                });
              }
            })
          }
        >
          <Check className="h-3 w-3" />
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

const googleNotices: Record<
  string,
  { tone: string; title: TranslationKey; body: TranslationKey }
> = {
  connected: {
    tone: "tone-success",
    title: "settings.notice.connected.title",
    body: "settings.notice.connected.body",
  },
  denied: {
    tone: "tone-warning",
    title: "settings.notice.denied.title",
    body: "settings.notice.denied.body",
  },
  "state-mismatch": {
    tone: "tone-danger",
    title: "settings.notice.state-mismatch.title",
    body: "settings.notice.state-mismatch.body",
  },
  "exchange-failed": {
    tone: "tone-danger",
    title: "settings.notice.exchange-failed.title",
    body: "settings.notice.exchange-failed.body",
  },
  "not-configured": {
    tone: "tone-warning",
    title: "settings.notice.not-configured.title",
    body: "settings.notice.not-configured.body",
  },
};

function GoogleNotice({ status }: { status: string }) {
  const t = useT();
  const notice = googleNotices[status];
  if (!notice) return null;

  return (
    <div className={cn(notice.tone, "rounded-lg bg-[var(--tone-bg)] px-3 py-2.5")}>
      <p className="text-xs font-medium text-[var(--tone-fg)]">{t(notice.title)}</p>
      <p className="mt-0.5 text-2xs leading-4 text-text-secondary">{t(notice.body)}</p>
    </div>
  );
}
