"use client";

import { Check, Moon, Sun, SunMoon } from "lucide-react";
import { THEMES, type Theme } from "@/shared/theme";
import { useT } from "@/frontend/i18n";
import { useTheme } from "@/frontend/theme";
import { cn } from "@/frontend/lib/utils";
import { MenuLabel, MenuRadioGroup, MenuRadioItem } from "@/frontend/components/ui/menu";
import { Tooltip } from "@/frontend/components/ui/feedback";

/**
 * Theme is a client-state switch, so these are ordinary onClick handlers:
 * nothing is submitted, nothing is awaited, and the whole interface is in the
 * other theme on the next frame.
 */

const icons: Record<Theme, typeof Moon> = { dark: Moon, light: Sun };

/** For the account dropdown in the sidebar. */
export function ThemeMenuSection() {
  const { theme, setTheme } = useTheme();
  const t = useT();

  return (
    <>
      <MenuLabel className="flex items-center gap-1.5">
        <SunMoon className="h-3 w-3" />
        {t("theme.label")}
      </MenuLabel>
      <MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
        {THEMES.map((option) => {
          const Icon = icons[option];
          return (
            <MenuRadioItem key={option} value={option}>
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t(`theme.${option}.label`)}
            </MenuRadioItem>
          );
        })}
      </MenuRadioGroup>
    </>
  );
}

/** For the settings page, where there is room to show both options at once. */
export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const t = useT();

  return (
    <div role="radiogroup" aria-label={t("theme.label")} className="flex flex-wrap gap-2">
      {THEMES.map((option) => {
        const active = option === theme;
        const Icon = icons[option];
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option)}
            className={cn(
              "flex min-w-[9rem] items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? "border-accent bg-accent/8"
                : "border-line bg-canvas hover:border-line-strong hover:bg-hover",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-text">
                {t(`theme.${option}.label`)}
              </span>
              <span className="block truncate text-2xs text-text-faint">
                {t(`theme.${option}.hint`)}
              </span>
            </span>
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent-bright" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One tap, for the places with no room for a menu: the header, and the sign-in
 * and sign-up pages, which have no chrome at all. With two themes a toggle says
 * everything a picker would, so the label names where it goes rather than where
 * it is.
 */
export function ThemeInlineToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();

  const next = theme === "dark" ? "light" : "dark";
  const label = t(`theme.switchTo.${next}`);
  const Icon = icons[next];

  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-hover hover:text-text",
          className,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    </Tooltip>
  );
}
