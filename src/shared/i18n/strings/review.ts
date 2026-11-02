import type { Entries } from "./entry";

/** The AI review page and the proposal cards it is made of. */
export const review = {
  "review.heading": ["AI review", "Проверка ИИ"],
  "review.description": [
    "Nothing here is a commitment yet. Approve a proposal and it becomes a real task; your edits are kept, and a later re-analysis will not overwrite them.",
    "Пока это не обязательства. Примите предложение — и оно станет настоящей задачей; ваши правки сохранятся, и повторный анализ их не перезапишет.",
  ],
  "review.approveSelected": [
    "Approve {count} selected",
    "Принять выбранные: {count}",
  ],
  "review.approving": ["Approving…", "Принимаем…"],
  "review.bulkFailed": ["Bulk approval failed", "Массовое принятие не удалось"],
  "review.created.one": ["{count} task created", "Создана {count} задача"],
  "review.created.few": ["{count} tasks created", "Создано {count} задачи"],
  "review.created.many": ["{count} tasks created", "Создано {count} задач"],
  "review.created.other": ["{count} tasks created", "Создано {count} задачи"],
  "review.someFailed": [
    "{count} could not be approved.",
    "Не удалось принять: {count}.",
  ],
  "review.aiOff.title": [
    "Transcript analysis is switched off",
    "Анализ расшифровок выключен",
  ],
  "review.aiOff.body": [
    "Add {key} to {file} and restart the dev server. Existing proposals below can still be reviewed.",
    "Добавьте {key} в {file} и перезапустите сервер разработки. Уже существующие предложения ниже всё равно можно проверить.",
  ],
  "review.empty.title": ["Nothing waiting for review", "Нечего проверять"],
  "review.empty.description": [
    "Add a transcript to a meeting and run the analysis. Proposed tasks, decisions and open questions will appear here for you to approve.",
    "Добавьте расшифровку к встрече и запустите анализ. Предложенные задачи, решения и открытые вопросы появятся здесь на ваше одобрение.",
  ],
  "review.empty.action": ["Go to meetings", "Перейти к встречам"],
  "review.sampleTip": [
    "Seeded example content. Not a real transcript analysis.",
    "Демонстрационные данные. Это не анализ настоящей расшифровки.",
  ],
  "review.noDate": ["No date", "Без даты"],
  "review.analysedWith": ["analysed with {model}", "проанализировано моделью {model}"],
  "review.selectAll": ["Select all", "Выбрать все"],
  "review.inProgress": ["Analysis in progress…", "Анализ идёт…"],

  "proposal.select": ["Select {title}", "Выбрать: {title}"],
  "proposal.committedTip": [
    "Someone said in the conversation that they would do this.",
    "В разговоре кто-то сказал, что сделает это.",
  ],
  "proposal.committed": ["Committed to", "Есть обещание"],
  "proposal.inferredTip": [
    "Nobody explicitly accepted this. It was read from context.",
    "Никто прямо этого не брал. Понято из контекста.",
  ],
  "proposal.inferred": ["Inferred task", "Выведенная задача"],
  "proposal.needsDecision": ["Needs a decision", "Нужно решение"],
  "proposal.sampleTip": [
    "Seeded example content, not a real transcript analysis.",
    "Демонстрационные данные, а не анализ настоящей расшифровки.",
  ],
  "proposal.descriptionPlaceholder": ["Description", "Описание"],
  "proposal.noDateMentioned": [
    "No date was mentioned in the conversation.",
    "В разговоре срок не упоминался.",
  ],
  "proposal.waitingOn": ["Waiting on: {titles}", "Ждёт: {titles}"],
  "proposal.waitingOnNote": [
    " — linked automatically if a matching task exists.",
    " — свяжется автоматически, если такая задача найдётся.",
  ],
  "proposal.approve": ["Approve", "Принять"],
  "proposal.approveEdited": ["Approve with my edits", "Принять с моими правками"],
  "proposal.editText": ["Edit text", "Изменить текст"],
  "proposal.doneEditing": ["Done editing", "Готово"],
  "proposal.reject": ["Reject", "Отклонить"],
  "proposal.approveFailed": [
    "Could not approve that task",
    "Не удалось принять задачу",
  ],
  "proposal.rejectFailed": [
    "Could not reject that proposal",
    "Не удалось отклонить предложение",
  ],
  "proposal.rejected": ["Proposal rejected", "Предложение отклонено"],
} satisfies Entries;
