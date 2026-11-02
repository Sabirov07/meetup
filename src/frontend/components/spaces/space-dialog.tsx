"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createSpace, deleteSpace, updateSpace } from "@/backend/actions/spaces";
import { ACCENT_TOKENS, type SpaceSummary } from "@/shared/domain/types";
import { useI18n } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
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
import { Field, Input } from "@/frontend/components/ui/field";
import { spaceDot } from "./space-color";

/**
 * Creating and editing a section.
 *
 * One dialog for both, because they are the same three fields and a section
 * is a small enough thing that a separate "settings" screen for it would be
 * ceremony. `space` present means edit; absent means create.
 *
 * Deliberately not a form library: three controls, one of which is a colour
 * swatch row, is below the weight at which react-hook-form earns its import.
 */
export function SpaceDialog({
  open,
  onOpenChange,
  space,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present means edit, absent means create. */
  space?: SpaceSummary | null;
  onSaved?: (space: SpaceSummary) => void;
}) {
  const { t } = useI18n();
  const editing = Boolean(space);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorToken, setColorToken] = useState<string>("violet");
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the dialog opens, or opens on a different section, so a
  // reused instance never shows the last one's values.
  //
  // Adjusting state during render rather than in an effect is React's
  // documented way to sync state with a changed prop: it re-renders before
  // anything is painted, instead of cascading a second time afterwards.
  const seed = open ? `${space?.id ?? "new"}\u0000${space?.name ?? ""}` : null;
  const [seededFrom, setSeededFrom] = useState<string | null>(seed);
  if (seededFrom !== seed) {
    setSeededFrom(seed);
    setName(space?.name ?? "");
    setDescription(space?.description ?? "");
    setColorToken(space?.colorToken ?? "violet");
    setSaving(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    const payload = {
      name: trimmed,
      colorToken: colorToken as (typeof ACCENT_TOKENS)[number],
      description: description.trim() || null,
    };
    const result = space
      ? await updateSpace({ id: space.id, ...payload })
      : await createSpace(payload);
    setSaving(false);

    if (!result.ok) {
      toast.error(t(editing ? "spaces.saveFailed" : "spaces.createFailed"), {
        description: result.error,
      });
      return;
    }

    toast.success(t(editing ? "spaces.saved" : "spaces.created"), {
      description: result.data.name,
    });
    onSaved?.(result.data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>
              {t(editing ? "spaces.edit.title" : "spaces.create.title")}
            </DialogTitle>
            <DialogDescription>
              {t(editing ? "spaces.edit.description" : "spaces.create.description")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <Field label={t("spaces.field.name")} htmlFor="space-name">
              <Input
                id="space-name"
                autoFocus
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("spaces.field.namePlaceholder")}
              />
            </Field>

            <Field
              label={t("spaces.field.description")}
              htmlFor="space-description"
              hint={t("common.optional")}
            >
              <Input
                id="space-description"
                maxLength={200}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("spaces.field.descriptionPlaceholder")}
              />
            </Field>

            <Field label={t("spaces.field.colour")}>
              <div className="flex items-center gap-2">
                {ACCENT_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setColorToken(token)}
                    aria-label={token}
                    aria-pressed={colorToken === token}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                      colorToken === token
                        ? "border-accent-bright"
                        : "border-transparent hover:border-line-strong",
                    )}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full", spaceDot(token))} />
                  </button>
                ))}
              </div>
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!name.trim()}
              loading={saving}
              loadingLabel={t("common.saving")}
            >
              {t(editing ? "common.save" : "spaces.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Deleting a section.
 *
 * The confirmation says what survives, not just what goes: the single
 * question someone has before clicking is "does this take my tasks with it?",
 * and the answer is no.
 */
export function DeleteSpaceDialog({
  open,
  onOpenChange,
  space,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: SpaceSummary | null;
  onDeleted?: (spaceId: string) => void;
}) {
  const { t } = useI18n();
  const [working, setWorking] = useState(false);

  async function confirm() {
    if (!space || working) return;
    setWorking(true);
    const result = await deleteSpace(space.id);
    setWorking(false);

    if (!result.ok) {
      toast.error(t("spaces.deleteFailed"), { description: result.error });
      return;
    }

    toast.success(t("spaces.deleted"), {
      description:
        result.data.freedTasks > 0
          ? t("spaces.deletedFreed", { count: result.data.freedTasks })
          : undefined,
    });
    onDeleted?.(space.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("spaces.delete.title", { name: space?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("spaces.delete.body")}</DialogDescription>
        </DialogHeader>

        {space && space.totalTasks > 0 && (
          <DialogBody>
            <p className="text-[13px] leading-5 text-text-secondary">
              {t("spaces.delete.holding", { count: space.totalTasks })}
            </p>
          </DialogBody>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={confirm}
            loading={working}
            loadingLabel={t("common.saving")}
          >
            {t("spaces.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
