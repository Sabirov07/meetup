import { cn } from "@/frontend/lib/utils";

/**
 * The mark reads as a speech bubble whose tail resolves into a check: a
 * conversation that ends in something done. It is drawn to stay legible at
 * 16px, so there is no gradient and no fine detail.
 */
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-[6px] bg-accent-solid",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Top edge highlight — the one place the product uses a gradient. */}
      <span className="pointer-events-none absolute inset-0 rounded-[6px] bg-gradient-to-b from-white/18 to-transparent" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="relative text-white"
        style={{ width: size * 0.64, height: size * 0.64 }}
      >
        <path
          d="M4.2 10.4a6.2 6.2 0 0 1 6.2-6.2h3.2a6.2 6.2 0 0 1 0 12.4H9.1L5.4 19.6v-3.5a6.2 6.2 0 0 1-1.2-3.7Z"
          strokeWidth={1.9}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="m8.9 10.6 2.1 2.1 4-4.2"
          strokeWidth={2.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Wordmark({
  className,
  showTagline,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Logo />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold tracking-[-0.015em] text-text">
          Meetup
        </span>
        {showTagline && (
          <span className="block truncate text-2xs text-text-faint">Conversations to work</span>
        )}
      </span>
    </span>
  );
}
