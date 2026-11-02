"use client";

import { Check, Languages } from "lucide-react";
import { LOCALES, localeMeta, type Locale } from "@/shared/i18n";
import { useI18n } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { MenuLabel, MenuRadioGroup, MenuRadioItem } from "@/frontend/components/ui/menu";

/**
 * Language is a client-state switch, so both of these are ordinary onClick
 * handlers: nothing is submitted, nothing is awaited, and the whole interface
 * is in the new language on the next render.
 */

/** For the account dropdown in the sidebar. */
export function LanguageMenuSection() {
  const { locale, setLocale, t } = useI18n();

  return (
    <>
      <MenuLabel className="flex items-center gap-1.5">
        <Languages className="h-3 w-3" />
        {t("language.label")}
      </MenuLabel>
      <MenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        {LOCALES.map((option) => (
          <MenuRadioItem key={option} value={option}>
            <span aria-hidden>{localeMeta[option].flag}</span>
            {localeMeta[option].name}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  );
}

/** For the settings page, where there is room to show both options at once. */
export function LanguageChoice() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t("language.label")}
      className="flex flex-wrap gap-2"
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(option)}
            className={cn(
              "flex min-w-[9rem] items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? "border-accent bg-accent/8"
                : "border-line bg-canvas hover:border-line-strong hover:bg-hover",
            )}
          >
            <span aria-hidden className="text-base leading-none">
              {localeMeta[option].flag}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-text">
                {localeMeta[option].name}
              </span>
              <span className="block truncate text-2xs text-text-faint">
                {localeMeta[option].english}
              </span>
            </span>
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent-bright" />}
          </button>
        );
      })}
    </div>
  );
}

/** Minimal version for the sign-in and sign-up pages, which have no chrome. */
export function LanguageInlineToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t("language.label")}
      className={cn("flex items-center justify-center gap-1 text-2xs", className)}
    >
      {LOCALES.map((option, index) => (
        <span key={option} className="flex items-center gap-1">
          {index > 0 && (
            <span aria-hidden className="text-text-faint">
              ·
            </span>
          )}
          <button
            type="button"
            role="radio"
            aria-checked={option === locale}
            onClick={() => setLocale(option)}
            className={cn(
              "rounded px-1 py-0.5 transition-colors",
              option === locale
                ? "font-medium text-text"
                : "text-text-faint hover:text-text-muted",
            )}
          >
            {localeMeta[option].name}
          </button>
        </span>
      ))}
    </div>
  );
}
