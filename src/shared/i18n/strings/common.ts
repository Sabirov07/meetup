import type { Entries } from "./entry";

/** Verbs, confirmations and small words that recur across the whole product. */
export const common = {
  "common.save": ["Save", "Сохранить"],
  "common.saving": ["Saving…", "Сохранение…"],
  "common.cancel": ["Cancel", "Отмена"],
  "common.close": ["Close", "Закрыть"],
  "common.delete": ["Delete", "Удалить"],
  "common.creating": ["Creating…", "Создание…"],
  "common.add": ["Add", "Добавить"],
  "common.retry": ["Try again", "Попробовать снова"],
  "common.clear": ["Clear", "Очистить"],
  "common.clearAll": ["Clear all", "Сбросить всё"],
  "common.done": ["Done", "Готово"],
  "common.copy": ["Copy", "Копировать"],
  "common.copied": ["Copied", "Скопировано"],
  "common.unassigned": ["Unassigned", "Без исполнителя"],
  "common.you": ["You", "Вы"],
  "common.optional": ["Optional", "Необязательно"],
  "common.emptyValue": ["—", "—"],
  "common.or": ["or", "или"],
  "common.search": ["Search", "Поиск"],
  "common.filters": ["Filters", "Фильтры"],
  "common.notConnected": ["Not connected", "Не подключено"],
  "common.connected": ["Connected", "Подключено"],
  "common.tagline": ["Conversations to work", "Из разговоров — в работу"],
  "app.description": [
    "Turn conversations into clear ownership. Meetup captures what was agreed, who owns it and what should happen next.",
    "Превращайте разговоры в понятную ответственность. Meetup фиксирует, о чём договорились, кто за это отвечает и что делать дальше.",
  ],

  // Countables that several screens share.
  "common.tasks.one": ["{count} task", "{count} задача"],
  "common.tasks.few": ["{count} tasks", "{count} задачи"],
  "common.tasks.many": ["{count} tasks", "{count} задач"],
  "common.tasks.other": ["{count} tasks", "{count} задачи"],
} satisfies Entries;
