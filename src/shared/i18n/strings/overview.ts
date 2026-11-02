import type { Entries } from "./entry";

/** The dashboard: greeting, KPI strip, recommendations and the side rail. */
export const overview = {
  "overview.greeting": ["{greeting}, {name}", "{greeting}, {name}"],
  "overview.createTask": ["Create task", "Создать задачу"],
  "overview.proposalsWaiting.one": [
    "{count} proposed task is waiting for review.",
    "{count} предложенная задача ждёт проверки.",
  ],
  "overview.proposalsWaiting.few": [
    "{count} proposed tasks are waiting for review.",
    "{count} предложенные задачи ждут проверки.",
  ],
  "overview.proposalsWaiting.many": [
    "{count} proposed tasks are waiting for review.",
    "{count} предложенных задач ждут проверки.",
  ],
  "overview.proposalsWaiting.other": [
    "{count} proposed tasks are waiting for review.",
    "{count} предложенные задачи ждут проверки.",
  ],
  "overview.proposalsNeedReview.one": [
    "{count} proposed task needs your review",
    "{count} предложенная задача ждёт вашей проверки",
  ],
  "overview.proposalsNeedReview.few": [
    "{count} proposed tasks need your review",
    "{count} предложенные задачи ждут вашей проверки",
  ],
  "overview.proposalsNeedReview.many": [
    "{count} proposed tasks need your review",
    "{count} предложенных задач ждут вашей проверки",
  ],
  "overview.proposalsNeedReview.other": [
    "{count} proposed tasks need your review",
    "{count} предложенные задачи ждут вашей проверки",
  ],
  "overview.assignedToYou": ["Assigned to you", "Назначено вам"],
  "overview.assignedToThem": ["Assigned to them", "Назначено им"],
  "overview.waitingForOwner": ["Waiting for an owner", "Ждёт исполнителя"],
  "overview.nextMeeting": ["Next meeting", "Следующая встреча"],
  "overview.all": ["All", "Все"],
  "overview.nothingScheduled": ["Nothing scheduled", "Ничего не запланировано"],
  "overview.nothingScheduledHelp": [
    "Start a meeting and its tasks will land here afterwards.",
    "Начните встречу — её задачи появятся здесь после.",
  ],
  "overview.recentActivity": ["Recent activity", "Последние события"],
  "overview.nothingHappened": ["Nothing has happened yet.", "Пока ничего не происходило."],

  "attention.overdue": ["{count} overdue", "просрочено: {count}"],
  "attention.dueToday": ["{count} due today", "срок сегодня: {count}"],
  "attention.waiting": ["{count} waiting", "в ожидании: {count}"],
  "attention.summary": ["{parts}.", "{parts}."],
  "attention.allClear": [
    "Nothing open. A good moment to plan the next block of work.",
    "Открытых задач нет. Хороший момент спланировать следующий блок работы.",
  ],
  "attention.noneOverdue.one": [
    "{count} open task, none overdue. The board is in good shape.",
    "{count} открытая задача, просроченных нет. Доска в порядке.",
  ],
  "attention.noneOverdue.few": [
    "{count} open tasks, none overdue. The board is in good shape.",
    "{count} открытые задачи, просроченных нет. Доска в порядке.",
  ],
  "attention.noneOverdue.many": [
    "{count} open tasks, none overdue. The board is in good shape.",
    "{count} открытых задач, просроченных нет. Доска в порядке.",
  ],
  "attention.noneOverdue.other": [
    "{count} open tasks, none overdue. The board is in good shape.",
    "{count} открытые задачи, просроченных нет. Доска в порядке.",
  ],

  "kpi.open": ["Open", "Открытые"],
  "kpi.mine": ["Mine", "Мои"],
  "kpi.others": ["Others", "Остальные"],
  "kpi.theirs": ["Theirs", "Их"],
  "kpi.overdue": ["Overdue", "Просрочено"],
  "kpi.inProgress": ["In progress", "В работе"],
  "kpi.waiting": ["Waiting", "Ожидание"],
  // Short on purpose: this sits in a narrow KPI cell that truncates.
  "kpi.dueToday": ["Due today", "Сегодня"],
  "kpi.completed": ["Completed", "Завершено"],
  "kpi.completeHint": ["{percent}% complete", "{percent}% готово"],
  "kpi.overdueHint": ["{count} overdue", "просрочено: {count}"],
  "kpi.thisWeek": ["{count} this week", "{count} за неделю"],
  "kpi.workspaceProgress": ["Workspace progress", "Прогресс пространства"],
  "kpi.statusDistribution": ["Task status distribution", "Распределение задач по статусу"],

  "recs.heading": ["What to do next", "Что делать дальше"],
  "recs.empty.title": ["Nothing to flag", "Нечего отметить"],
  "recs.empty.description": [
    "No blocked work, no stale tasks, no overdue pile-ups. Recommendations appear here when the board needs attention.",
    "Ничего не заблокировано, ничего не застоялось, просрочек нет. Советы появятся здесь, когда доска потребует внимания.",
  ],
  "recs.basedOn.one": ["Based on {count} task", "На основе {count} задачи"],
  "recs.basedOn.few": ["Based on {count} tasks", "На основе {count} задач"],
  "recs.basedOn.many": ["Based on {count} tasks", "На основе {count} задач"],
  "recs.basedOn.other": ["Based on {count} tasks", "На основе {count} задач"],
  "recs.dismiss": ["Dismiss", "Скрыть"],
  "recs.dismissNamed": ["Dismiss: {title}", "Скрыть: {title}"],
  "recs.showFewer": ["Show fewer", "Показать меньше"],
  "recs.showMore": ["Show {count} more", "Показать ещё {count}"],

  "rec.state.inProgress": ["in progress", "в работе"],
  "rec.state.open": ["open", "не начата"],

  "rec.dependency.title": [
    "Finish “{blocker}” before “{task}”",
    "Завершите «{blocker}» перед «{task}»",
  ],
  "rec.dependency.body.single": [
    "“{task}” is waiting on “{blocker}”, which is still {state}.",
    "«{task}» ждёт «{blocker}» — она всё ещё {state}.",
  ],
  "rec.dependency.body.many.one": [
    "“{task}” is waiting on {count} unfinished task, starting with “{blocker}”.",
    "«{task}» ждёт {count} незавершённую задачу, начиная с «{blocker}».",
  ],
  "rec.dependency.body.many.few": [
    "“{task}” is waiting on {count} unfinished tasks, starting with “{blocker}”.",
    "«{task}» ждёт {count} незавершённые задачи, начиная с «{blocker}».",
  ],
  "rec.dependency.body.many.many": [
    "“{task}” is waiting on {count} unfinished tasks, starting with “{blocker}”.",
    "«{task}» ждёт {count} незавершённых задач, начиная с «{blocker}».",
  ],
  "rec.dependency.body.many.other": [
    "“{task}” is waiting on {count} unfinished tasks, starting with “{blocker}”.",
    "«{task}» ждёт {count} незавершённые задачи, начиная с «{blocker}».",
  ],

  "rec.blocker.title.one": [
    "“{task}” is blocking {count} task",
    "«{task}» блокирует {count} задачу",
  ],
  "rec.blocker.title.few": [
    "“{task}” is blocking {count} tasks",
    "«{task}» блокирует {count} задачи",
  ],
  "rec.blocker.title.many": [
    "“{task}” is blocking {count} tasks",
    "«{task}» блокирует {count} задач",
  ],
  "rec.blocker.title.other": [
    "“{task}” is blocking {count} tasks",
    "«{task}» блокирует {count} задачи",
  ],
  "rec.blocker.body": [
    "Clearing this one unblocks the work behind it{notStarted}. It is the highest-leverage thing on the board.",
    "Если закрыть её, работа за ней разблокируется{notStarted}. Сейчас это самое выгодное действие на доске.",
  ],
  "rec.blocker.notStarted": [
    ", and it has not been started yet",
    ", а она ещё даже не начата",
  ],

  "rec.followUp.title": [
    "Follow up with {name} on “{task}”",
    "Напомните {name} про «{task}»",
  ],
  "rec.followUp.body.blocking": [
    "This sits with {name} and other work is waiting behind it.",
    "Задача у {name}, и за ней стоит другая работа.",
  ],
  "rec.followUp.body.nudge": [
    "This sits with {name} and has not moved. A nudge may be all it needs.",
    "Задача у {name} и не двигается. Возможно, достаточно напомнить.",
  ],

  "rec.deadline.title": [
    "Agree a date for “{task}”",
    "Согласуйте срок для «{task}»",
  ],
  "rec.deadline.body": [
    "This is marked {priority} but has no deadline, so it cannot be scheduled or tracked against anything.",
    "Приоритет — «{priority}», но срока нет: задачу нельзя ни запланировать, ни отследить.",
  ],

  "rec.duplicate.title": [
    "“{a}” and “{b}” look like the same work",
    "«{a}» и «{b}» похожи на одну и ту же работу",
  ],
  "rec.duplicate.body.same": [
    "Both are open and their titles overlap heavily. Worth merging one into the other.",
    "Обе открыты, и названия сильно совпадают. Стоит объединить одну с другой.",
  ],
  "rec.duplicate.body.differentOwners": [
    "Both are open and their titles overlap heavily. Worth merging one into the other — they are currently owned by different people.",
    "Обе открыты, и названия сильно совпадают. Стоит объединить одну с другой — сейчас у них разные исполнители.",
  ],

  "rec.stale.title.one": [
    "“{task}” has not moved in {count} day",
    "«{task}» не двигается {count} день",
  ],
  "rec.stale.title.few": [
    "“{task}” has not moved in {count} days",
    "«{task}» не двигается {count} дня",
  ],
  "rec.stale.title.many": [
    "“{task}” has not moved in {count} days",
    "«{task}» не двигается {count} дней",
  ],
  "rec.stale.title.other": [
    "“{task}” has not moved in {count} days",
    "«{task}» не двигается {count} дня",
  ],
  "rec.stale.body": [
    "It is still marked in progress. Either it is actually blocked, or it is done and needs closing.",
    "Она всё ещё помечена как «в работе». Либо задача действительно заблокирована, либо уже сделана и её надо закрыть.",
  ],

  "rec.overdueCluster.title.one": [
    "{count} overdue task for {name}",
    "{count} просроченная задача у {name}",
  ],
  "rec.overdueCluster.title.few": [
    "{count} overdue tasks for {name}",
    "{count} просроченные задачи у {name}",
  ],
  "rec.overdueCluster.title.many": [
    "{count} overdue tasks for {name}",
    "{count} просроченных задач у {name}",
  ],
  "rec.overdueCluster.title.other": [
    "{count} overdue tasks for {name}",
    "{count} просроченные задачи у {name}",
  ],
  "rec.overdueCluster.body": [
    "Dates have already slipped. Rather than working through them, it is usually faster to re-date them honestly and drop what no longer matters.",
    "Сроки уже сдвинулись. Обычно быстрее честно перенести даты и отказаться от того, что потеряло смысл, чем разгребать всё подряд.",
  ],
} satisfies Entries;
