"use client";

import { Info } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveManualTranscript } from "@/backend/actions/meetings";
import type { MeetingView } from "@/shared/domain/types";
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
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  const lines = content.trim() ? content.trim().split("\n").length : 0;

  function submit() {
    startTransition(async () => {
      const result = await saveManualTranscript({ meetingId: meeting.id, content });
      if (!result.ok) {
        toast.error("Could not save the transcript", { description: result.error });
        return;
      }
      toast.success("Transcript saved", { description: "You can run the analysis now." });
      onSaved?.(result.data);
      onOpenChange(false);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a transcript</DialogTitle>
        <DialogDescription>
          Paste the conversation for “{meeting.title}”. It is stored as a manual transcript,
          separate from anything retrieved from Google.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <div className="tone-info flex items-start gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tone-fg)]" />
          <p className="text-2xs leading-4 text-text-secondary">
            Ownership detection works from speaker labels, so keep the{" "}
            <code className="rounded-[3px] bg-canvas px-1 font-mono">Name: what they said</code>{" "}
            format if you can. One turn per line.
          </p>
        </div>

        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          autoFocus
          placeholder={
            "Maya Chen: Where did the auth work land?\nAlex Morgan: Sessions are done, reset is blocked on the email account."
          }
          className="min-h-[18rem] font-mono text-xs leading-5"
        />

        <p className="text-2xs text-text-faint">
          {lines > 0
            ? `${lines} ${lines === 1 ? "line" : "lines"} · ${content.trim().length} characters`
            : "Nothing pasted yet"}
        </p>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          loading={pending}
          loadingLabel="Saving…"
          disabled={content.trim().length < 40}
        >
          Save transcript
        </Button>
      </DialogFooter>
    </>
  );
}
