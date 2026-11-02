"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, themeColor, type Theme } from "@/shared/theme";

/**
 * Theme, held in client state.
 *
 * Switching is a `setState` plus one attribute on `<html>`: every colour in the
 * product resolves through a token, so the browser re-resolves the whole tree
 * from the new values and nothing re-renders for the sake of a colour. The
 * cookie is written at the same time so the *server* renders the next page load
 * in the same theme, which is what stops a reload from flashing the old one.
 */

type ThemeValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
  /** Convenience for the one-tap toggle in places with no room for a menu. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);

    // The attribute the stylesheet keys off, and the `theme-color` meta the
    // root layout rendered for the *previous* choice — the browser reads that
    // one live, so leaving it stale tints the address bar the wrong colour.
    document.documentElement.dataset.theme = next;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor[next]);

    document.cookie = [
      `${THEME_COOKIE}=${next}`,
      "path=/",
      `max-age=${THEME_COOKIE_MAX_AGE}`,
      "samesite=lax",
    ].join("; ");
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }
  return value;
}
