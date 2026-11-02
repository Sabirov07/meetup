"use client";

import { Info } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveManualTranscript } from "@/backend/actions/meetings";
import type { MeetingView } from "@/shared/domain/types";
import { useT, useTx } from "@/frontend/i18n";
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
import { Textarea } from "@/frontend/components/ui/field";

/**
 * Paste a transcript the user obtained themselves.
 *
 * This is what makes the analysis pipeline usable before Google is wired up.
 * It is stored as a manual transcript, and the copy says so — nothing here
 * implies the text was retrieved from Meet.
 */
export function AddTranscriptDialog({
  open,
  onOpenChange,
  meeting,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingView;
  onSaved?: (meeting: MeetingView) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {/* The form lives in its own component inside the portal, so Radix
            unmounting on close is what clears the draft — no reset effect. */}
        <TranscriptForm meeting={meeting} onOpenChange={onOpenChange} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function TranscriptForm({
  meeting,
  onOpenChange,
  onSaved,
}: {
  meeting: MeetingView;
  onOpenChange: (open: boolean) => void;
  onSaved?: (meeting: MeetingView) => void;
}) {
  const t = useT();
  const tx = useTx();
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  const lines = content.trim() ? content.trim().split("\n").length : 0;

  function submit() {
    startTransition(async () => {
      const result = await saveManualTranscript({ meetingId: meeting.id, content });
      if (!result.ok) {
        toast.error(t("transcript.saveFailed"), { description: result.error });
        return;
      }
      toast.success(t("transcript.saved"), { description: t("transcript.savedDetail") });
      onSaved?.(result.data);
      onOpenChange(false);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("transcript.title")}</DialogTitle>
        <DialogDescription>
          {t("transcript.description", { title: meeting.title })}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <div className="tone-info flex items-start gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tone-fg)]" />
          <p className="text-2xs leading-4 text-text-secondary">
            {tx("transcript.formatHint", {
              format: (
                <code className="rounded-[3px] bg-canvas px-1 font-mono">
                  {t("transcript.formatExample")}
                </code>
              ),
            })}
          </p>
        </div>

        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          autoFocus
          placeholder={t("transcript.placeholder")}
          className="min-h-[18rem] font-mono text-xs leading-5"
        />

        <p className="text-2xs text-text-faint">
          {lines > 0
            ? t("transcript.stats", {
                lines: t("transcript.lines", { count: lines }),
                characters: content.trim().length,
              })
            : t("transcript.nothingPasted")}
        </p>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          loading={pending}
          loadingLabel={t("common.saving")}
          disabled={content.trim().length < 40}
        >
          {t("transcript.submit")}
        </Button>
      </DialogFooter>
    </>
  );
}
