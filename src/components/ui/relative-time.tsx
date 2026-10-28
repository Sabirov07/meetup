"use client";

import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/format";

/**
 * "2 minutes ago", without the hydration mismatch.
 *
 * A relative timestamp is computed from the clock, so the server's HTML and
 * the client's first render legitimately disagree — the server says "56 seconds
 * ago" and by the time React hydrates it is a minute. `suppressHydrationWarning`
 * tells React that difference is expected for this node, and the interval keeps
 * it honest on a tab that stays open.
 */
export function RelativeTime({
  value,
  className,
}: {
  value: string | Date | null | undefined;
  className?: string;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRelative(value)}
    </span>
  );
}
