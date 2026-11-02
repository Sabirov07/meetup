import type { Entries } from "./entry";

/** The settings page: workspace, people, integrations and preferences. */
export const settings = {
  "settings.heading": ["Settings", "Настройки"],
  "settings.description": [
    "Workspace, people, and the integrations that make transcripts and analysis work.",
    "Пространство, люди и интеграции, благодаря которым работают расшифровки и анализ.",
  ],

  "settings.workspace.title": ["Workspace", "Пространство"],
  "settings.workspace.description": [
    "The name shown in the sidebar.",
    "Название, которое видно в боковой панели.",
  ],
  "settings.workspace.name": ["Name", "Название"],
  "settings.workspace.renamed": ["Workspace renamed", "Пространство переименовано"],
  "settings.workspace.renameFailed": [
    "Could not rename the workspace",
    "Не удалось переименовать пространство",
  ],
  "settings.workspace.adminOnly": [
    "Only an administrator can rename the workspace.",
    "Переименовать пространство может только администратор.",
  ],

  "settings.profile.title": ["Your profile", "Ваш профиль"],
  "settings.profile.description": [
    "How you appear to everyone else in this workspace.",
    "Как вас видят остальные в этом пространстве.",
  ],
  "settings.profile.teamPointer.one": [
    "{count} person is in this workspace. Invite, remove and promote on the Team page.",
    "В пространстве {count} человек. Приглашать, удалять и менять роли — на странице «Команда».",
  ],
  "settings.profile.teamPointer.few": [
    "{count} people are in this workspace. Invite, remove and promote on the Team page.",
    "В пространстве {count} человека. Приглашать, удалять и менять роли — на странице «Команда».",
  ],
  "settings.profile.teamPointer.many": [
    "{count} people are in this workspace. Invite, remove and promote on the Team page.",
    "В пространстве {count} человек. Приглашать, удалять и менять роли — на странице «Команда».",
  ],
  "settings.profile.teamPointer.other": [
    "{count} people are in this workspace. Invite, remove and promote on the Team page.",
    "В пространстве {count} человека. Приглашать, удалять и менять роли — на странице «Команда».",
  ],
  "settings.people.name": ["Name", "Имя"],
  "settings.people.jobTitle": ["Job title", "Должность"],
  "settings.people.jobTitlePlaceholder": ["Engineer", "Инженер"],
  "settings.people.avatarColour": ["Avatar colour", "Цвет аватара"],
  "settings.people.useColour": ["Use {colour}", "Использовать {colour}"],
  "settings.people.role": ["Role", "Роль"],
  "settings.people.roleUpdated": ["Role updated", "Роль изменена"],
  "settings.people.roleFailed": [
    "Could not change the role",
    "Не удалось изменить роль",
  ],
  "settings.people.profileSaved": ["Profile saved", "Профиль сохранён"],
  "settings.people.profileFailed": [
    "Could not save the profile",
    "Не удалось сохранить профиль",
  ],
  "settings.people.isYou": [" · you", " · это вы"],

  "settings.integrations.title": ["Integrations", "Интеграции"],
  "settings.integrations.description": [
    "Both are optional. The rest of the product works without them; nothing is simulated when they are missing.",
    "Обе необязательны. Остальное работает и без них, и ничего не имитируется, если их нет.",
  ],
  "settings.integrations.notConfigured": ["Not configured", "Не настроено"],
  "settings.integrations.ready": ["Ready", "Готово"],
  "settings.google.title": ["Google Meet", "Google Meet"],
  "settings.google.connectedBody": [
    "Authorised as {email}. Creates real meeting spaces and can read transcripts from calls you took part in.",
    "Авторизовано как {email}. Создаёт настоящие встречи и может читать расшифровки звонков, в которых вы участвовали.",
  ],
  "settings.google.configuredBody": [
    "Server credentials are present. Authorise your Google account to create meetings and pull transcripts.",
    "Серверные ключи есть. Авторизуйте аккаунт Google, чтобы создавать встречи и получать расшифровки.",
  ],
  "settings.google.missingBody": [
    "Add server credentials to enable meeting creation and transcript retrieval.",
    "Добавьте серверные ключи, чтобы включить создание встреч и получение расшифровок.",
  ],
  "settings.google.disconnect": ["Disconnect", "Отключить"],
  "settings.google.disconnected": [
    "Google account disconnected",
    "Аккаунт Google отключён",
  ],
  "settings.google.disconnectFailed": ["Could not disconnect", "Не удалось отключить"],
  "settings.google.connect": ["Connect Google", "Подключить Google"],
  "settings.google.missingTip": [
    "Server credentials are missing — see the checklist below.",
    "Серверных ключей нет — смотрите список ниже.",
  ],
  "settings.google.requirements": [
    "What transcript access actually requires",
    "Что на самом деле нужно для доступа к расшифровкам",
  ],
  "settings.google.req.account": ["A Workspace account.", "Аккаунт Workspace."],
  "settings.google.req.accountBody": [
    "Meet only generates transcripts on Google Workspace plans that include them. A personal @gmail.com account can authorise the API, but the transcript list will always come back empty.",
    "Meet создаёт расшифровки только на планах Google Workspace, где они есть. Личный аккаунт @gmail.com может авторизовать API, но список расшифровок всегда будет пустым.",
  ],
  "settings.google.req.transcription": [
    "Transcription switched on during the call.",
    "Транскрипция включена во время звонка.",
  ],
  "settings.google.req.transcriptionBody": [
    "It is not retroactive — if nobody turned it on, no transcript exists afterwards.",
    "Задним числом это не работает: если её не включили, расшифровки потом не будет.",
  ],
  "settings.google.req.delay": ["A delay after the call.", "Задержка после звонка."],
  "settings.google.req.delayBody": [
    "Transcripts are not available the moment a meeting ends, which is why {state} is a normal state rather than an error.",
    "Расшифровки появляются не сразу после встречи, поэтому {state} — нормальное состояние, а не ошибка.",
  ],
  "settings.google.req.scopes": ["Scopes.", "Разрешения."],
  "settings.google.req.scopesBody": [
    "{created} and {readonly}. Transcript entries are deleted by Google 30 days after the conference ends.",
    "{created} и {readonly}. Google удаляет записи расшифровок через 30 дней после конференции.",
  ],
  "settings.google.req.redirect": ["Redirect URI.", "Redirect URI."],
  "settings.google.req.redirectBody": [
    "Add exactly this to the OAuth client: {uri}",
    "Добавьте в OAuth-клиент именно это: {uri}",
  ],

  "settings.anthropic.title": [
    "Claude (transcript analysis)",
    "Claude (анализ расшифровок)",
  ],
  "settings.anthropic.readyBody": [
    "Transcripts can be analysed into summaries, decisions and proposed tasks.",
    "Расшифровки можно превращать в итоги, решения и предложенные задачи.",
  ],
  "settings.anthropic.missingBody": [
    "Without a key, transcripts are stored but not analysed. Everything else works.",
    "Без ключа расшифровки сохраняются, но не анализируются. Всё остальное работает.",
  ],
  "settings.anthropic.getKey": ["Get a key", "Получить ключ"],

  "settings.env.missing": ["Missing from .env.local", "Нет в .env.local"],
  "settings.env.help": [
    "Add them to {file} and restart the dev server. Never paste secrets into the app or commit them.",
    "Добавьте их в {file} и перезапустите сервер разработки. Никогда не вставляйте секреты в приложение и не коммитьте их.",
  ],

  "settings.preferences.title": ["Preferences", "Личные настройки"],
  "settings.preferences.description": [
    "Applies to your account only.",
    "Касается только вашего аккаунта.",
  ],
  "settings.preferences.defaultOrdering": [
    "Default task ordering",
    "Сортировка задач по умолчанию",
  ],
  "settings.preferences.orderingSaved": [
    "Default ordering saved",
    "Сортировка по умолчанию сохранена",
  ],
  "settings.preferences.orderingNote": [
    "Smart priority weighs deadlines, blocking impact and status against each task’s priority level. Manual order is never re-sorted automatically.",
    "Умный приоритет учитывает сроки, блокировки и статус вместе с уровнем приоритета задачи. Свой порядок никогда не пересортируется сам.",
  ],

  "settings.notice.connected.title": [
    "Google account connected",
    "Аккаунт Google подключён",
  ],
  "settings.notice.connected.body": [
    "You can now create Google Meet links and retrieve transcripts for calls you took part in.",
    "Теперь можно создавать ссылки Google Meet и получать расшифровки звонков, в которых вы участвовали.",
  ],
  "settings.notice.denied.title": ["Consent was declined", "Доступ не выдан"],
  "settings.notice.denied.body": [
    "Nothing was changed. You can try again whenever you like.",
    "Ничего не изменилось. Можно попробовать снова в любой момент.",
  ],
  "settings.notice.state-mismatch.title": [
    "The authorisation could not be verified",
    "Не удалось проверить авторизацию",
  ],
  "settings.notice.state-mismatch.body": [
    "The anti-forgery check failed, so the connection was refused. Start the flow again from this page.",
    "Проверка подлинности не прошла, поэтому подключение отклонено. Начните заново с этой страницы.",
  ],
  "settings.notice.exchange-failed.title": [
    "Google rejected the token exchange",
    "Google отклонил обмен токенами",
  ],
  "settings.notice.exchange-failed.body": [
    "Check that the redirect URI below exactly matches the one in your Google Cloud OAuth client.",
    "Проверьте, что redirect URI ниже в точности совпадает с указанным в OAuth-клиенте Google Cloud.",
  ],
  "settings.notice.not-configured.title": [
    "Google credentials are missing",
    "Нет ключей Google",
  ],
  "settings.notice.not-configured.body": [
    "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI in .env.local.",
    "Задайте GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET и GOOGLE_REDIRECT_URI в .env.local.",
  ],
} satisfies Entries;
