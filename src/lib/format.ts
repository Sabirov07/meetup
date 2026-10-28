import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid } from "date-fns";

/**
 * Formatting helpers.
 *
 * The `now`-taking variants exist because `cacheComponents` makes a clock read
 * during prerender a build error. Server components pass a `now` they obtained
 * after `connection()`; client components pass their own.
 */

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date) ? date : null;
}

/** "Mar 4" — or "Mar 4, 2025" when the year differs from `now`. */
export function formatDate(value: string | Date | null | undefined, now: Date): string {
  const date = parse(value);
  if (!date) return "—";
  return date.getFullYear() === now.getFullYear()
    ? format(date, "MMM d")
    : format(date, "MMM d, yyyy");
}

export function formatDateTime(value: string | Date | null | undefined, now: Date): string {
  const date = parse(value);
  if (!date) return "—";
  return `${formatDate(date, now)} · ${format(date, "h:mm a")}`;
}

/** For `<input type="date">`. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "yyyy-MM-dd") : "";
}

/**
 * A deadline expressed the way a person would say it: "Today", "Tomorrow",
 * "3 days overdue", "Mar 4".
 */
export function formatDueDate(
  value: string | null | undefined,
  now: Date,
): { text: string; overdue: boolean; imminent: boolean } {
  const date = parse(value);
  if (!date) return { text: "No date", overdue: false, imminent: false };

  const days = differenceInCalendarDays(date, now);
  if (days < 0) {
    const n = Math.abs(days);
    return { text: n === 1 ? "1 day overdue" : `${n} days overdue`, overdue: true, imminent: true };
  }
  if (days === 0) return { text: "Today", overdue: false, imminent: true };
  if (days === 1) return { text: "Tomorrow", overdue: false, imminent: true };
  if (days <= 6) return { text: format(date, "EEEE"), overdue: false, imminent: days <= 3 };
  return { text: formatDate(date, now), overdue: false, imminent: false };
}

/** "2 hours ago". Safe in client components. */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = parse(value);
  if (!date) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** "In 3 hours" / "2 days ago", for meeting times. */
export function formatWhen(value: string | Date | null | undefined, now: Date): string {
  const date = parse(value);
  if (!date) return "Not scheduled";
  const diff = date.getTime() - now.getTime();
  const future = diff > 0;
  const distance = formatDistanceToNowStrict(date);
  const days = Math.abs(differenceInCalendarDays(date, now));
  if (days === 0) return `${format(date, "h:mm a")} · ${future ? `in ${distance}` : `${distance} ago`}`;
  if (days <= 6) return `${format(date, "EEE h:mm a")} · ${future ? `in ${distance}` : `${distance} ago`}`;
  return formatDateTime(date, now);
}

/** "4h", "45m", "2d" — compact effort display. */
export function formatEffort(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 8) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  const days = hours / 8;
  return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
}

/** Greeting that depends only on the supplied clock. */
export function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
