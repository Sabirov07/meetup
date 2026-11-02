/**
 * The two themes the interface renders in.
 *
 * Both are real, hand-tuned palettes in `globals.css` — this module only names
 * them and carries the cookie contract, so the server and the client agree on
 * what "light" means without either importing the other's code.
 *
 * There is deliberately no "follow the system" option. The product is
 * dark-first by design, a choice is a choice, and `prefers-color-scheme` is not
 * readable on the server without client hints — which would put a flash of the
 * wrong theme on every first paint. A cookie has none of those problems.
 */

export const THEMES = ["dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "dark";

/** Readable, not httpOnly: the client sets it when the theme changes. */
export const THEME_COOKIE = "meetup_theme";

/** A year. The choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function asTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/**
 * What the browser tints its own chrome with — the address bar on Android, the
 * status area of an installed PWA. It has to match `--color-canvas` of the
 * theme being rendered, or the page appears to float on the wrong background.
 */
export const themeColor: Record<Theme, string> = {
  dark: "#101114",
  light: "#f6f7f9",
};
