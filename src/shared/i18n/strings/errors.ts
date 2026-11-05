import type { Entries } from "./entry";

/**
 * Everything a Server Function can say when something does not work.
 *
 * These are resolved on the server, from the locale cookie, at the moment the
 * action runs — the message is already in the right language by the time the
 * toast shows it. They are not re-read on a language switch, which is correct:
 * a message about something that just happened is a record of that moment.
 */
export const errors = {
  "errors.generic": [
    "Something went wrong. Please try again.",
    "Что-то пошло не так. Попробуйте ещё раз.",
  ],
  "errors.sessionExpired": [
    "Your session has expired. Please sign in again.",
    "Сессия истекла. Войдите снова.",
  ],
  "errors.adminOnly": [
    "Only a workspace administrator can do that.",
    "Это может сделать только администратор пространства.",
  ],
  "errors.task.gone": [
    "That task no longer exists in this workspace.",
    "Этой задачи больше нет в пространстве.",
  ],
  "errors.task.goneShort": ["That task no longer exists.", "Этой задачи больше нет."],
  "errors.meeting.gone": [
    "That meeting no longer exists in this workspace.",
    "Этой встречи больше нет в пространстве.",
  ],
  "errors.meeting.goneShort": ["That meeting no longer exists.", "Этой встречи больше нет."],
  "errors.member.notInWorkspace": [
    "That person is not a member of this workspace.",
    "Этот человек не входит в пространство.",
  ],
  "errors.page.gone": [
    "That page no longer exists in this workspace.",
    "Этой страницы больше нет в пространстве.",
  ],
  "errors.page.goneShort": ["That page no longer exists.", "Этой страницы больше нет."],
  "errors.flowchart.gone": [
    "That flowchart no longer exists in this workspace.",
    "Этой блок-схемы больше нет в пространстве.",
  ],
  "errors.flowchart.goneShort": ["That flowchart no longer exists.", "Этой блок-схемы больше нет."],
  "errors.flowchart.invalid": ["That flowchart is not valid.", "Эта блок-схема некорректна."],
  "errors.flowchart.needsTitle": ["Give the flowchart a title.", "Дайте блок-схеме название."],
  "errors.flowchart.untitled": ["Untitled flowchart", "Блок-схема без названия"],
  "errors.proposal.gone": [
    "That proposal no longer exists.",
    "Этого предложения больше нет.",
  ],

  "errors.auth.invalidDetails": [
    "Those details are not valid.",
    "Эти данные не подходят.",
  ],
  "errors.auth.invalidEmail": [
    "Enter a valid email address.",
    "Введите корректный адрес почты.",
  ],
  "errors.auth.enterPassword": ["Enter your password.", "Введите пароль."],
  "errors.auth.enterName": ["Enter your name.", "Введите ваше имя."],
  "errors.auth.nameTooLong": ["That name is too long.", "Это имя слишком длинное."],
  "errors.auth.passwordTooShort": [
    "Use at least {count} characters.",
    "Используйте не меньше {count} символов.",
  ],
  "errors.auth.passwordTooLong": [
    "That password is too long.",
    "Этот пароль слишком длинный.",
  ],
  "errors.auth.noMatch": [
    "That email and password do not match an account.",
    "Такой почты и пароля нет ни в одном аккаунте.",
  ],
  "errors.auth.useGoogle": [
    "That account signs in with Google. Use “Continue with Google” below.",
    "Этот аккаунт входит через Google. Воспользуйтесь кнопкой «Продолжить с Google» ниже.",
  ],
  "errors.auth.emailTaken": [
    "An account already exists for that email. Sign in instead.",
    "Аккаунт с такой почтой уже есть. Войдите в него.",
  ],

  "errors.comment.gone": [
    "That message no longer exists.",
    "Этого сообщения больше нет.",
  ],
  "errors.comment.notYours": [
    "Only the author or an administrator can change that message.",
    "Изменить сообщение может только его автор или администратор.",
  ],
  "errors.comment.aiNotEditable": [
    "The assistant's answers cannot be edited.",
    "Ответы ассистента нельзя редактировать.",
  ],

  "errors.task.invalid": ["That task is not valid.", "Задача заполнена неверно."],
  "errors.task.changeInvalid": [
    "That change is not valid.",
    "Это изменение не подходит.",
  ],
  "errors.task.titleTooShort": [
    "Give the task a title of at least 3 characters.",
    "Название задачи должно быть не короче 3 символов.",
  ],
  "errors.task.docTooLong": [
    "That document is too long to save. Split it across tasks.",
    "Документ слишком большой. Разделите его между задачами.",
  ],
  "errors.task.createdNotReadable": [
    "The task was created but could not be read back.",
    "Задача создана, но прочитать её обратно не удалось.",
  ],
  "errors.task.orderInvalid": [
    "That ordering is not valid.",
    "Такой порядок не подходит.",
  ],
  "errors.task.selfDependency": [
    "A task cannot depend on itself.",
    "Задача не может зависеть от себя.",
  ],
  "errors.task.circularDependency": [
    "That would create a circular dependency.",
    "Это создало бы круговую зависимость.",
  ],
  "errors.task.emptyNote": ["Write something first.", "Сначала что-нибудь напишите."],
  "errors.task.noteTooLong": ["That note is too long.", "Заметка слишком длинная."],

  "errors.subtask.gone": [
    "That step no longer exists.",
    "Этого шага больше нет.",
  ],
  "errors.subtask.invalid": [
    "That step is not valid.",
    "Шаг заполнен неверно.",
  ],
  "errors.subtask.empty": [
    "Write the step first.",
    "Сначала напишите шаг.",
  ],
  "errors.subtask.tooMany": [
    "This task already has the maximum number of steps.",
    "У задачи уже максимальное число шагов.",
  ],

  "errors.discussion.needsKey": [
    "Set ANTHROPIC_API_KEY on the server to bring the assistant into a discussion.",
    "Чтобы звать ассистента в обсуждение, задайте ANTHROPIC_API_KEY на сервере.",
  ],
  "errors.discussion.questionGone": [
    "That message is no longer there.",
    "Этого сообщения больше нет.",
  ],
  "errors.discussion.notForAi": [
    "That message did not ask the assistant anything.",
    "В этом сообщении ассистента ни о чём не спрашивали.",
  ],
  "errors.discussion.emptyAnswer": [
    "The assistant had nothing useful to say about that. Try asking it something narrower.",
    "Ассистенту нечего добавить по этому вопросу. Попробуйте спросить конкретнее.",
  ],

  "errors.meeting.invalid": ["That meeting is not valid.", "Встреча заполнена неверно."],
  "errors.meeting.titleTooShort": [
    "Give the meeting a title.",
    "Дайте встрече название.",
  ],
  "errors.meeting.googleNotConfigured": [
    "Google Meet is not configured on the server yet. Add a link manually, or set the Google credentials in Settings.",
    "Google Meet ещё не настроен на сервере. Добавьте ссылку вручную или укажите ключи Google в настройках.",
  ],
  "errors.meeting.googleNotConnected": [
    "Connect your Google account in Settings first.",
    "Сначала подключите аккаунт Google в настройках.",
  ],
  "errors.meeting.googleFailedWith": [
    "Google could not create the meeting: {reason}",
    "Google не смог создать встречу: {reason}",
  ],
  "errors.meeting.googleFailed": [
    "Google could not create the meeting.",
    "Google не смог создать встречу.",
  ],
  "errors.meeting.pasteLink": ["Paste the meeting link.", "Вставьте ссылку на встречу."],
  "errors.meeting.notMeetLink": [
    "That does not look like a Google Meet link (meet.google.com).",
    "Это не похоже на ссылку Google Meet (meet.google.com).",
  ],
  "errors.meeting.createdNotReadable": [
    "The meeting was created but could not be read back.",
    "Встреча создана, но прочитать её обратно не удалось.",
  ],
  "errors.meeting.statusInvalid": [
    "That status is not valid.",
    "Такой статус не подходит.",
  ],
  "errors.meeting.transcriptTooShort": [
    "That transcript is too short to be useful.",
    "Эта расшифровка слишком короткая, чтобы быть полезной.",
  ],
  "errors.meeting.transcriptTooLong": [
    "That transcript is too large. Trim it to the relevant part.",
    "Эта расшифровка слишком большая. Оставьте только нужную часть.",
  ],
  "errors.meeting.noTranscriptStored": [
    "No transcript is stored for this meeting.",
    "Для этой встречи расшифровка не сохранена.",
  ],

  "errors.analysis.needsKey": [
    "Transcript analysis needs an Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the server.",
    "Для анализа расшифровок нужен ключ Anthropic. Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер.",
  ],
  "errors.analysis.noTranscript": [
    "There is no transcript stored for this meeting yet, so there is nothing to analyse.",
    "Для этой встречи расшифровки пока нет, так что анализировать нечего.",
  ],
  "errors.analysis.transcriptNotReady": [
    "The transcript is not ready yet.",
    "Расшифровка ещё не готова.",
  ],
  "errors.analysis.failed": ["The analysis failed.", "Анализ не удался."],
  "errors.analysis.approvalInvalid": [
    "That approval is not valid.",
    "Это одобрение не подходит.",
  ],

  "errors.page.invalid": ["That page is not valid.", "Страница заполнена неверно."],
  "errors.page.changeInvalid": [
    "That change is not valid.",
    "Это изменение не подходит.",
  ],
  "errors.page.needsTitle": ["A page needs a title.", "У страницы должно быть название."],
  "errors.page.createdNotReadable": [
    "The page was created but could not be read back.",
    "Страница создана, но прочитать её обратно не удалось.",
  ],
  "errors.page.untitled": ["Untitled page", "Страница без названия"],

  // --- Sections ---------------------------------------------------------
  "errors.space.gone": [
    "That section no longer exists, or it belongs to another workspace.",
    "Этого раздела больше нет — либо он принадлежит другому пространству.",
  ],
  "errors.space.invalid": ["That section is not valid.", "Раздел заполнен неверно."],
  "errors.space.needsName": ["A section needs a name.", "У раздела должно быть название."],
  "errors.space.nameTaken": [
    "There is already a section with that name.",
    "Раздел с таким названием уже есть.",
  ],
  "errors.space.createdNotReadable": [
    "The section was created but could not be read back.",
    "Раздел создан, но прочитать его не удалось.",
  ],
  "errors.space.orderInvalid": [
    "That section order is not valid.",
    "Такой порядок разделов недопустим.",
  ],

  "errors.upload.unreadable": [
    "That upload could not be read.",
    "Не удалось прочитать загруженный файл.",
  ],
  "errors.upload.oneDocument": [
    "An attachment has to belong to exactly one document.",
    "Вложение должно принадлежать ровно одному документу.",
  ],
  "errors.upload.noFile": ["No file was attached.", "Файл не приложен."],
  "errors.upload.docGone": [
    "That document no longer exists in this workspace.",
    "Этого документа больше нет в пространстве.",
  ],
  "errors.upload.wrongType": [
    "That kind of file cannot be attached here.",
    "Такой файл сюда приложить нельзя.",
  ],
  "errors.upload.empty": ["That file is empty.", "Этот файл пустой."],
  "errors.upload.unsupported": [
    "{name} cannot be attached. Images, and data and document files — JSON, CSV, XML, PDF, Word, Excel, ZIP — work.",
    "{name} приложить нельзя. Подойдут изображения, а также данные и документы — JSON, CSV, XML, PDF, Word, Excel, ZIP.",
  ],
  "errors.upload.tooLarge": [
    "{name} is {size}. The limit is {limit}.",
    "{name} весит {size}. Предел — {limit}.",
  ],
  "errors.upload.overLimit": [
    "That file is {size}. The limit is {limit}.",
    "Этот файл весит {size}. Предел — {limit}.",
  ],
  "errors.upload.thatFile": ["That file", "Этот файл"],

  "errors.workspace.nameTooShort": [
    "Give the workspace a name of at least 2 characters.",
    "Название пространства должно быть не короче 2 символов.",
  ],
  "errors.workspace.profileInvalid": [
    "That profile is not valid.",
    "Профиль заполнен неверно.",
  ],
  "errors.workspace.personNameTooShort": [
    "Names need at least 2 characters.",
    "Имя должно быть не короче 2 символов.",
  ],
  "errors.workspace.notYourProfile": [
    "Only an administrator can edit someone else’s profile.",
    "Профиль другого человека может менять только администратор.",
  ],
  "errors.workspace.needsAdmin": [
    "The workspace needs at least one administrator.",
    "В пространстве должен остаться хотя бы один администратор.",
  ],
  "errors.team.inviteEmailInvalid": [
    "That is not a valid email address. Leave it empty for a link anyone may use.",
    "Это не похоже на адрес почты. Оставьте поле пустым, чтобы ссылкой мог воспользоваться любой.",
  ],
  "errors.team.alreadyMember": [
    "That person is already in this workspace.",
    "Этот человек уже в пространстве.",
  ],
  "errors.team.inviteGone": [
    "That invitation is no longer pending.",
    "Это приглашение больше не ожидает принятия.",
  ],
  "errors.team.cannotRemoveSelf": [
    "You cannot remove yourself. Leave the workspace instead.",
    "Себя удалить нельзя — вместо этого покиньте пространство.",
  ],
  "errors.team.lastWorkspace": [
    "This is your only workspace. Create or join another one before leaving this one.",
    "Это ваше единственное пространство. Сначала создайте другое или присоединитесь к другому.",
  ],
  "errors.team.lastAdminLeaving": [
    "You are the only administrator. Make someone else an administrator first.",
    "Вы единственный администратор. Сначала назначьте администратором кого-то ещё.",
  ],
  "errors.team.notAMember": [
    "You are not a member of that workspace.",
    "Вы не участник этого пространства.",
  ],

  "errors.invite.unknown": [
    "That invitation link is not valid.",
    "Эта ссылка-приглашение недействительна.",
  ],
  "errors.invite.revoked": [
    "That invitation was cancelled.",
    "Это приглашение отменили.",
  ],
  "errors.invite.accepted": [
    "That invitation has already been used.",
    "Это приглашение уже использовано.",
  ],
  "errors.invite.expired": [
    "That invitation has expired.",
    "Это приглашение истекло.",
  ],
  "errors.invite.wrongEmail": [
    "That invitation belongs to a different email address.",
    "Это приглашение выдано на другой адрес почты.",
  ],
  "errors.intake.needsKey": [
    "Set ANTHROPIC_API_KEY on the server to have text split into tasks.",
    "Чтобы делить текст на задачи, задайте ANTHROPIC_API_KEY на сервере.",
  ],
  "errors.intake.tooShort": [
    "Write a little more about the work first.",
    "Напишите о работе чуть подробнее.",
  ],
  "errors.intake.tooLong": [
    "That is too long to read in one go. Split it across a couple of goes.",
    "Это слишком длинно для одного раза. Разбейте текст на несколько частей.",
  ],
  "errors.intake.noTasks": [
    "No work to do was found in that text.",
    "В этом тексте не нашлось работы, которую можно сделать.",
  ],
  "errors.intake.invalid": [
    "Those tasks are not valid. Check the titles and try again.",
    "Эти задачи заполнены неверно. Проверьте названия и попробуйте снова.",
  ],
  "errors.status.gone": [
    "That status no longer exists, or it belongs to another workspace.",
    "Этот статус больше не существует или принадлежит другому пространству.",
  ],
  "errors.status.invalid": ["That status is not valid.", "Статус заполнен неверно."],
  "errors.status.needsName": ["Give the status a name.", "Дайте статусу название."],
  "errors.status.tooMany": [
    "A workspace can have up to {max} custom statuses.",
    "В пространстве может быть не больше {max} своих статусов.",
  ],
  "errors.status.builtin": [
    "Built-in statuses cannot be removed.",
    "Встроенные статусы удалить нельзя.",
  ],
} satisfies Entries;
