import type { Entries } from "./entry";

/**
 * Date wording and the `date-fns` patterns each language uses.
 *
 * The patterns live here rather than in the formatter because they genuinely
 * differ: English writes "Mar 4" and a 12-hour clock, Russian writes "4 мар"
 * and a 24-hour one. Treating the pattern as a translated string keeps that
 * decision next to every other language decision.
 */
export const dates = {
  "format.date": ["MMM d", "d MMM"],
  "format.dateWithYear": ["MMM d, yyyy", "d MMM yyyy"],
  "format.time": ["h:mm a", "HH:mm"],
  "format.weekday": ["EEEE", "EEEE"],
  "format.weekdayTime": ["EEE h:mm a", "EEE HH:mm"],
  "format.dateTime": ["{date} · {time}", "{date} · {time}"],

  "format.effort.minutes": ["{value}m", "{value} мин"],
  "format.effort.hours": ["{value}h", "{value} ч"],
  "format.effort.days": ["{value}d", "{value} дн"],

  "dates.today": ["Today", "Сегодня"],
  "dates.yesterday": ["Yesterday", "Вчера"],
  "dates.tomorrow": ["Tomorrow", "Завтра"],
  "dates.noDate": ["No date", "Без срока"],
  "dates.notScheduled": ["Not scheduled", "Не запланировано"],
  "dates.overdue.one": ["{count} day overdue", "просрочено на {count} день"],
  "dates.overdue.few": ["{count} days overdue", "просрочено на {count} дня"],
  "dates.overdue.many": ["{count} days overdue", "просрочено на {count} дней"],
  "dates.overdue.other": ["{count} days overdue", "просрочено на {count} дня"],

  "greeting.stillUp": ["Still up", "Ещё не спите"],
  "greeting.morning": ["Good morning", "Доброе утро"],
  "greeting.afternoon": ["Good afternoon", "Добрый день"],
  "greeting.evening": ["Good evening", "Добрый вечер"],
} satisfies Entries;
