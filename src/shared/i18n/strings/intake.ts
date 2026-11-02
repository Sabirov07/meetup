import type { Entries } from "./entry";

/**
 * Free-text intake: the "describe the work and let it be divided up" flow.
 *
 * The wording works hard in one specific place. Every label around a model's
 * choice has to say how much of it came from the text the person wrote, so
 * that accepting a batch of tasks never feels like signing something unread.
 */
export const intake = {
  "intake.open": ["Describe tasks", "Описать задачи"],
  "intake.openHint": [
    "Paste text and have it split into assigned tasks",
    "Вставьте текст — он разделится на задачи с исполнителями",
  ],
  "intake.blankTask": ["Blank task", "Пустая задача"],
  "intake.blankTaskHint": ["Fill the fields in yourself", "Заполнить поля самостоятельно"],

  "intake.mode.label": ["How to create this", "Как создавать"],

  "intake.title": ["Describe the work", "Опишите работу"],
  "intake.description": [
    "Write or paste anything — notes, a message, a list. It gets split into tasks with an owner each, and you check them before anything is saved.",
    "Напишите или вставьте что угодно — заметки, сообщение, список. Текст разделится на задачи с исполнителями, и вы проверите их перед сохранением.",
  ],
  "intake.field.brief": ["What needs doing", "Что нужно сделать"],
  "intake.field.briefPlaceholder": [
    "Ann is picking up the billing migration this week — it has to be live before the 14th. Someone needs to write the customer email, and we still owe legal the updated terms. Also the staging database keeps falling over, which is blocking the migration.",
    "Анна берёт на себя перенос биллинга на этой неделе — нужно запустить до 14-го. Кто-то должен написать письмо клиентам, и мы ещё не отдали юристам обновлённые условия. Плюс база на стенде постоянно падает, из-за этого перенос стоит.",
  ],
  "intake.field.briefHint": ["{count} of {max} characters", "{count} из {max} символов"],
  "intake.roster": [
    "Splitting across {count} in this workspace",
    "Делится между участниками: {count}",
  ],
  "intake.submit": ["Split into tasks", "Разделить на задачи"],
  "intake.reading": ["Reading…", "Читаю…"],
  "intake.needsKey": [
    "This needs an ANTHROPIC_API_KEY on the server. You can still create a task by hand.",
    "Для этого нужен ANTHROPIC_API_KEY на сервере. Задачу можно создать вручную.",
  ],
  "intake.failed": ["Could not split that up", "Не удалось разделить текст"],

  "intake.review.title": ["Check before saving", "Проверьте перед сохранением"],
  "intake.review.description": [
    "Nothing has been saved yet. Change anything that is wrong, untick anything you do not want.",
    "Пока ничего не сохранено. Исправьте, что не так, и снимите галочки с ненужного.",
  ],
  "intake.review.summaryLabel": ["What was read", "Что прочитано"],
  "intake.review.spread": ["Split", "Распределение"],
  "intake.review.leftovers": ["Left out", "Не вошло в задачи"],
  "intake.review.leftoversHint": [
    "Read, but not work to do — so nothing was created from it.",
    "Прочитано, но это не работа — задачи из этого не созданы.",
  ],
  "intake.review.needsYou.one": ["{count} needs you", "{count} требует решения"],
  "intake.review.needsYou.few": ["{count} need you", "{count} требуют решения"],
  "intake.review.needsYou.many": ["{count} need you", "{count} требуют решения"],
  "intake.review.needsYou.other": ["{count} need you", "{count} требуют решения"],
  "intake.review.allClear": [
    "Every task came straight from your text",
    "Каждая задача взята прямо из вашего текста",
  ],
  "intake.review.include": ["Create “{title}”", "Создать «{title}»"],
  "intake.review.excluded": ["Will not be created", "Не будет создана"],
  "intake.review.back": ["Back to the text", "Вернуться к тексту"],
  "intake.review.create.one": ["Create {count} task", "Создать {count} задачу"],
  "intake.review.create.few": ["Create {count} tasks", "Создать {count} задачи"],
  "intake.review.create.many": ["Create {count} tasks", "Создать {count} задач"],
  "intake.review.create.other": ["Create {count} tasks", "Создать {count} задачи"],
  "intake.review.createNone": ["Nothing selected", "Ничего не выбрано"],

  "intake.draft.needsYou": ["Needs you", "Нужно решить"],
  "intake.draft.whyThisPerson": ["Why this person", "Почему этот человек"],
  "intake.draft.question": ["Unresolved", "Не решено"],
  "intake.draft.edit": ["Edit text", "Изменить текст"],
  "intake.draft.doneEditing": ["Done", "Готово"],
  "intake.draft.titleLabel": ["Task title", "Название задачи"],
  "intake.draft.descriptionPlaceholder": [
    "Add context for whoever picks this up…",
    "Добавьте контекст для исполнителя…",
  ],
  "intake.draft.noDeadline": ["No date in your text", "В тексте нет даты"],
  "intake.draft.estimate": ["{hours}h", "{hours} ч"],

  "intake.created.one": ["{count} task created", "Создана {count} задача"],
  "intake.created.few": ["{count} tasks created", "Создано {count} задачи"],
  "intake.created.many": ["{count} tasks created", "Создано {count} задач"],
  "intake.created.other": ["{count} tasks created", "Создано {count} задачи"],
  "intake.createFailed": ["Could not create those tasks", "Не удалось создать задачи"],

  "sidebar.create": ["New", "Создать"],
  "sidebar.createLabel": ["Create something", "Что-то создать"],
} satisfies Entries;
