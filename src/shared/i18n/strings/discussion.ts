import type { Entries } from "./entry";

/**
 * The discussion on a task: what people write to each other, who they call in
 * by name, and the assistant's answer when `@ai` is one of them.
 *
 * Russian note: the assistant is referred to without a gendered verb wherever
 * possible ("ответ готовится" rather than "он готовит"), because "ИИ" is
 * masculine while "модель" is feminine and the product uses both in different
 * places. Where a verb is unavoidable the neuter past tense is used.
 */
export const discussion = {
  "discussion.heading": ["Discussion", "Обсуждение"],
  "discussion.loading": ["Loading the discussion…", "Загружаем обсуждение…"],
  "discussion.empty": [
    "Nothing here yet. Say what you think, mention someone with @, or ask @ai how you would build it.",
    "Здесь пока пусто. Напишите своё мнение, позовите коллегу через @ или спросите @ai, как это лучше сделать.",
  ],
  "discussion.placeholder": [
    "Write a message. @ to mention someone, @ai to ask the assistant…",
    "Напишите сообщение. @ — позвать коллегу, @ai — спросить ассистента…",
  ],
  "discussion.send": ["Send", "Отправить"],
  "discussion.shortcut": ["⌘↵ to send", "⌘↵ — отправить"],
  "discussion.mention": ["Mention someone", "Позвать коллегу"],
  "discussion.askAi": ["Ask the assistant", "Спросить ассистента"],
  "discussion.loadFailed": [
    "Could not load the discussion",
    "Не удалось загрузить обсуждение",
  ],
  "discussion.sendFailed": [
    "Could not send that message",
    "Не удалось отправить сообщение",
  ],

  "discussion.edit": ["Edit", "Редактировать"],
  "discussion.edited": ["edited", "изменено"],
  "discussion.editHint": ["⌘↵ to save, Esc to cancel", "⌘↵ — сохранить, Esc — отменить"],
  "discussion.editFailed": ["Could not save the change", "Не удалось сохранить изменение"],
  "discussion.messageMenu": ["Message actions", "Действия с сообщением"],
  "discussion.delete.title": ["Delete this message?", "Удалить это сообщение?"],
  "discussion.delete.body": [
    "It will disappear from the discussion for everyone. This cannot be undone.",
    "Оно исчезнет из обсуждения у всех. Это действие нельзя отменить.",
  ],
  "discussion.delete.withAnswer": [
    "The assistant's answer to it will be deleted too.",
    "Ответ ассистента на него тоже будет удалён.",
  ],
  "discussion.delete.failed": ["Could not delete the message", "Не удалось удалить сообщение"],
  "discussion.deleted": ["Message deleted", "Сообщение удалено"],

  "discussion.count.one": ["{count} message", "{count} сообщение"],
  "discussion.count.few": ["{count} messages", "{count} сообщения"],
  "discussion.count.many": ["{count} messages", "{count} сообщений"],
  "discussion.count.other": ["{count} messages", "{count} сообщения"],

  // The mention picker
  "discussion.picker.noMatch": ["Nobody by that name", "Никого с таким именем"],
  "discussion.picker.hint": ["↑↓ to choose, ↵ to insert", "↑↓ — выбрать, ↵ — вставить"],
  "discussion.picker.ai": ["AI assistant", "ИИ-ассистент"],
  "discussion.picker.aiHint": [
    "Answers in the thread with a suggestion",
    "Ответит в обсуждении и предложит решение",
  ],

  // The assistant's reply
  "discussion.ai.name": ["AI assistant", "ИИ-ассистент"],
  "discussion.ai.thinking": [
    "Reading the task and the discussion…",
    "Читаем задачу и обсуждение…",
  ],
  "discussion.ai.thinkingNote": [
    "This takes up to a minute. You can keep working.",
    "Это займёт до минуты. Можно продолжать работать.",
  ],
  "discussion.ai.failed": ["The assistant could not answer", "Ассистент не смог ответить"],
  "discussion.ai.retry": ["Ask again", "Спросить снова"],
  "discussion.ai.model": ["Answered by {model}", "Ответ подготовлен моделью {model}"],
  "discussion.ai.disclaimer": [
    "A suggestion, not a decision. Check it before you build on it.",
    "Это предложение, а не решение. Проверьте, прежде чем опираться на него.",
  ],

  "discussion.advice.recommendations": ["What I would do", "Что бы я сделал"],
  "discussion.advice.risks": ["Where this goes wrong", "Где это может сломаться"],
  "discussion.advice.questions": ["Worth settling first", "Стоит решить заранее"],
  "discussion.advice.tradeoff": ["Trade-off: {text}", "Компромисс: {text}"],

  "effort.SMALL.label": ["Hours", "Часы"],
  "effort.MEDIUM.label": ["Days", "Дни"],
  "effort.LARGE.label": ["A week or more", "Неделя и больше"],

  // The sketch
  "sketch.heading": ["Sketch", "Набросок"],
  "sketch.screens": ["Screens", "Экраны"],
  "sketch.flow": ["Flow", "Сценарий"],
  "sketch.expand": ["See it full size", "Открыть во всю ширину"],
  "sketch.note": [
    "A rough sketch to argue with, not a design.",
    "Грубый набросок для обсуждения, а не готовый дизайн.",
  ],
  "sketch.actor.PERSON": ["Person", "Человек"],
  "sketch.actor.SYSTEM": ["App", "Приложение"],
  "sketch.actor.AI": ["AI", "ИИ"],

  "sketch.block.header": ["Header", "Шапка"],
  "sketch.block.toolbar": ["Controls", "Управление"],
  "sketch.block.nav": ["Navigation", "Навигация"],
  "sketch.block.list": ["List", "Список"],
  "sketch.block.cards": ["Cards", "Карточки"],
  "sketch.block.table": ["Table", "Таблица"],
  "sketch.block.form": ["Form", "Форма"],
  "sketch.block.detail": ["Details", "Детали"],
  "sketch.block.chart": ["Chart", "График"],
  "sketch.block.empty": ["Empty state", "Пустое состояние"],
  "sketch.block.banner": ["Callout", "Плашка"],
  "sketch.block.actions": ["Actions", "Действия"],
} satisfies Entries;
