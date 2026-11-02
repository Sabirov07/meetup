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
  /**
   * The example is written with the real people in the workspace, and with
   * the reader as the one speaking. A placeholder full of strangers teaches
   * nothing; one that says "{first} is paying…" and "I'll make…" shows
   * both ways of assigning work in the only names that matter here.
   *
   * Four shapes, because a workspace may have one person in it or twenty. The
   * longest one is the honest case: a line of work each, with the reader's own
   * among them.
   */
  "intake.field.placeholder.trio": [
    "{first} is paying for the subscriptions this week — they renew on the 14th. I'll make the changes to the catalog myself, {second} should review them, and {third} is sketching the new designs. Also the staging database keeps falling over, which is blocking the catalog work.",
    "{first} оплачивает подписки на этой неделе — продление 14-го. Правки в каталог внесу я, {second} их проверит, а {third} рисует новые макеты. Плюс база на стенде постоянно падает, из-за этого правки стоят.",
  ],
  "intake.field.placeholder.pair": [
    "{first} is paying for the subscriptions this week — they renew on the 14th. I'll make the changes to the catalog myself, and {second} should review them. Also the staging database keeps falling over, which is blocking the catalog work.",
    "{first} оплачивает подписки на этой неделе — продление 14-го. Правки в каталог внесу я, а {second} их проверит. Плюс база на стенде постоянно падает, из-за этого правки стоят.",
  ],
  "intake.field.placeholder.single": [
    "{first} is paying for the subscriptions this week — they renew on the 14th. I'll make the changes to the catalog myself, and someone needs to review them. Also the staging database keeps falling over, which is blocking the catalog work.",
    "{first} оплачивает подписки на этой неделе — продление 14-го. Правки в каталог внесу я, и кто-то должен их проверить. Плюс база на стенде постоянно падает, из-за этого правки стоят.",
  ],
  "intake.field.placeholder.solo": [
    "The subscriptions have to be paid for before they renew on the 14th. I'll make the changes to the catalog myself, and they still need reviewing. Also the staging database keeps falling over, which is blocking the catalog work.",
    "Подписки нужно оплатить до продления 14-го. Правки в каталог внесу я, и их ещё нужно проверить. Плюс база на стенде постоянно падает, из-за этого правки стоят.",
  ],
  "intake.field.briefHint": ["{count} of {max} characters", "{count} из {max} символов"],
  "intake.you": ["you", "вы"],
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

  "sidebar.addTask": ["Add task", "Добавить задачу"],
  "sidebar.create.title": ["Add a task", "Добавить задачу"],
  "sidebar.create.body": [
    "Write down what needs doing and who owns it.",
    "Запишите, что нужно сделать и кто за это отвечает.",
  ],
} satisfies Entries;
