import type { Entries } from "./entry";

/** The meetings list, the start dialog, and the manual transcript dialog. */
export const meetings = {
  "meetings.heading": ["Meetings", "Встречи"],
  "meetings.description": [
    "Each conversation, its transcript, and the tasks that came out of it.",
    "Каждый разговор, его расшифровка и задачи, которые из него вышли.",
  ],
  "meetings.empty.title": ["No meetings yet", "Встреч пока нет"],
  "meetings.empty.description": [
    "Start one and it will appear here with its transcript and extracted tasks.",
    "Начните встречу — она появится здесь вместе с расшифровкой и найденными задачами.",
  ],
  "meetings.group.needsAttention": ["Needs attention", "Требует внимания"],
  "meetings.group.upcoming": ["Upcoming", "Предстоящие"],
  "meetings.group.completed": ["Completed", "Завершённые"],

  "meetings.analysisFailed": ["Analysis failed", "Анализ не удался"],
  "meetings.analysisComplete": ["Analysis complete", "Анализ завершён"],
  "meetings.analysisCompleteDetail": [
    "Proposed tasks are ready for review.",
    "Предложенные задачи готовы к проверке.",
  ],
  "meetings.updateFailed": ["Could not update the meeting", "Не удалось обновить встречу"],
  "meetings.deleted": ["Meeting deleted", "Встреча удалена"],
  "meetings.deleteFailed": [
    "Could not delete that meeting",
    "Не удалось удалить встречу",
  ],

  "meetings.sampleData": ["Sample data", "Демо-данные"],
  "meetings.viaGoogleApi": [
    "Created through the Google Meet API",
    "Создано через Google Meet API",
  ],
  "meetings.googleMeet": ["Google Meet", "Google Meet"],
  "meetings.noTranscript": ["No transcript", "Нет расшифровки"],
  "meetings.awaitingReview": ["{count} awaiting review", "ждут проверки: {count}"],
  "meetings.join": ["Join", "Подключиться"],
  "meetings.addTranscript": ["Add transcript", "Добавить расшифровку"],
  "meetings.replaceTranscript": ["Replace transcript", "Заменить расшифровку"],
  "meetings.analyseTip": [
    "Extract tasks, owners and decisions from the transcript",
    "Извлечь из расшифровки задачи, исполнителей и решения",
  ],
  "meetings.analyseNeedsKey": [
    "Needs ANTHROPIC_API_KEY in .env.local",
    "Нужен ANTHROPIC_API_KEY в .env.local",
  ],
  "meetings.analysing": ["Analysing…", "Анализируем…"],
  "meetings.analyse": ["Analyse", "Анализировать"],
  "meetings.reanalyse": ["Re-analyse", "Проанализировать снова"],
  "meetings.actionsFor": ["Actions for {title}", "Действия: {title}"],
  "meetings.openMeeting": ["Open meeting", "Открыть встречу"],
  "meetings.markInProgress": ["Mark in progress", "Отметить как идущую"],
  "meetings.markEnded": ["Mark as ended", "Отметить как завершённую"],
  "meetings.deleteMeeting": ["Delete meeting", "Удалить встречу"],

  "detail.allMeetings": ["All meetings", "Все встречи"],
  "detail.createdBy": ["created by {name}", "создал(а) {name}"],
  "detail.joinCall": ["Join call", "Подключиться к звонку"],
  "detail.endMeeting": ["End meeting", "Завершить встречу"],
  "detail.startMeeting": ["Start", "Начать"],
  "detail.failed": ["Failed", "Ошибка"],
  "detail.transcript": ["Transcript", "Расшифровка"],
  "detail.viewTranscript": ["View transcript", "Посмотреть расшифровку"],
  "detail.replace": ["Replace", "Заменить"],
  "detail.loadTranscriptFailed": [
    "Could not load the transcript",
    "Не удалось загрузить расшифровку",
  ],
  "detail.noTranscriptStored": [
    "No transcript has been stored for this meeting.",
    "Для этой встречи расшифровка не сохранена.",
  ],
  "detail.transcriptHelp": [
    "Google Meet only produces a transcript when transcription was switched on during the call and the organiser is on a Google Workspace plan that includes it. You can always paste one in manually instead.",
    "Google Meet создаёт расшифровку только если транскрипция была включена во время звонка, а у организатора есть подходящий план Google Workspace. Расшифровку всегда можно вставить вручную.",
  ],
  "detail.storedAt": [
    "Stored {when}. It is only sent to your browser when you open it.",
    "Сохранено {when}. В браузер она попадает только когда вы её открываете.",
  ],
  "detail.stored": [
    "Stored. It is only sent to your browser when you open it.",
    "Сохранено. В браузер расшифровка попадает только когда вы её открываете.",
  ],
  "detail.analysisHeading": [
    "What the conversation produced",
    "Что дал этот разговор",
  ],
  "detail.summary": ["Summary", "Итог"],
  "detail.decisions": ["Decisions", "Решения"],
  "detail.openQuestions": ["Still unresolved", "Осталось нерешённым"],
  "detail.analysisFailedReason": [
    "No reason was recorded.",
    "Причина не зафиксирована.",
  ],
  "detail.analysisCompleteDetail": [
    "Reload to see the proposed tasks, or open AI review.",
    "Обновите страницу, чтобы увидеть предложенные задачи, или откройте проверку ИИ.",
  ],
  "detail.reviewAction": ["Review", "Проверить"],
  "detail.proposedTasks": ["Proposed tasks", "Предложенные задачи"],
  "detail.notCommitments": [
    "Not commitments until you approve them",
    "Станут обязательствами только после вашего одобрения",
  ],
  "detail.tasksFromMeeting": ["Tasks from this meeting", "Задачи из этой встречи"],
  "detail.noTasks": ["No tasks yet", "Задач пока нет"],
  "detail.noTasksCanAnalyse": [
    "Run the analysis to extract tasks from the transcript.",
    "Запустите анализ, чтобы извлечь задачи из расшифровки.",
  ],
  "detail.noTasksNeedTranscript": [
    "Add a transcript, then run the analysis.",
    "Добавьте расшифровку, затем запустите анализ.",
  ],

  "start.title": ["Start a meeting", "Начать встречу"],
  "start.description": [
    "The call opens in a separate tab so this workspace stays available beside it.",
    "Звонок откроется в отдельной вкладке, чтобы это пространство осталось под рукой.",
  ],
  "start.field.title": ["What is this meeting about?", "О чём эта встреча?"],
  "start.field.titlePlaceholder": ["Weekly build review", "Недельный разбор сборки"],
  "start.untitled": ["Untitled meeting", "Встреча без названия"],
  "start.created": ["Meeting created", "Встреча создана"],
  "start.openingGoogle": [
    "Opening Google Meet in a new tab.",
    "Открываем Google Meet в новой вкладке.",
  ],
  "start.linkHeading": ["Meeting link", "Ссылка на встречу"],
  "start.mode.google": ["Create a Google Meet", "Создать Google Meet"],
  "start.mode.googleReady": [
    "Creates a real meeting space on {account}.",
    "Создаст настоящую встречу в аккаунте {account}.",
  ],
  "start.mode.googleAccountFallback": ["your Google account", "вашем аккаунте Google"],
  "start.mode.googleNeedsConnect": [
    "Connect your Google account in Settings to use this.",
    "Подключите аккаунт Google в настройках, чтобы использовать это.",
  ],
  "start.mode.googleNeedsServer": [
    "Needs Google credentials on the server. See Settings.",
    "Нужны серверные ключи Google. Смотрите настройки.",
  ],
  "start.mode.link": ["Use an existing link", "Использовать готовую ссылку"],
  "start.mode.linkDescription": [
    "Paste a meet.google.com link you already have.",
    "Вставьте ссылку meet.google.com, которая у вас уже есть.",
  ],
  "start.mode.linkPlaceholder": [
    "https://meet.google.com/abc-defg-hij",
    "https://meet.google.com/abc-defg-hij",
  ],
  "start.mode.linkLabel": ["Google Meet link", "Ссылка на Google Meet"],
  "start.mode.linkHelp": [
    "Open Google Meet to create one, then paste it here",
    "Создайте встречу в Google Meet и вставьте ссылку сюда",
  ],
  "start.mode.none": ["No link yet", "Пока без ссылки"],
  "start.mode.noneDescription": [
    "Just record the meeting now and add a transcript afterwards.",
    "Просто зафиксируйте встречу, а расшифровку добавьте позже.",
  ],
  "start.participants": ["Participants", "Участники"],
  "start.submitRecord": ["Create record", "Создать запись"],
  "start.submitOpen": ["Create & open", "Создать и открыть"],

  "transcript.title": ["Add a transcript", "Добавить расшифровку"],
  "transcript.description": [
    "Paste the conversation for “{title}”. It is stored as a manual transcript, separate from anything retrieved from Google.",
    "Вставьте разговор для «{title}». Он сохранится как ручная расшифровка, отдельно от того, что получено из Google.",
  ],
  "transcript.formatHint": [
    "Ownership detection works from speaker labels, so keep the {format} format if you can. One turn per line.",
    "Исполнители определяются по именам говорящих, поэтому по возможности держите формат {format}. Одна реплика на строку.",
  ],
  "transcript.formatExample": ["Name: what they said", "Имя: что сказали"],
  "transcript.placeholder": [
    "Maya Chen: Where did the auth work land?\nAlex Morgan: Sessions are done, reset is blocked on the email account.",
    "Майя Чен: Чем закончилась работа над авторизацией?\nАлекс Морган: Сессии готовы, сброс пароля заблокирован почтовым аккаунтом.",
  ],
  "transcript.nothingPasted": ["Nothing pasted yet", "Пока ничего не вставлено"],
  "transcript.stats": [
    "{lines} · {characters} characters",
    "{lines} · символов: {characters}",
  ],
  "transcript.lines.one": ["{count} line", "{count} строка"],
  "transcript.lines.few": ["{count} lines", "{count} строки"],
  "transcript.lines.many": ["{count} lines", "{count} строк"],
  "transcript.lines.other": ["{count} lines", "{count} строки"],
  "transcript.saved": ["Transcript saved", "Расшифровка сохранена"],
  "transcript.savedDetail": [
    "You can run the analysis now.",
    "Теперь можно запустить анализ.",
  ],
  "transcript.saveFailed": [
    "Could not save the transcript",
    "Не удалось сохранить расшифровку",
  ],
  "transcript.submit": ["Save transcript", "Сохранить расшифровку"],
} satisfies Entries;
