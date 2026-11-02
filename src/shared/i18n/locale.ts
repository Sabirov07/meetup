/**
 * The set of languages the interface speaks.
 *
 * Both dictionaries ship in the client bundle on purpose: switching language is
 * a `setState`, not a navigation, so there is nothing to fetch and nothing to
 * wait for. The cookie exists so the *first* paint is already in the right
 * language — the server renders from it, which is what keeps the switch from
 * flashing English on reload.
 */

export const LOCALES = ["en", "ru"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Readable, not httpOnly: the client sets it when the language changes. */
export const LOCALE_COOKIE = "meetup_locale";

/** A year. The choice is a preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function asLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * How each language names itself. A language picker written in the language
 * being picked is the one label a person can always read.
 */
export const localeMeta: Record<Locale, { name: string; english: string; flag: string }> = {
  en: { name: "English", english: "English", flag: "🇬🇧" },
  ru: { name: "Русский", english: "Russian", flag: "🇷🇺" },
};

/** BCP 47 tag, for `Intl` and the `<html lang>` attribute. */
export const bcp47: Record<Locale, string> = { en: "en", ru: "ru" };

/**
 * Picks the best supported language from an `Accept-Language` header. Used only
 * when someone has never chosen one.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: (tag ?? "").trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag.length > 0 && Number.isFinite(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
