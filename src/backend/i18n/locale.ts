import "server-only";

import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  getDictionary,
  isLocale,
  negotiateLocale,
  translate,
  type Locale,
  type Translate,
} from "@/shared/i18n";

/**
 * The language this request renders in.
 *
 * The cookie wins, because it is an explicit choice. Failing that the browser's
 * `Accept-Language` decides, so a Russian-speaking visitor gets Russian on the
 * very first paint without having to find a setting.
 *
 * Reading a cookie here is what makes the first render of a page match what the
 * client will show after hydration — it is the difference between a language
 * switch that survives a reload and one that flashes English first.
 */
export async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return negotiateLocale((await headers()).get("accept-language"));
}

/** `t` for server components and `generateMetadata`. */
export async function getTranslator(): Promise<{ locale: Locale; t: Translate }> {
  const locale = await resolveLocale();
  const dictionary = getDictionary(locale);
  return { locale, t: (key, vars) => translate(dictionary, locale, key, vars) };
}
