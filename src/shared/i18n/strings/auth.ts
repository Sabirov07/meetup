import type { Entries } from "./entry";

/** Sign-in, sign-up and the Google OAuth notices either one can show. */
export const auth = {
  "auth.signIn.title": ["Sign in to Meetup", "Вход в Meetup"],
  /** Shown instead of the usual heading when an invite is waiting. */
  "auth.invited.title": ["Join {workspace}", "Присоединиться к «{workspace}»"],
  "auth.invited.signUpSubtitle": [
    "Create your account and you will land straight in the workspace.",
    "Создайте аккаунт — и вы сразу окажетесь в пространстве.",
  ],
  "auth.invited.signInSubtitle": [
    "Sign in and you will be added to the workspace.",
    "Войдите — и вас добавят в пространство.",
  ],
  "auth.signIn.subtitle": [
    "Your shared workspace for turning conversations into clear ownership.",
    "Общее пространство, где разговоры превращаются в понятную ответственность.",
  ],
  "auth.signIn.footer": ["New to Meetup?", "Впервые в Meetup?"],
  "auth.signIn.footerLink": ["Create an account", "Создать аккаунт"],
  "auth.signIn.submit": ["Sign in", "Войти"],
  "auth.signIn.submitting": ["Signing in…", "Входим…"],

  "auth.signUp.title": ["Create your workspace", "Создайте пространство"],
  "auth.signUp.subtitle": [
    "Takes a moment. You can invite the people you work with afterwards.",
    "Это быстро. Коллег можно пригласить позже.",
  ],
  "auth.signUp.footer": ["Already have an account?", "Уже есть аккаунт?"],
  "auth.signUp.footerLink": ["Sign in", "Войти"],
  "auth.signUp.submit": ["Create account", "Создать аккаунт"],
  "auth.signUp.submitting": ["Creating your workspace…", "Создаём пространство…"],

  "auth.field.name": ["Your name", "Ваше имя"],
  "auth.field.namePlaceholder": ["Alex Morgan", "Алексей Морозов"],
  "auth.field.email": ["Email", "Эл. почта"],
  "auth.field.emailPlaceholder": ["you@company.com", "vy@company.com"],
  "auth.field.password": ["Password", "Пароль"],
  "auth.field.passwordHint.one": ["{count} character or more", "От {count} символа"],
  "auth.field.passwordHint.few": ["{count} characters or more", "От {count} символов"],
  "auth.field.passwordHint.many": ["{count} characters or more", "От {count} символов"],
  "auth.field.passwordHint.other": ["{count} characters or more", "От {count} символов"],

  "auth.google.continue": ["Continue with Google", "Продолжить с Google"],
  "auth.google.signUp": ["Sign up with Google", "Зарегистрироваться через Google"],
  "auth.google.off": [
    "Google sign-in is off. Add {clientId} and {clientSecret} to {envFile} to switch it on.",
    "Вход через Google выключен. Добавьте {clientId} и {clientSecret} в {envFile}, чтобы включить его.",
  ],

  "auth.notice.denied": [
    "You cancelled the Google sign-in. Nothing was changed.",
    "Вы отменили вход через Google. Ничего не изменилось.",
  ],
  "auth.notice.state-mismatch": [
    "That sign-in link had expired. Start again from this page and it will work.",
    "Ссылка для входа устарела. Начните заново с этой страницы — всё получится.",
  ],
  "auth.notice.not-configured": [
    "Google sign-in is not configured on this deployment. Use an email and password instead.",
    "Вход через Google на этом сервере не настроен. Войдите по почте и паролю.",
  ],
  "auth.notice.failed": [
    "Google could not complete the sign-in. Try again, or use an email and password.",
    "Google не смог завершить вход. Попробуйте снова или войдите по почте и паролю.",
  ],
  "auth.notice.unknown": [
    "Something went wrong starting the Google sign-in. Please try again.",
    "При запуске входа через Google что-то пошло не так. Попробуйте ещё раз.",
  ],
} satisfies Entries;
