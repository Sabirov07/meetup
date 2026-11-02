"use client";

import {
  AlertTriangle,
  Check,
  CircleCheck,
  ExternalLink,
  Sparkles,
  Unplug,
  Video,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDefaultSort } from "@/backend/actions/preferences";
import {
  disconnectGoogleAccount,
  renameWorkspace,
  setMemberRole,
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
import { sortModeMeta } from "@/shared/domain/labels";
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
  const isAdmin = member.role === "ADMINISTRATOR";
  const [name, setName] = useState(workspace.name);
  const [sort, setSort] = useState(defaultSort);
  const [savingName, startName] = useTransition();

  return (
    <div className="mx-auto w-full max-w-[52rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header>
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">Settings</h1>
        <p className="mt-1 text-[13px] leading-5 text-text-muted">
          Workspace, people, and the integrations that make transcripts and analysis work.
        </p>
      </header>

      {googleNotice && <GoogleNotice status={googleNotice} />}

      {/* Workspace */}
      <Section title="Workspace" description="The name shown in the sidebar.">
        <div className="flex items-end gap-2">
          <Field label="Name" htmlFor="workspace-name" className="flex-1">
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
                if (result.ok) toast.success("Workspace renamed");
                else toast.error("Could not rename the workspace", { description: result.error });
              })
            }
          >
            Save
          </Button>
        </div>
        {!isAdmin && (
          <p className="text-2xs text-text-faint">
            Only an administrator can rename the workspace.
          </p>
        )}
      </Section>

      {/* People */}
      <Section
        title="People"
        description="Two members are seeded by default. Rename them to the real people here — the names seeded by prisma/seed.ts are only placeholders."
      >
        <div className="space-y-2">
          {workspace.members.map((person) => (
            <MemberRow
              key={person.id}
              person={person}
              canEdit={isAdmin || person.id === member.id}
              canChangeRole={isAdmin}
              isSelf={person.id === member.id}
            />
          ))}
        </div>
      </Section>

      {/* Integrations */}
      <Section
        title="Integrations"
        description="Both are optional. The rest of the product works without them; nothing is simulated when they are missing."
      >
        {/* Google */}
        <div className="rounded-lg border border-line bg-canvas p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-text">
                  Google Meet
                  {integrations.google.connected ? (
                    <Badge tone="tone-success">
                      <CircleCheck className="h-2.5 w-2.5" />
                      Connected
                    </Badge>
                  ) : integrations.google.configured ? (
                    <Badge tone="tone-warning">Not connected</Badge>
                  ) : (
                    <Badge tone="tone-neutral">Not configured</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-2xs leading-4 text-text-muted">
                  {integrations.google.connected
                    ? `Authorised as ${integrations.google.email}. Creates real meeting spaces and can read transcripts from calls you took part in.`
                    : integrations.google.configured
                      ? "Server credentials are present. Authorise your Google account to create meetings and pull transcripts."
                      : "Add server credentials to enable meeting creation and transcript retrieval."}
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
                    if (result.ok) toast.success("Google account disconnected");
                    else toast.error("Could not disconnect", { description: result.error });
                  }}
                >
                  <Unplug className="h-3 w-3" />
                  Disconnect
                </Button>
              ) : (
                <Tooltip
                  content={
                    integrations.google.configured
                      ? undefined
                      : "Server credentials are missing — see the checklist below."
                  }
                >
                  <Button
                    variant="primary"
                    size="sm"
                    asChild={integrations.google.configured}
                    disabled={!integrations.google.configured}
                  >
                    {integrations.google.configured ? (
                      <a href="/api/google/connect">Connect Google</a>
                    ) : (
                      <span>Connect Google</span>
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
              What transcript access actually requires
            </summary>
            <div className="mt-2 space-y-1.5 text-2xs leading-5 text-text-muted">
              <p>
                <span className="font-medium text-text-secondary">A Workspace account.</span> Meet
                only generates transcripts on Google Workspace plans that include them. A personal
                @gmail.com account can authorise the API, but the transcript list will always come
                back empty.
              </p>
              <p>
                <span className="font-medium text-text-secondary">
                  Transcription switched on during the call.
                </span>{" "}
                It is not retroactive — if nobody turned it on, no transcript exists afterwards.
              </p>
              <p>
                <span className="font-medium text-text-secondary">A delay after the call.</span>{" "}
                Transcripts are not available the moment a meeting ends, which is why{" "}
                <em>Awaiting transcript</em> is a normal state rather than an error.
              </p>
              <p>
                <span className="font-medium text-text-secondary">Scopes.</span>{" "}
                <code className="rounded-[3px] bg-surface px-1 font-mono">
                  meetings.space.created
                </code>{" "}
                and{" "}
                <code className="rounded-[3px] bg-surface px-1 font-mono">
                  meetings.space.readonly
                </code>
                . Transcript entries are deleted by Google 30 days after the conference ends.
              </p>
              <p>
                <span className="font-medium text-text-secondary">Redirect URI.</span> Add exactly
                this to the OAuth client:{" "}
                <code className="break-all rounded-[3px] bg-surface px-1 font-mono">
                  {integrations.redirectUri}
                </code>
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
                  Claude (transcript analysis)
                  {integrations.anthropic.configured ? (
                    <Badge tone="tone-success">
                      <CircleCheck className="h-2.5 w-2.5" />
                      Ready
                    </Badge>
                  ) : (
                    <Badge tone="tone-neutral">Not configured</Badge>
                  )}
                </p>
                <p className="mt-0.5 text-2xs leading-4 text-text-muted">
                  {integrations.anthropic.configured
                    ? "Transcripts can be analysed into summaries, decisions and proposed tasks."
                    : "Without a key, transcripts are stored but not analysed. Everything else works."}
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
                Get a key
              </a>
            </Button>
          </div>

          {integrations.anthropic.missing.length > 0 && (
            <EnvChecklist missing={integrations.anthropic.missing} />
          )}
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences" description="Applies to your account only.">
        <Field label="Default task ordering">
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SortMode);
              void setDefaultSort(value as SortMode).then((result) => {
                if (result.ok) toast.success("Default ordering saved");
              });
            }}
          >
            <SelectTrigger className="w-full sm:w-72">
              {sortModeMeta[sort].label}
            </SelectTrigger>
            <SelectContent>
              {SORT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {sortModeMeta[mode].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-2xs text-text-faint">
          Smart priority weighs deadlines, blocking impact and status against each task&rsquo;s
          priority level. Manual order is never re-sorted automatically.
        </p>
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
  return (
    <div className="tone-warning mt-2.5 rounded-md bg-[var(--tone-bg)] px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-2xs font-medium text-[var(--tone-fg)]">
        <AlertTriangle className="h-3 w-3" />
        Missing from .env.local
      </p>
      <ul className="mt-1 space-y-0.5">
        {missing.map((key) => (
          <li key={key} className="font-mono text-2xs text-text-secondary">
            {key}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-2xs leading-4 text-text-muted">
        Add them to <code className="font-mono">.env.local</code> and restart the dev server.
        Never paste secrets into the app or commit them.
      </p>
    </div>
  );
}

function MemberRow({
  person,
  canEdit,
  canChangeRole,
  isSelf,
}: {
  person: MemberSummary;
  canEdit: boolean;
  canChangeRole: boolean;
  isSelf: boolean;
}) {
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
          <Field label="Name">
            <Input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Job title" hint="Optional">
            <Input
              value={jobTitle}
              disabled={!canEdit}
              placeholder="Engineer"
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </Field>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Avatar colour</p>
            <div className="flex gap-1.5">
              {ACCENT_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setAccent(token)}
                  aria-label={`Use ${token}`}
                  aria-pressed={accent === token}
                  className={cn(
                    "rounded-full p-0.5 transition-all disabled:opacity-50",
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

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Role</p>
            {canChangeRole ? (
              <Select
                value={person.role}
                onValueChange={(value) =>
                  void setMemberRole({
                    memberId: person.id,
                    role: value as "ADMINISTRATOR" | "MEMBER",
                  }).then((result) => {
                    if (result.ok) toast.success("Role updated");
                    else toast.error("Could not change the role", { description: result.error });
                  })
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  {person.role === "ADMINISTRATOR" ? "Administrator" : "Member"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMINISTRATOR">Administrator</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-text-muted">
                {person.role === "ADMINISTRATOR" ? "Administrator" : "Member"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="truncate text-2xs text-text-faint">
          {person.email}
          {isSelf && " · you"}
        </p>
        {canEdit && (
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
                if (result.ok) toast.success("Profile saved");
                else toast.error("Could not save the profile", { description: result.error });
              })
            }
          >
            <Check className="h-3 w-3" />
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

function GoogleNotice({ status }: { status: string }) {
  const notices: Record<string, { tone: string; title: string; body: string }> = {
    connected: {
      tone: "tone-success",
      title: "Google account connected",
      body: "You can now create Google Meet links and retrieve transcripts for calls you took part in.",
    },
    denied: {
      tone: "tone-warning",
      title: "Consent was declined",
      body: "Nothing was changed. You can try again whenever you like.",
    },
    "state-mismatch": {
      tone: "tone-danger",
      title: "The authorisation could not be verified",
      body: "The anti-forgery check failed, so the connection was refused. Start the flow again from this page.",
    },
    "exchange-failed": {
      tone: "tone-danger",
      title: "Google rejected the token exchange",
      body: "Check that the redirect URI below exactly matches the one in your Google Cloud OAuth client.",
    },
    "not-configured": {
      tone: "tone-warning",
      title: "Google credentials are missing",
      body: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in .env.local.",
    },
  };

  const notice = notices[status];
  if (!notice) return null;

  return (
    <div className={cn(notice.tone, "rounded-lg bg-[var(--tone-bg)] px-3 py-2.5")}>
      <p className="text-xs font-medium text-[var(--tone-fg)]">{notice.title}</p>
      <p className="mt-0.5 text-2xs leading-4 text-text-secondary">{notice.body}</p>
    </div>
  );
}
