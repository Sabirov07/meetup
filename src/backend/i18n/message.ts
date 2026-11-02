import "server-only";

import type { TranslationKey, Vars } from "@/shared/i18n";
import { getTranslator } from "./locale";

/**
 * One message, in the language of the current request.
 *
 * Server Functions reply with finished sentences rather than keys, because the
 * client shows them in a toast the moment they arrive and has no way to know
 * what a key means. Resolving here keeps the locale cookie as the single source
 * of that decision, on the server as well as in the browser.
 */
export async function message(key: TranslationKey, vars?: Vars): Promise<string> {
  const { t } = await getTranslator();
  return t(key, vars);
}
