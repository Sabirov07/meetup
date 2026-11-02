import "server-only";

import { THEME_COOKIE, asTheme, type Theme } from "@/shared/theme";
import { cookies } from "next/headers";

/**
 * The theme this request renders in.
 *
 * Read in the root layout, so `data-theme` is on the `<html>` element in the
 * very first byte of HTML. That is the whole point of keeping the choice in a
 * cookie rather than in `localStorage`: no blocking inline script, and no dark
 * page flashing white (or the reverse) before hydration catches up.
 */
export async function resolveTheme(): Promise<Theme> {
  return asTheme((await cookies()).get(THEME_COOKIE)?.value);
}
