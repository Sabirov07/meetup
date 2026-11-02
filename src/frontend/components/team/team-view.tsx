"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Inbox,
  Link2,
  LogOut,
  MoreHorizontal,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  changeMemberRole,
  createInvite,
  leaveWorkspace,
  removeMember,
  revokeInvite,
} from "@/backend/actions/team";
import {
  WORKSPACE_ROLES,
  type InviteView,
  type MemberSummary,
  type TeamMember,
  type TeamView as TeamData,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "@/shared/domain/types";
import { useI18n, useT } from "@/frontend/i18n";
import { Avatar } from "@/frontend/components/ui/avatar";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/frontend/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/frontend/components/ui/menu";

/** Mirrors INVITE_DAYS on the server; shown in the copy next to a fresh link. */
const INVITE_DAYS = 7;

/**
 * Team management.
 *
 * Everything that decides who can see a workspace is on one page, because the
 * answer to "how do I add someone?" should not be spread across Settings, a
 * task board and a menu. Non-administrators see the same roster — knowing who
 * your colleagues are is not privileged — but none of the controls, and no
 * invite links.
 */
export function TeamView({
  workspace,
  viewer,
  team,
  canLeave,
  serverNow,
}: {
  workspace: WorkspaceSummary;
  viewer: MemberSummary;
  team: TeamData;
  /** False when this is the person's only workspace. */
  canLeave: boolean;
  /** The request's clock, so a date reads the same on both renders. */
  serverNow: string;
}) {
  const t = useT();
  const isAdmin = viewer.role === "ADMINISTRATOR";

  return (
    <div className="mx-auto w-full max-w-[52rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <header>
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-text">
          {t("team.heading")}
        </h1>
        <p className="mt-1 text-[13px] leading-5 text-text-muted">{t("team.description")}</p>
      </header>

      {isAdmin && <InvitePanel />}

      {isAdmin && team.invites.length > 0 && <PendingInvites invites={team.invites} />}

      <Section
        title={t("team.members.title")}
        trailing={
          <span className="text-2xs text-text-faint">
            {t("team.members.count", { count: team.members.length })}
          </span>
        }
      >
        <div className="space-y-2">
          {team.members.map((person) => (
            <MemberCard
              key={person.id}
              person={person}
              viewer={viewer}
              isAdmin={isAdmin}
              now={serverNow}
              others={team.members.filter((m) => m.id !== person.id)}
            />
          ))}
        </div>
        {isAdmin && (
          <p className="text-2xs leading-4 text-text-faint">{t("team.role.adminHint")}</p>
        )}
      </Section>

      {team.unassignedTasks > 0 && (
        <Section title={t("team.unassigned.title")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] text-text-secondary">
              <Inbox className="h-4 w-4 shrink-0 text-text-faint" />
              {t("team.unassigned.body", { count: team.unassignedTasks })}
            </p>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/team-tasks">{t("team.unassigned.link")}</Link>
            </Button>
          </div>
        </Section>
      )}

      <LeaveSection workspace={workspace} canLeave={canLeave} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inviting
// ---------------------------------------------------------------------------

function InvitePanel() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  // Administrator by default: everyone who joins is expected to run the
  // place with you. Member is still offered for the rare workspace that
  // wants a do-the-work-only role.
  const [role, setRole] = useState<WorkspaceRole>("ADMINISTRATOR");
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roleLabel = t(
    role === "ADMINISTRATOR" ? "sidebar.role.administrator" : "sidebar.role.member",
  );

  return (
    <Section title={t("team.invite.title")} description={t("team.invite.description")}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field
          label={t("team.invite.email")}
          htmlFor="invite-email"
          hint={t("team.invite.emailHint")}
        >
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            placeholder={t("team.invite.emailPlaceholder")}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={t("team.invite.jobTitle")} htmlFor="invite-title">
          <Input
            id="invite-title"
            value={jobTitle}
            placeholder={t("team.invite.jobTitlePlaceholder")}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </Field>
        <Field label={t("team.invite.role")} hint={t("team.invite.roleHint")}>
          <Select value={role} onValueChange={(value) => setRole(value as WorkspaceRole)}>
            <SelectTrigger className="w-full">{roleLabel}</SelectTrigger>
            <SelectContent>
              {WORKSPACE_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(
                    option === "ADMINISTRATOR"
                      ? "sidebar.role.administrator"
                      : "sidebar.role.member",
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            loading={pending}
            loadingLabel={t("team.invite.creating")}
            onClick={() =>
              startTransition(async () => {
                const result = await createInvite({
                  email: email.trim() || null,
                  role,
                  jobTitle: jobTitle.trim() || null,
                });
                if (result.ok) {
                  setLink(result.data.link);
                  setEmail("");
                  setJobTitle("");
                  toast.success(t("team.invite.created"));
                } else {
                  toast.error(t("team.invite.createFailed"), { description: result.error });
                }
              })
            }
          >
            <UserPlus className="h-3.5 w-3.5" />
            {t("team.invite.create")}
          </Button>
        </div>
      </div>

      {link && <FreshLink link={link} role={roleLabel} />}
    </Section>
  );
}

/**
 * The link, the moment it exists.
 *
 * Shown as selectable text as well as a copy button: clipboard writes fail
 * silently in more browsers than anyone expects, and a link you cannot copy is
 * worthless.
 */
function FreshLink({ link, role }: { link: string; role: string }) {
  const t = useT();

  return (
    <div className="tone-accent rounded-lg bg-[var(--tone-bg)] p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--tone-fg)]">
        <Link2 className="h-3.5 w-3.5" />
        {t("team.invite.created")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-line bg-canvas px-2 py-1.5 font-mono text-2xs text-text-secondary">
          {link}
        </code>
        <CopyButton value={link} />
      </div>
      <p className="mt-1.5 text-2xs leading-4 text-text-muted">
        {t("team.invite.readyNoteAnyone", { role, days: INVITE_DAYS })}
      </p>
    </div>
  );
}

function CopyButton({ value, size = "sm" }: { value: string; size?: "sm" | "xs" }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(t("team.invite.copied"));
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error(t("team.invite.copyFailed"));
        }
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {t("team.invite.copy")}
    </Button>
  );
}

function PendingInvites({ invites }: { invites: InviteView[] }) {
  const { t, f } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Section title={t("team.pending.title")}>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-text">
                {invite.email ?? t("team.pending.anyone")}
                <Badge tone={invite.role === "ADMINISTRATOR" ? "tone-accent" : "tone-neutral"}>
                  {t(
                    invite.role === "ADMINISTRATOR"
                      ? "sidebar.role.administrator"
                      : "sidebar.role.member",
                  )}
                </Badge>
              </p>
              <p className="truncate text-2xs text-text-muted">
                {t("team.pending.expires", { when: f.relative(invite.expiresAt) })}
                {invite.invitedBy &&
                  ` · ${t("team.pending.invitedBy", { name: invite.invitedBy.name })}`}
              </p>
            </div>
            <CopyButton value={invite.link} />
            <Button
              variant="ghost"
              size="sm"
              loading={busy === invite.id}
              onClick={async () => {
                setBusy(invite.id);
                const result = await revokeInvite(invite.id);
                setBusy(null);
                if (result.ok) toast.success(t("team.pending.revoked"));
                else {
                  toast.error(t("team.pending.revokeFailed"), { description: result.error });
                }
              }}
            >
              {t("team.pending.revoke")}
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function MemberCard({
  person,
  viewer,
  isAdmin,
  now,
  others,
}: {
  person: TeamMember;
  viewer: MemberSummary;
  isAdmin: boolean;
  now: string;
  others: TeamMember[];
}) {
  const { t, f } = useI18n();
  const isSelf = person.id === viewer.id;
  const [removing, setRemoving] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
      <Avatar member={person} size="xl" />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-text">
          {person.name}
          {isSelf && (
            <span className="text-2xs font-normal text-text-faint">
              · {t("team.member.you")}
            </span>
          )}
          {person.role === "ADMINISTRATOR" && (
            <Badge tone="tone-accent">
              <Shield className="h-2.5 w-2.5" />
              {t("sidebar.role.administrator")}
            </Badge>
          )}
        </p>
        <p className="truncate text-2xs text-text-muted">
          {person.jobTitle ?? t("team.member.noTitle")} · {person.email}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-2xs text-text-faint">
          {person.openTasks > 0 ? (
            <span>{t("team.member.open", { count: person.openTasks })}</span>
          ) : (
            <span>{t("team.member.nothingOpen")}</span>
          )}
          {person.overdueTasks > 0 && (
            <span className="text-danger">
              {t("team.member.overdue", { count: person.overdueTasks })}
            </span>
          )}
          {person.completedTasks > 0 && (
            <span>{t("team.member.done", { count: person.completedTasks })}</span>
          )}
          <span>{t("team.member.joined", { date: f.date(person.joinedAt, new Date(now)) })}</span>
        </p>
      </div>

      {isAdmin && (
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("team.member.manage", { name: person.name })}
              loading={pending}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </MenuTrigger>
          <MenuContent align="end" className="w-56">
            <MenuItem asChild>
              <Link href={`/team-tasks?owner=${person.id}`}>{t("team.member.viewTasks")}</Link>
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onSelect={() =>
                startTransition(async () => {
                  const result = await changeMemberRole({
                    memberId: person.id,
                    role: person.role === "ADMINISTRATOR" ? "MEMBER" : "ADMINISTRATOR",
                  });
                  if (result.ok) toast.success(t("team.role.changed"));
                  else toast.error(t("team.role.failed"), { description: result.error });
                })
              }
            >
              <Shield className="h-3.5 w-3.5" />
              {t(
                person.role === "ADMINISTRATOR"
                  ? "team.role.makeMember"
                  : "team.role.makeAdmin",
              )}
            </MenuItem>
            {!isSelf && (
              <>
                <MenuSeparator />
                <MenuItem className="text-danger" onSelect={() => setRemoving(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("team.remove.action")}
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      )}

      {removing && (
        <RemoveMemberDialog
          person={person}
          others={others}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  );
}

/**
 * Removing someone, with their open work accounted for.
 *
 * The reassignment choice is the whole reason this is a dialog rather than a
 * menu item: tasks outlive people, and silently dumping a departing
 * colleague's twelve open items into an unassigned pile nobody looks at is how
 * work gets lost.
 */
function RemoveMemberDialog({
  person,
  others,
  onClose,
}: {
  person: TeamMember;
  others: TeamMember[];
  onClose: () => void;
}) {
  const t = useT();
  const UNASSIGNED = "__none__";
  const [heir, setHeir] = useState(UNASSIGNED);
  const [pending, startTransition] = useTransition();

  const heirName =
    heir === UNASSIGNED
      ? t("team.remove.leaveUnassigned")
      : (others.find((m) => m.id === heir)?.name ?? "");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("team.remove.title", { name: person.name })}</DialogTitle>
          <DialogDescription>{t("team.remove.body")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
        {person.openTasks > 0 && (
          <>
            <p className="text-[13px] leading-5 text-text-secondary">
              {t("team.remove.openWork", { count: person.openTasks })}
            </p>
            <Field label={t("team.remove.handTo")}>
              <Select value={heir} onValueChange={setHeir}>
                <SelectTrigger className="w-full">{heirName}</SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>
                    {t("team.remove.leaveUnassigned")}
                  </SelectItem>
                  {others.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await removeMember({
                  memberId: person.id,
                  reassignToMemberId: heir === UNASSIGNED ? null : heir,
                });
                if (result.ok) {
                  toast.success(t("team.remove.done", { name: person.name }));
                  onClose();
                } else {
                  toast.error(t("team.remove.failed"), { description: result.error });
                }
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("team.remove.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveSection({
  workspace,
  canLeave,
}: {
  workspace: WorkspaceSummary;
  canLeave: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Section title={t("team.leave.title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[32rem] text-2xs leading-4 text-text-muted">
          {canLeave ? t("team.leave.body") : t("team.leave.onlyWorkspace")}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!canLeave}
          onClick={() => setConfirming(true)}
        >
          <LogOut className="h-3 w-3" />
          {t("team.leave.action")}
        </Button>
      </div>

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("team.leave.confirm", { name: workspace.name })}</DialogTitle>
              <DialogDescription>{t("team.leave.body")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await leaveWorkspace();
                  if (result.ok) {
                    toast.success(t("team.leave.done", { name: workspace.name }));
                    router.replace("/");
                    router.refresh();
                  } else {
                    toast.error(t("team.leave.failed"), { description: result.error });
                  }
                })
              }
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("team.leave.action")}
            </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Section>
  );
}

function Section({
  title,
  description,
  trailing,
  children,
}: {
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
          {description && (
            <p className="mt-0.5 text-2xs leading-4 text-text-muted">{description}</p>
          )}
        </div>
        {trailing}
      </div>
      <div className="space-y-3 px-4 py-3.5">{children}</div>
    </section>
  );
}
