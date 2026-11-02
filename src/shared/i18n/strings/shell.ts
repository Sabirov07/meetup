import type { Entries } from "./entry";

/** The chrome that is on screen on every route: sidebar, header, palette. */
export const shell = {
  "sidebar.expand": ["Expand sidebar", "Развернуть панель"],
  "sidebar.collapse": ["Collapse sidebar", "Свернуть панель"],
  "sidebar.openNavigation": ["Open navigation", "Открыть навигацию"],
  "sidebar.accountMenu": ["Account menu", "Меню аккаунта"],
  "sidebar.workspaceSettings": ["Workspace settings", "Настройки пространства"],
  "sidebar.signOut": ["Sign out", "Выйти"],
  "sidebar.role.administrator": ["Administrator", "Администратор"],
  "sidebar.role.member": ["Member", "Участник"],

  "header.searchPlaceholder": ["Search…", "Поиск…"],
  "header.notifications": ["Notifications", "Уведомления"],
  "header.notificationsWithCount": ["Notifications, {count} items", "Уведомления: {count}"],
  "header.needsAttention": ["Needs attention", "Требует внимания"],
  "header.reviewCount": ["Review {count}", "Проверить {count}"],
  "header.nothingNeedsYou": [
    "Nothing needs you right now.",
    "Сейчас ничего не требует вашего внимания.",
  ],
  "header.createTask": ["Create a task", "Создать задачу"],
  "header.newTask": ["New task", "Новая задача"],
  "header.startMeeting": ["Start meeting", "Начать встречу"],

  "alerts.overdue.title.one": [
    "{count} of your tasks is overdue",
    "{count} ваша задача просрочена",
  ],
  "alerts.overdue.title.few": [
    "{count} of your tasks are overdue",
    "{count} ваши задачи просрочены",
  ],
  "alerts.overdue.title.many": [
    "{count} of your tasks are overdue",
    "{count} ваших задач просрочено",
  ],
  "alerts.overdue.title.other": [
    "{count} of your tasks are overdue",
    "{count} ваших задач просрочено",
  ],
  "alerts.overdue.detail": [
    "Re-date what still matters and drop what does not.",
    "Перенесите сроки там, где это ещё важно, а остальное закройте.",
  ],
  "alerts.today.title.one": ["{count} task is due today", "{count} задача со сроком сегодня"],
  "alerts.today.title.few": ["{count} tasks are due today", "{count} задачи со сроком сегодня"],
  "alerts.today.title.many": ["{count} tasks are due today", "{count} задач со сроком сегодня"],
  "alerts.today.title.other": ["{count} tasks are due today", "{count} задачи со сроком сегодня"],
  "alerts.today.detail": ["Assigned to you.", "Назначено вам."],
  "alerts.review.title.one": [
    "{count} proposed task awaiting review",
    "{count} предложенная задача ждёт проверки",
  ],
  "alerts.review.title.few": [
    "{count} proposed tasks awaiting review",
    "{count} предложенные задачи ждут проверки",
  ],
  "alerts.review.title.many": [
    "{count} proposed tasks awaiting review",
    "{count} предложенных задач ждут проверки",
  ],
  "alerts.review.title.other": [
    "{count} proposed tasks awaiting review",
    "{count} предложенные задачи ждут проверки",
  ],
  "alerts.review.detail": [
    "Approve, edit or reject them before they become commitments.",
    "Примите, измените или отклоните их, прежде чем они станут обязательствами.",
  ],
  "alerts.unclear.title.one": ["{count} task needs a decision", "{count} задача требует решения"],
  "alerts.unclear.title.few": ["{count} tasks need a decision", "{count} задачи требуют решения"],
  "alerts.unclear.title.many": ["{count} tasks need a decision", "{count} задач требуют решения"],
  "alerts.unclear.title.other": ["{count} tasks need a decision", "{count} задачи требуют решения"],
  "alerts.unclear.detail": [
    "The assignee or deadline was left unclear.",
    "Не указан исполнитель или срок.",
  ],
  "alerts.transcripts.title.one": [
    "{count} meeting is waiting on a transcript",
    "{count} встреча ждёт расшифровку",
  ],
  "alerts.transcripts.title.few": [
    "{count} meetings are waiting on a transcript",
    "{count} встречи ждут расшифровку",
  ],
  "alerts.transcripts.title.many": [
    "{count} meetings are waiting on a transcript",
    "{count} встреч ждут расшифровку",
  ],
  "alerts.transcripts.title.other": [
    "{count} meetings are waiting on a transcript",
    "{count} встречи ждут расшифровку",
  ],
  "alerts.transcripts.detail": [
    "Add one manually, or check the Google connection.",
    "Добавьте её вручную или проверьте подключение Google.",
  ],

  "palette.title": ["Search the workspace", "Поиск по пространству"],
  "palette.placeholder": [
    "Search tasks, meetings, or jump to a page…",
    "Найдите задачу или встречу — или перейдите на страницу…",
  ],
  "palette.minChars": [
    "Type at least two characters to search.",
    "Введите хотя бы два символа.",
  ],
  "palette.noResults": ["Nothing matches “{query}”.", "Ничего не найдено по запросу «{query}»."],
  "palette.goTo": ["Go to {label}", "Перейти: {label}"],
  "palette.kind.page": ["Page", "Страница"],
  "palette.kind.meeting": ["Meeting", "Встреча"],

  "language.label": ["Language", "Язык"],
  "language.heading": ["Language", "Язык"],
  "language.description": [
    "Applies immediately, on this device and anywhere else you sign in.",
    "Применяется сразу — на этом устройстве и везде, где вы входите.",
  ],
} satisfies Entries;
