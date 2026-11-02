import type { Entries } from "./entry";

/**
 * Sections of a workspace: the sidebar list, the per-section board, and the
 * dialogs that create, edit and delete one.
 *
 * Russian note: "раздел" (section) is masculine, so the agreement here differs
 * from the workspace strings in `team.ts`, where "пространство" is neuter.
 */
export const spaces = {
  "nav.section.spaces": ["Sections", "Разделы"],
  "spaces.add": ["New section", "Новый раздел"],
  "spaces.addShort": ["Add a section", "Добавить раздел"],
  "spaces.manage": ["Manage {name}", "Управление: {name}"],
  "spaces.empty": [
    "No sections yet. Make one per area — front end, design, back end — and file work under it.",
    "Разделов пока нет. Создайте по одному на направление — фронт, дизайн, бэкенд — и складывайте задачи туда.",
  ],
  "spaces.emptyShort": ["No sections yet", "Разделов пока нет"],
  "spaces.unfiled": ["No section", "Без раздела"],
  "spaces.unfiledDescription": [
    "Work that has not been filed under a section yet.",
    "Задачи, которые ещё не отнесены ни к одному разделу.",
  ],
  "spaces.page.description": [
    "Everything filed under this section, across every assignee.",
    "Всё, что отнесено к этому разделу, по всем исполнителям.",
  ],
  "spaces.gone": [
    "That section no longer exists",
    "Этого раздела больше нет",
  ],
  "spaces.goneBody": [
    "It may have been deleted. The work that was in it is still here, under “No section”.",
    "Возможно, его удалили. Задачи из него никуда не делись — они в «Без раздела».",
  ],
  "spaces.backToAll": ["Go to all tasks", "Ко всем задачам"],

  // --- The facet and the picker ----------------------------------------
  "spaces.facet": ["Section", "Раздел"],
  "spaces.field": ["Section", "Раздел"],
  "spaces.fieldHint": [
    "Which area of the workspace this belongs to",
    "К какому направлению относится задача",
  ],
  "spaces.moveTo": ["Move to section", "Перенести в раздел"],
  "spaces.moved": ["Moved to {name}", "Перенесено в «{name}»"],
  "spaces.movedOut": ["Taken out of its section", "Убрано из раздела"],

  // --- Counts -----------------------------------------------------------
  "spaces.count.open.one": ["{count} open", "открыта {count}"],
  "spaces.count.open.few": ["{count} open", "открыто {count}"],
  "spaces.count.open.many": ["{count} open", "открыто {count}"],
  "spaces.count.open.other": ["{count} open", "открыто {count}"],
  "spaces.count.nothingOpen": ["Nothing open", "Нет открытых задач"],

  // --- Creating and editing --------------------------------------------
  "spaces.create.title": ["New section", "Новый раздел"],
  "spaces.create.description": [
    "A section groups work by area. Everyone in the workspace can see it.",
    "Раздел группирует задачи по направлению. Его видят все в пространстве.",
  ],
  "spaces.edit.title": ["Edit section", "Изменить раздел"],
  "spaces.edit.description": [
    "Rename it, give it a colour, or say what belongs in it.",
    "Переименуйте, выберите цвет или опишите, что сюда относится.",
  ],
  "spaces.field.name": ["Name", "Название"],
  "spaces.field.namePlaceholder": ["Front end", "Фронтенд"],
  "spaces.field.description": ["What belongs here", "Что сюда относится"],
  "spaces.field.descriptionPlaceholder": [
    "Everything the browser touches",
    "Всё, что видит браузер",
  ],
  "spaces.field.colour": ["Colour", "Цвет"],
  "spaces.created": ["Section created", "Раздел создан"],
  "spaces.createFailed": ["Could not create that section", "Не удалось создать раздел"],
  "spaces.saved": ["Section saved", "Раздел сохранён"],
  "spaces.saveFailed": ["Could not save that section", "Не удалось сохранить раздел"],
  "spaces.rename": ["Rename", "Переименовать"],

  // --- Deleting ---------------------------------------------------------
  "spaces.delete": ["Delete section", "Удалить раздел"],
  "spaces.delete.title": ["Delete “{name}”?", "Удалить «{name}»?"],
  "spaces.delete.body": [
    "The section goes; the work in it does not. Those tasks move to “No section” and can be filed somewhere else.",
    "Удалится только раздел — задачи останутся. Они перейдут в «Без раздела», и их можно будет отнести куда-то ещё.",
  ],
  "spaces.delete.holding.one": [
    "It is holding {count} task.",
    "В нём {count} задача.",
  ],
  "spaces.delete.holding.few": [
    "It is holding {count} tasks.",
    "В нём {count} задачи.",
  ],
  "spaces.delete.holding.many": [
    "It is holding {count} tasks.",
    "В нём {count} задач.",
  ],
  "spaces.delete.holding.other": [
    "It is holding {count} tasks.",
    "В нём {count} задачи.",
  ],
  "spaces.delete.confirm": ["Delete", "Удалить"],
  "spaces.deleted": ["Section deleted", "Раздел удалён"],
  "spaces.deleteFailed": ["Could not delete that section", "Не удалось удалить раздел"],
  "spaces.deletedFreed.one": [
    "{count} task moved to “No section”.",
    "{count} задача перенесена в «Без раздела».",
  ],
  "spaces.deletedFreed.few": [
    "{count} tasks moved to “No section”.",
    "{count} задачи перенесены в «Без раздела».",
  ],
  "spaces.deletedFreed.many": [
    "{count} tasks moved to “No section”.",
    "{count} задач перенесены в «Без раздела».",
  ],
  "spaces.deletedFreed.other": [
    "{count} tasks moved to “No section”.",
    "{count} задачи перенесены в «Без раздела».",
  ],
} satisfies Entries;
