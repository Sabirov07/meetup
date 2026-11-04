import type { Entries } from "./entry";

/** Sidebar navigation, its section headings and the page titles derived from it. */
export const nav = {
  "nav.overview": ["Overview", "Обзор"],
  "nav.section.tasks": ["Tasks", "Задачи"],
  "nav.myTasks": ["My tasks", "Мои задачи"],
  "nav.teamTasks": ["Team tasks", "Задачи команды"],
  "nav.personTasks": ["{name}’s tasks", "Задачи: {name}"],
  "nav.allTasks": ["All tasks", "Все задачи"],
  "nav.section.conversations": ["Conversations", "Разговоры"],
  "nav.meetings": ["Meetings", "Встречи"],
  "nav.review": ["AI review", "Проверка ИИ"],
  "nav.section.workspace": ["Workspace", "Пространство"],
  "nav.team": ["Team", "Команда"],
  "nav.knowledge": ["Knowledge", "База знаний"],
  "nav.flowcharts": ["Flowcharts", "Блок-схемы"],
  "nav.activity": ["Activity", "Активность"],
  "nav.settings": ["Settings", "Настройки"],
  "nav.main": ["Main", "Основное"],
} satisfies Entries;
