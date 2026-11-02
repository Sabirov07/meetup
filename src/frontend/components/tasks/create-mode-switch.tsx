"use client";

import { Sparkles, SquarePen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TranslationKey } from "@/shared/i18n";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Tooltip } from "@/frontend/components/ui/feedback";

/**
 * Which way of creating work you are looking at: fill the fields in yourself,
 * or describe it and have it split up.
 *
 * It sits at the top of both dialogs rather than as a button in the footer,
 * because the two are the same decision made once — not an action you take
 * after reading a form. Keeping the control in the same place, with the same
 * two options and the same one highlighted, is what makes switching feel like
 * a tab rather than like abandoning what you were doing.
 */
export const CREATE_MODES = ["FORM", "DESCRIBE"] as const;

export type CreateMode = (typeof CREATE_MODES)[number];

const modeMeta: Record<
  CreateMode,
  { label: TranslationKey; hint: TranslationKey; icon: LucideIcon }
> = {
  FORM: { label: "intake.blankTask", hint: "intake.blankTaskHint", icon: SquarePen },
  DESCRIBE: { label: "intake.open", hint: "intake.openHint", icon: Sparkles },
};

export function CreateModeSwitch({
  value,
  onChange,
  className,
}: {
  value: CreateMode;
  onChange: (next: CreateMode) => void;
  className?: string;
}) {
  const t = useT();

  return (
    <div
      role="group"
      aria-label={t("intake.mode.label")}
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-line bg-canvas/60 p-0.5",
        className,
      )}
    >
      {CREATE_MODES.map((mode) => {
        const { label, hint, icon: Icon } = modeMeta[mode];
        const active = value === mode;
        return (
          // The hint belongs in a tooltip, not a `title`: `title` replaces the
          // accessible name, so the tab would announce its explanation instead
          // of what it is.
          <Tooltip key={mode} content={t(hint)}>
            <button
              type="button"
              onClick={() => onChange(mode)}
              aria-pressed={active}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                active
                  ? "bg-raised text-text"
                  : "text-text-muted hover:bg-hover hover:text-text",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  active && mode === "DESCRIBE" ? "text-accent-bright" : undefined,
                )}
              />
              {t(label)}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
