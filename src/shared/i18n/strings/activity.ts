import type { Entries } from "./entry";

/**
 * The activity feed.
 *
 * `activity.line.*` is the verb phrase for an event; `activity.withTitle`
 * attaches the thing it happened to, when that thing is still around to be
 * named. Splitting it that way means one sentence per event type instead of two,
 * and it keeps Russian's quotation marks and word order in the translation
 * rather than in the component.
 */
export const activity = {
  "activity.heading": ["Activity", "Активность"],
  "activity.description": [
    "Everything that has changed, and how the workspace is tracking.",
    "Всё, что изменилось, и как идут дела в пространстве.",
  ],
  "activity.history": ["History", "История"],
  "activity.empty.title": ["Nothing has happened yet", "Пока ничего не происходило"],
  "activity.empty.description": [
    "Task changes, meetings and approved proposals all show up here.",
    "Здесь появятся изменения задач, встречи и принятые предложения.",
  ],
  "activity.someone": ["Someone", "Кто-то"],
  "activity.viewMeeting": ["View meeting", "Открыть встречу"],

  "activity.completion": ["Completion", "Выполнение"],
  "activity.completionRate": ["Overall completion rate", "Общая доля выполнения"],
  "activity.doneOfTotal": ["{done} of {total} tasks done", "Сделано {done} из {total} задач"],
  "activity.doneThisWeek": ["{count} this week", "{count} за неделю"],
  "activity.statusMix": ["Status mix", "Состав по статусам"],
  "activity.statusDistribution": ["Status distribution", "Распределение по статусам"],
  "activity.inProgressCount": ["{count} in progress", "в работе: {count}"],
  "activity.waitingCount": ["{count} waiting", "в ожидании: {count}"],
  "activity.overdueCount": ["{count} overdue", "просрочено: {count}"],
  "activity.dueTodayCount": ["{count} due today", "срок сегодня: {count}"],
  "activity.openByAssignee": ["Open work by assignee", "Открытая работа по исполнителям"],
  "activity.openCount": ["{count} open", "открыто: {count}"],
  "activity.lateCount": ["{count} late", "опаздывает: {count}"],
  "activity.memberCompletion": ["{name} completion", "Выполнение: {name}"],
  "activity.needsDecision.one": [
    "{count} task needs an assignee or deadline decision",
    "{count} задаче нужен исполнитель или срок",
  ],
  "activity.needsDecision.few": [
    "{count} tasks need an assignee or deadline decision",
    "{count} задачам нужен исполнитель или срок",
  ],
  "activity.needsDecision.many": [
    "{count} tasks need an assignee or deadline decision",
    "{count} задачам нужен исполнитель или срок",
  ],
  "activity.needsDecision.other": [
    "{count} tasks need an assignee or deadline decision",
    "{count} задачам нужен исполнитель или срок",
  ],

  "activity.withTitle": ["{sentence} “{title}”", "{sentence} «{title}»"],
  "activity.line.TASK_CREATED": ["created", "создал(а) задачу"],
  "activity.line.TASK_UPDATED": ["updated", "обновил(а) задачу"],
  "activity.line.TASK_STATUS_CHANGED": ["moved", "переместил(а) задачу"],
  "activity.line.TASK_OWNER_CHANGED": ["reassigned", "переназначил(а) задачу"],
  "activity.line.TASK_PRIORITY_CHANGED": [
    "changed the priority of",
    "изменил(а) приоритет задачи",
  ],
  "activity.line.TASK_DUE_DATE_CHANGED": ["rescheduled", "перенёс(ла) срок задачи"],
  "activity.line.TASK_COMPLETED": ["completed", "завершил(а) задачу"],
  "activity.line.TASK_REOPENED": ["reopened", "снова открыл(а) задачу"],
  "activity.line.TASK_DELETED": ["deleted", "удалил(а) задачу"],
  "activity.line.TASK_COMMENTED": ["commented on", "оставил(а) комментарий к задаче"],
  "activity.line.MEETING_CREATED": ["scheduled the meeting", "назначил(а) встречу"],
  "activity.line.MEETING_UPDATED": ["updated the meeting", "обновил(а) встречу"],
  "activity.line.TRANSCRIPT_READY": [
    "stored a transcript for",
    "сохранил(а) расшифровку встречи",
  ],
  "activity.line.TRANSCRIPT_FAILED": [
    "could not get a transcript for",
    "не смог(ла) получить расшифровку встречи",
  ],
  "activity.line.ANALYSIS_COMPLETED": ["analysed", "проанализировал(а) встречу"],
  "activity.line.PROPOSAL_APPROVED": [
    "approved the proposed task",
    "принял(а) предложенную задачу",
  ],
  "activity.line.PROPOSAL_REJECTED": [
    "rejected the proposed task",
    "отклонил(а) предложенную задачу",
  ],
  "activity.line.MEMBER_INVITED": ["invited {person}", "пригласил(а): {person}"],
  "activity.line.MEMBER_JOINED": ["joined the workspace", "присоединился(лась) к пространству"],
  "activity.line.MEMBER_ROLE_CHANGED": [
    "changed the role of {person}",
    "изменил(а) роль: {person}",
  ],
  "activity.line.MEMBER_REMOVED": [
    "removed {person} from the workspace",
    "удалил(а) из пространства: {person}",
  ],
  "activity.line.MEMBER_LEFT": ["left the workspace", "покинул(а) пространство"],
  /** Stands in for `{person}` when an older event did not record a name. */
  "activity.somePerson": ["someone", "кого-то"],
  "activity.line.KNOWLEDGE_CREATED": ["added the page", "добавил(а) страницу"],
  "activity.line.KNOWLEDGE_UPDATED": ["edited the page", "изменил(а) страницу"],
  "activity.line.KNOWLEDGE_DELETED": ["deleted the page", "удалил(а) страницу"],
} satisfies Entries;
