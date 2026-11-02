"use client";

import { ExternalLink, Info, Link2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMeeting } from "@/backend/actions/meetings";
import type { MemberSummary } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/ui/avatar";
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
import { Checkbox } from "@/frontend/components/ui/feedback";
import { Field, Input } from "@/frontend/components/ui/field";

export type GoogleState = {
  /** Server has client id / secret / redirect configured. */
  configured: boolean;
  /** This person has completed OAuth. */
  connected: boolean;
  email: string | null;
};

type Mode = "google" | "link" | "none";

export function StartMeetingDialog({
  open,
  onOpenChange,
  members,
  currentMemberId,
  google,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberSummary[];
  currentMemberId: string;
  google: GoogleState;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Rendered inside the portal, so closing the dialog unmounts the form
            and clears the draft — no reset effect required. */}
        <MeetingForm
          onOpenChange={onOpenChange}
          members={members}
          currentMemberId={currentMemberId}
          google={google}
        />
      </DialogContent>
    </Dialog>
  );
}

function MeetingForm({
  onOpenChange,
  members,
  currentMemberId,
  google,
}: {
  onOpenChange: (open: boolean) => void;
  members: MemberSummary[];
  currentMemberId: string;
  google: GoogleState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const googleReady = google.configured && google.connected;
  const [mode, setMode] = useState<Mode>(googleReady ? "google" : "link");
  const t = useT();
  const [title, setTitle] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [participants, setParticipants] = useState<string[]>(() =>
    members.map((m) => m.id),
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createMeeting({
        title: title.trim() || t("start.untitled"),
        mode,
        meetUrl: mode === "link" ? meetUrl.trim() : undefined,
        participantMemberIds: participants,
        guestEmails: [],
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const meeting = result.data;
      toast.success(t("start.created"), {
        description: meeting.meetUrl ? t("start.openingGoogle") : meeting.title,
      });

      // Opened from the click's own transition, so the popup blocker allows it.
      if (meeting.meetUrl) {
        window.open(meeting.meetUrl, "_blank", "noopener,noreferrer");
      }
      onOpenChange(false);
      router.push(`/meetings/${meeting.id}`);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("start.title")}</DialogTitle>
        <DialogDescription>{t("start.description")}</DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-4">
        <Field label={t("start.field.title")} htmlFor="meeting-title">
          <Input
            id="meeting-title"
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("start.field.titlePlaceholder")}
          />
        </Field>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">{t("start.linkHeading")}</p>

          <ModeOption
            selected={mode === "google"}
            disabled={!googleReady}
            onSelect={() => setMode("google")}
            icon={Video}
            title={t("start.mode.google")}
            description={
              googleReady
                ? t("start.mode.googleReady", {
                    account: google.email ?? t("start.mode.googleAccountFallback"),
                  })
                : t(
                    google.configured
                      ? "start.mode.googleNeedsConnect"
                      : "start.mode.googleNeedsServer",
                  )
            }
          />

          <ModeOption
            selected={mode === "link"}
            onSelect={() => setMode("link")}
            icon={Link2}
            title={t("start.mode.link")}
            description={t("start.mode.linkDescription")}
          />

          {mode === "link" && (
            <div className="pl-7 pt-1">
              <Input
                value={meetUrl}
                onChange={(event) => setMeetUrl(event.target.value)}
                placeholder={t("start.mode.linkPlaceholder")}
                aria-label={t("start.mode.linkLabel")}
              />
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-2xs text-accent-bright hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t("start.mode.linkHelp")}
              </a>
            </div>
          )}

          <ModeOption
            selected={mode === "none"}
            onSelect={() => setMode("none")}
            icon={Info}
            title={t("start.mode.none")}
            description={t("start.mode.noneDescription")}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">{t("start.participants")}</p>
          <div className="space-y-0.5">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs text-text-secondary hover:bg-hover"
              >
                <Checkbox
                  checked={participants.includes(member.id)}
                  onCheckedChange={() =>
                    setParticipants((prev) =>
                      prev.includes(member.id)
                        ? prev.filter((id) => id !== member.id)
                        : [...prev, member.id],
                    )
                  }
                />
                <Avatar member={member} size="sm" />
                <span className="min-w-0 flex-1 truncate">{member.name}</span>
                {member.id === currentMemberId && (
                  <span className="text-2xs text-text-faint">{t("common.you")}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="tone-danger rounded-md bg-[var(--tone-bg)] px-2.5 py-2 text-xs leading-5 text-[var(--tone-fg)]"
          >
            {error}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          loading={pending}
          loadingLabel={t("common.creating")}
          disabled={mode === "link" && !meetUrl.trim()}
        >
          {t(mode === "none" ? "start.submitRecord" : "start.submitOpen")}
        </Button>
      </DialogFooter>
    </>
  );
}

function ModeOption({
  selected,
  disabled,
  onSelect,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-line-accent bg-accent-dim/40"
          : "border-line bg-canvas hover:border-line-strong hover:bg-hover",
        disabled &&
          "cursor-not-allowed opacity-55 hover:border-line hover:bg-canvas",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-accent" : "border-line-strong",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <Icon
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          selected ? "text-accent-bright" : "text-text-faint",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-text">{title}</span>
        <span className="mt-0.5 block text-2xs leading-4 text-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}
