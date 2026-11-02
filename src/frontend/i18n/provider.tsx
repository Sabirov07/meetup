"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  bcp47,
  getDictionary,
  translate,
  type Locale,
  type Translate,
} from "@/shared/i18n";
import { createFormatters, type Formatters } from "./format";

/**
 * Language, held in client state.
 *
 * This is the whole reason switching is instant. Both dictionaries are already
 * in the bundle, so changing language is a `setState` — React re-renders the
 * tree with different strings and nothing is fetched, no route changes, no
 * Suspense boundary falls back, no skeleton appears. The cookie is written at
 * the same time so the *server* renders the next page load in the same
 * language, which is what stops a reload from flashing English.
 *
 * The trade is bundle size: two dictionaries instead of one. For a UI this size
 * that is a few tens of kilobytes, and it buys a switch with no loading state
 * at all.
 */

type I18nValue = {
  locale: Locale;
  t: Translate;
  /** Locale-aware date, number and duration formatting. */
  f: Formatters;
  setLocale: (next: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);

    // Keep the document and the next server render in step. `lang` matters for
    // screen readers and hyphenation; the cookie is what the root layout reads.
    document.documentElement.lang = bcp47[next];
    document.cookie = [
      `${LOCALE_COOKIE}=${next}`,
      "path=/",
      `max-age=${LOCALE_COOKIE_MAX_AGE}`,
      "samesite=lax",
    ].join("; ");
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = getDictionary(locale);
    const t: Translate = (key, vars) => translate(dictionary, locale, key, vars);
    return { locale, t, f: createFormatters(locale, t), setLocale };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside <I18nProvider>.");
  }
  return value;
}

/** Shorthand for the common case of only needing to translate. */
export function useT(): Translate {
  return useI18n().t;
}
