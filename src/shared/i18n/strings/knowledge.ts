import type { Entries } from "./entry";

/** The knowledge library and a single page in it. */
export const knowledge = {
  "knowledge.heading": ["Knowledge", "База знаний"],
  "knowledge.description": [
    "The things worth keeping: how the work is done, what was decided, and what the next person needs to know.",
    "То, что стоит сохранить: как делается работа, что решили и что нужно знать следующему.",
  ],
  "knowledge.newPage": ["New page", "Новая страница"],
  "knowledge.searchPlaceholder": ["Search the library…", "Поиск по базе…"],
  "knowledge.searchLabel": ["Search the library", "Поиск по базе знаний"],
  "knowledge.empty.title": ["The library is empty", "В базе знаний пусто"],
  "knowledge.empty.description": [
    "Start a page for anything the team keeps re-explaining — how a release goes out, what was agreed with a client, where the credentials live.",
    "Начните страницу о том, что команде приходится объяснять заново: как выходит релиз, о чём договорились с клиентом, где лежат доступы.",
  ],
  "knowledge.empty.action": ["Write the first page", "Написать первую страницу"],
  "knowledge.noMatches.title": ["Nothing matches", "Ничего не найдено"],
  "knowledge.noMatches.description": [
    "Try a different word, or clear the labels you are filtering by.",
    "Попробуйте другое слово или снимите фильтр по меткам.",
  ],
  "knowledge.pinned": ["Pinned", "Закреплено"],
  "knowledge.otherMatches": ["Other matches", "Другие совпадения"],
  "knowledge.allPages": ["All pages", "Все страницы"],
  "knowledge.actionsFor": ["Actions for {title}", "Действия: {title}"],
  "knowledge.unpin": ["Unpin", "Открепить"],
  "knowledge.pinToTop": ["Pin to the top", "Закрепить сверху"],
  "knowledge.unpinFromTop": ["Unpin from the top", "Открепить сверху"],
  "knowledge.pinThisPage": ["Pin this page", "Закрепить страницу"],
  "knowledge.unpinThisPage": ["Unpin this page", "Открепить страницу"],
  "knowledge.deletePage": ["Delete page", "Удалить страницу"],
  "knowledge.emptyPage": ["Empty page.", "Страница пустая."],
  "knowledge.words": ["{count} w", "{count} сл."],

  "knowledge.pageActions": ["Page actions", "Действия со страницей"],
  "knowledge.editPage": ["Edit page", "Редактировать"],
  "knowledge.stopEditing": ["Stop editing", "Закончить правку"],
  "knowledge.pageTitle": ["Page title", "Название страницы"],
  "knowledge.untitled": ["Untitled page", "Страница без названия"],
  "knowledge.editedBy": ["{name} edited {when}", "{name} изменил(а) {when}"],
  "knowledge.edited": ["Edited {when}", "Изменено {when}"],
  "knowledge.removeLabel": ["Remove the {label} label", "Убрать метку «{label}»"],
  "knowledge.labelPlaceholder": ["onboarding", "онбординг"],
  "knowledge.addLabel": ["Label", "Метка"],
  "knowledge.editorPlaceholder": [
    "Write it down. Paste a screenshot, or type / for a block.",
    "Запишите это. Вставьте скриншот или введите / для блока.",
  ],

  "knowledge.createFailed": ["Could not start that page", "Не удалось создать страницу"],
  "knowledge.changeFailed": ["Could not change that page", "Не удалось изменить страницу"],
  "knowledge.saveChangeFailed": [
    "Could not save that change",
    "Не удалось сохранить изменение",
  ],
  "knowledge.saveFailed": ["Could not save this page", "Не удалось сохранить страницу"],
  "knowledge.deleteFailed": ["Could not delete that page", "Не удалось удалить страницу"],
  "knowledge.deleted": ["Page deleted", "Страница удалена"],
} satisfies Entries;
