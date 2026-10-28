import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Badges read their colours from whichever `tone-*` class is applied, so
 * callers pass a tone name straight from `labels.ts` and never a colour.
 */

export function Badge({
  tone = "tone-neutral",
  variant = "soft",
  className,
  children,
}: {
  tone?: string;
  variant?: "soft" | "outline" | "plain";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        tone,
        "inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-px text-2xs font-medium leading-5",
        variant === "soft" && "bg-[var(--tone-bg)] text-[var(--tone-fg)]",
        variant === "outline" &&
          "border border-current/25 text-[var(--tone-fg)]",
        variant === "plain" && "px-0 text-[var(--tone-fg)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small status dot. Pairs with a label for accessibility, never used alone. */
export function Dot({ tone = "tone-neutral", className }: { tone?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(tone, "tone-dot h-1.5 w-1.5 shrink-0 rounded-full", className)}
    />
  );
}

/** A count chip, e.g. the number next to a panel title. */
export function Count({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-raised px-1 text-2xs font-medium text-text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Keyboard key, used in the search affordance and shortcut hints. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line-strong bg-raised px-1 font-sans text-2xs font-medium text-text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
