# backend

Server-only code. None of it reaches the browser: every module here either
starts with `import "server-only"` or is only ever reached from one that does.

| Folder       | What it holds                                                     |
| ------------ | ----------------------------------------------------------------- |
| `actions/`   | Server Functions — validation, authorisation, writes, activity log |
| `data/`      | Reads → view models, with dates serialised for the client boundary |
| `auth/`      | Sessions, scrypt hashing, provisioning, the authorisation chokepoint |
| `ai/`        | Claude extraction behind a strict schema                           |
| `google/`    | Google sign-in and the Meet REST v2 client                         |
| `images/`    | Reads an image's pixel size out of its header                      |
| `db.ts`      | The Prisma client (one pool, reused across dev reloads)            |
| `app-url.ts` | The app's public origin, repaired and validated once               |

Route handlers and pages live in `src/app/` because Next.js requires it; they
stay thin and call into this folder.
