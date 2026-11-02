import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
} from "date-fns";
import { enUS, ru } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import { formatNumber, type Locale, type Translate } from "@/shared/i18n";

/**
 * Locale-aware formatting.
 *
 * Every function here needs two things the dictionary already holds: the
 * wording ("Today", "3 days overdue") and the pattern ("MMM d" against
 * "d MMM"). So rather than threading a locale through a dozen free functions,
 * the whole set is built once per language and handed out by `useI18n`.
 *
 * The `now`-taking signatures are kept from the original helpers: `cacheComponents`
 * makes an unguarded clock read a build error, so the caller supplies the clock
 * it already has.
 */

const dateFnsLocales: Record<Locale, DateFnsLocale> = { en: enUS, ru };

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date) ? date : null;
}

/** For `<input type="date">`. Deliberately language-independent. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? format(date, "yyyy-MM-dd") : "";
}

export type Formatters = {
  /** "Mar 4" / "4 мар" — with the year when it differs from `now`. */
  date(value: string | Date | null | undefined, now: Date): string;
  dateTime(value: string | Date | null | undefined, now: Date): string;
  time(value: string | Date | null | undefined): string;
  /** A deadline the way a person would say it. */
  dueDate(
    value: string | null | undefined,
    now: Date,
  ): { text: string; overdue: boolean; imminent: boolean };
  /** "2 hours ago" / "2 часа назад". */
  relative(value: string | Date | null | undefined): string;
  /** "In 3 hours" / "через 3 часа", for meeting times. */
  when(value: string | Date | null | undefined, now: Date): string;
  /** "4h", "45m", "2d" — compact effort. */
  effort(minutes: number | null | undefined): string | null;
  /** "Today", "Yesterday", or a long weekday heading. */
  dayHeading(value: string | Date, now: Date): string;
  greeting(now: Date): string;
  number(value: number): string;
};

export function createFormatters(locale: Locale, t: Translate): Formatters {
  const dateFns = dateFnsLocales[locale];
  const pattern = (key: Parameters<Translate>[0]) => t(key);
  const at = (date: Date, key: Parameters<Translate>[0]) =>
    format(date, pattern(key), { locale: dateFns });

  const distance = (date: Date) =>
    formatDistanceToNowStrict(date, { addSuffix: true, locale: dateFns });

  const formatters: Formatters = {
    date(value, now) {
      const date = parse(value);
      if (!date) return t("common.emptyValue");
      return date.getFullYear() === now.getFullYear()
        ? at(date, "format.date")
        : at(date, "format.dateWithYear");
    },

    dateTime(value, now) {
      const date = parse(value);
      if (!date) return t("common.emptyValue");
      return t("format.dateTime", {
        date: formatters.date(date, now),
        time: at(date, "format.time"),
      });
    },

    time(value) {
      const date = parse(value);
      return date ? at(date, "format.time") : t("common.emptyValue");
    },

    dueDate(value, now) {
      const date = parse(value);
      if (!date) return { text: t("dates.noDate"), overdue: false, imminent: false };

      const days = differenceInCalendarDays(date, now);
      if (days < 0) {
        const count = Math.abs(days);
        return { text: t("dates.overdue", { count }), overdue: true, imminent: true };
      }
      if (days === 0) return { text: t("dates.today"), overdue: false, imminent: true };
      if (days === 1) return { text: t("dates.tomorrow"), overdue: false, imminent: true };
      if (days <= 6) {
        return { text: at(date, "format.weekday"), overdue: false, imminent: days <= 3 };
      }
      return { text: formatters.date(date, now), overdue: false, imminent: false };
    },

    relative(value) {
      const date = parse(value);
      return date ? distance(date) : t("common.emptyValue");
    },

    when(value, now) {
      const date = parse(value);
      if (!date) return t("dates.notScheduled");

      const days = Math.abs(differenceInCalendarDays(date, now));
      if (days === 0) {
        return t("format.dateTime", { date: at(date, "format.time"), time: distance(date) });
      }
      if (days <= 6) {
        return t("format.dateTime", { date: at(date, "format.weekdayTime"), time: distance(date) });
      }
      return formatters.dateTime(date, now);
    },

    effort(minutes) {
      if (!minutes || minutes <= 0) return null;
      if (minutes < 60) return t("format.effort.minutes", { value: minutes });

      const hours = minutes / 60;
      if (hours < 8) {
        return t("format.effort.hours", {
          value: Number.isInteger(hours) ? hours : Number(hours.toFixed(1)),
        });
      }
      const days = hours / 8;
      return t("format.effort.days", {
        value: Number.isInteger(days) ? days : Number(days.toFixed(1)),
      });
    },

    dayHeading(value, now) {
      const date = parse(value);
      if (!date) return t("common.emptyValue");

      const days = differenceInCalendarDays(date, now);
      if (days === 0) return t("dates.today");
      if (days === -1) return t("dates.yesterday");
      if (days === 1) return t("dates.tomorrow");
      return format(date, "EEEE, d MMMM", { locale: dateFns });
    },

    greeting(now) {
      const hour = now.getHours();
      if (hour < 5) return t("greeting.stillUp");
      if (hour < 12) return t("greeting.morning");
      if (hour < 18) return t("greeting.afternoon");
      return t("greeting.evening");
    },

    number(value) {
      return formatNumber(value, locale);
    },
  };

  return formatters;
}
