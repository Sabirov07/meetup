import type { Entries } from "./entry";

/**
 * The Team page, the invite flow and the workspace switcher.
 *
 * Russian note: "пространство" (workspace) is neuter, so agreement differs
 * from the English throughout — which is why the sentences here are written
 * whole rather than assembled from a noun plus a fragment.
 */
export const team = {
  "team.heading": ["Team", "Команда"],
  "team.description": [
    "Who is in this workspace, what they are carrying, and how to add someone.",
    "Кто работает в пространстве, что на них лежит и как добавить нового человека.",
  ],

  // --- Members ----------------------------------------------------------
  "team.members.title": ["Members", "Участники"],
  "team.members.count.one": ["{count} person", "{count} человек"],
  "team.members.count.few": ["{count} people", "{count} человека"],
  "team.members.count.many": ["{count} people", "{count} человек"],
  "team.members.count.other": ["{count} people", "{count} человека"],
  "team.member.you": ["you", "это вы"],
  "team.member.noTitle": ["No job title yet", "Должность не указана"],
  "team.member.joined": ["Joined {date}", "Присоединился(лась) {date}"],
  "team.member.open": ["{count} open", "{count} в работе"],
  "team.member.overdue": ["{count} overdue", "{count} просрочено"],
  "team.member.done": ["{count} done", "{count} готово"],
  "team.member.nothingOpen": ["Nothing open", "Нет открытых задач"],
  "team.member.viewTasks": ["View their tasks", "Посмотреть их задачи"],
  "team.member.manage": ["Manage {name}", "Управление: {name}"],

  "team.role.change": ["Role", "Роль"],
  "team.role.makeAdmin": ["Make administrator", "Сделать администратором"],
  "team.role.makeMember": ["Change to member", "Сделать участником"],
  "team.role.changed": ["Role updated", "Роль изменена"],
  "team.role.failed": ["Could not change the role", "Не удалось изменить роль"],
  "team.role.adminHint": [
    "Everyone joins as an administrator: they can invite and remove people, change roles, manage sections and rename the workspace. Change someone to a member to take that away.",
    "Все присоединяются администраторами: могут приглашать и удалять людей, менять роли, управлять разделами и переименовывать пространство. Чтобы ограничить человека, сделайте его участником.",
  ],

  // --- Removing someone -------------------------------------------------
  "team.remove.action": ["Remove from workspace", "Удалить из пространства"],
  "team.remove.title": ["Remove {name}?", "Удалить {name}?"],
  "team.remove.body": [
    "They lose access to this workspace immediately. Their completed work and their comments stay where they are.",
    "Они сразу потеряют доступ к пространству. Выполненная работа и комментарии останутся на месте.",
  ],
  "team.remove.openWork.one": [
    "They have {count} open task.",
    "На них {count} открытая задача.",
  ],
  "team.remove.openWork.few": [
    "They have {count} open tasks.",
    "На них {count} открытые задачи.",
  ],
  "team.remove.openWork.many": [
    "They have {count} open tasks.",
    "На них {count} открытых задач.",
  ],
  "team.remove.openWork.other": [
    "They have {count} open tasks.",
    "На них {count} открытой задачи.",
  ],
  "team.remove.handTo": ["Hand their open tasks to", "Передать открытые задачи"],
  "team.remove.leaveUnassigned": ["Leave them unassigned", "Оставить без исполнителя"],
  "team.remove.confirm": ["Remove", "Удалить"],
  "team.remove.done": ["{name} was removed", "{name} удалён(а)"],
  "team.remove.failed": ["Could not remove them", "Не удалось удалить"],

  // --- Inviting ---------------------------------------------------------
  "team.invite.title": ["Invite someone", "Пригласить человека"],
  "team.invite.description": [
    "Create a link and send it however you already talk. No email is sent from here.",
    "Создайте ссылку и отправьте её там, где вы обычно общаетесь. Письма отсюда не уходят.",
  ],
  "team.invite.roleHint": [
    "Administrator by default — they can run the workspace with you",
    "По умолчанию администратор — сможет управлять пространством вместе с вами",
  ],
  "team.invite.email": ["Email", "Почта"],
  "team.invite.emailHint": [
    "Optional — leave it empty for a link anyone may use",
    "Необязательно: оставьте пустым, и ссылкой сможет воспользоваться любой",
  ],
  "team.invite.emailPlaceholder": ["anna@company.com", "anna@company.com"],
  "team.invite.jobTitle": ["Job title", "Должность"],
  "team.invite.jobTitlePlaceholder": ["Designer", "Дизайнер"],
  "team.invite.role": ["Joins as", "Присоединяется как"],
  "team.invite.create": ["Create invite link", "Создать ссылку"],
  "team.invite.creating": ["Creating…", "Создаём…"],
  "team.invite.created": ["Invite link ready", "Ссылка готова"],
  "team.invite.createFailed": ["Could not create the invite", "Не удалось создать приглашение"],
  "team.invite.copy": ["Copy link", "Копировать ссылку"],
  "team.invite.copied": ["Link copied", "Ссылка скопирована"],
  "team.invite.copyFailed": [
    "Could not copy. Select the link and copy it manually.",
    "Скопировать не удалось. Выделите ссылку и скопируйте вручную.",
  ],
  "team.invite.readyNote": [
    "Send this to {who}. It works once, and expires in {days} days.",
    "Отправьте это {who}. Ссылка срабатывает один раз и истекает через {days} дней.",
  ],
  "team.invite.readyNoteAnyone": [
    "Anyone with this link can join as {role}. It works once, and expires in {days} days.",
    "Любой, у кого есть ссылка, войдёт как {role}. Ссылка срабатывает один раз и истекает через {days} дней.",
  ],

  "team.pending.title": ["Pending invites", "Ожидающие приглашения"],
  "team.pending.empty": [
    "No invites are waiting to be accepted.",
    "Нет приглашений, ожидающих принятия.",
  ],
  "team.pending.anyone": ["Anyone with the link", "Любой, у кого есть ссылка"],
  "team.pending.expires": ["Expires {when}", "Истекает {when}"],
  "team.pending.invitedBy": ["Invited by {name}", "Пригласил(а): {name}"],
  "team.pending.revoke": ["Revoke", "Отозвать"],
  "team.pending.revoked": ["Invite revoked", "Приглашение отозвано"],
  "team.pending.revokeFailed": [
    "Could not revoke that invite",
    "Не удалось отозвать приглашение",
  ],

  // --- Unassigned work --------------------------------------------------
  "team.unassigned.title": ["Nobody's tasks", "Задачи без исполнителя"],
  "team.unassigned.body.one": [
    "{count} open task has no assignee.",
    "{count} открытая задача без исполнителя.",
  ],
  "team.unassigned.body.few": [
    "{count} open tasks have no assignee.",
    "{count} открытые задачи без исполнителя.",
  ],
  "team.unassigned.body.many": [
    "{count} open tasks have no assignee.",
    "{count} открытых задач без исполнителя.",
  ],
  "team.unassigned.body.other": [
    "{count} open tasks have no assignee.",
    "{count} открытой задачи без исполнителя.",
  ],
  "team.unassigned.link": ["Assign them", "Распределить"],

  // --- Leaving ----------------------------------------------------------
  "team.leave.title": ["Leave this workspace", "Покинуть пространство"],
  "team.leave.body": [
    "You lose access to its tasks, meetings and pages. Someone who is still an administrator can invite you back.",
    "Вы потеряете доступ к задачам, встречам и страницам. Любой администратор сможет пригласить вас обратно.",
  ],
  "team.leave.action": ["Leave workspace", "Покинуть пространство"],
  "team.leave.confirm": ["Leave {name}?", "Покинуть «{name}»?"],
  "team.leave.done": ["You left {name}", "Вы покинули «{name}»"],
  "team.leave.failed": ["Could not leave", "Не удалось выйти"],
  "team.leave.onlyWorkspace": [
    "This is your only workspace, so there is nowhere to go. Create another one first.",
    "Это ваше единственное пространство, уходить некуда. Сначала создайте другое.",
  ],

  // --- Workspace switcher -----------------------------------------------
  "team.switcher.heading": ["Workspaces", "Пространства"],
  "team.switcher.switched": ["Switched to {name}", "Переключено на «{name}»"],
  "team.switcher.switchFailed": ["Could not switch workspace", "Не удалось переключиться"],
  "team.switcher.create": ["Create a workspace", "Создать пространство"],
  "team.switcher.createTitle": ["New workspace", "Новое пространство"],
  "team.switcher.createBody": [
    "A separate company, client or project. You will be its administrator, and it starts empty.",
    "Отдельная компания, клиент или проект. Вы станете администратором, и оно начнётся с нуля.",
  ],
  "team.switcher.createName": ["Workspace name", "Название пространства"],
  "team.switcher.createNamePlaceholder": ["Acme Inc.", "ООО «Ромашка»"],
  "team.switcher.created": ["Workspace created", "Пространство создано"],
  "team.switcher.createFailed": [
    "Could not create the workspace",
    "Не удалось создать пространство",
  ],
  "team.switcher.manage": ["Manage team", "Управление командой"],
  "team.switcher.main": ["Main", "Основное"],
  "team.switcher.setMain": ["Make this the main workspace", "Сделать пространство основным"],
  "team.switcher.mainSet": [
    "{name} is now your main workspace",
    "Основным пространством теперь будет «{name}»",
  ],
  "team.switcher.setMainFailed": [
    "Could not set the main workspace",
    "Не удалось сменить основное пространство",
  ],

  // --- The join page ----------------------------------------------------
  "join.title": ["You have been invited", "Вас пригласили"],
  "join.subtitle": [
    "{inviter} invited you to join {workspace} on Meetup.",
    "{inviter} приглашает вас в «{workspace}» в Meetup.",
  ],
  "join.subtitleNoInviter": [
    "You have been invited to join {workspace} on Meetup.",
    "Вас приглашают в «{workspace}» в Meetup.",
  ],
  "join.asRole": ["You will join as {role}.", "Вы войдёте с ролью «{role}»."],
  "join.pinnedTo": [
    "This invite is for {email}.",
    "Это приглашение для {email}.",
  ],
  "join.expires": ["The link expires {when}.", "Ссылка истекает {when}."],
  "join.accept": ["Join {workspace}", "Войти в «{workspace}»"],
  "join.accepting": ["Joining…", "Входим…"],
  "join.accepted": ["You are in", "Вы в команде"],
  "join.acceptFailed": ["Could not accept the invite", "Не удалось принять приглашение"],
  "join.signedInAs": ["Signed in as {email}.", "Вы вошли как {email}."],
  "join.createAccount": ["Create an account", "Создать аккаунт"],
  "join.haveAccount": ["I already have an account", "У меня уже есть аккаунт"],
  "join.wrongAccount": [
    "This invite is for {email}, but you are signed in as {current}.",
    "Приглашение для {email}, а вы вошли как {current}.",
  ],
  "join.switchAccount": ["Sign out and use {email}", "Выйти и войти как {email}"],
  "join.alreadyMember": [
    "You are already a member of {workspace}.",
    "Вы уже участник «{workspace}».",
  ],
  "join.openWorkspace": ["Open {workspace}", "Открыть «{workspace}»"],

  "join.problem.heading": ["This invite cannot be used", "Это приглашение не действует"],
  "join.problem.unknown": [
    "That link does not match any invitation. Check you copied all of it, or ask for a new one.",
    "Такой ссылки нет ни у одного приглашения. Проверьте, что скопировали её целиком, или попросите новую.",
  ],
  "join.problem.revoked": [
    "The invitation was cancelled. Ask an administrator for a new link.",
    "Приглашение отменили. Попросите у администратора новую ссылку.",
  ],
  "join.problem.accepted": [
    "That link has already been used. An invite works once; ask for a fresh one.",
    "Эта ссылка уже использована. Приглашение срабатывает один раз — попросите новое.",
  ],
  "join.problem.expired": [
    "The invitation has expired. Ask an administrator for a new link.",
    "Приглашение истекло. Попросите у администратора новую ссылку.",
  ],
  "join.problem.wrongEmail": [
    "That invitation belongs to a different email address.",
    "Это приглашение выдано на другой адрес почты.",
  ],
  "join.backToApp": ["Go to Meetup", "Перейти в Meetup"],
} satisfies Entries;
