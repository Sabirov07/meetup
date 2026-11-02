# Meetup

A shared workspace for two people — an employee and their employer — that turns
conversations into clear, trackable ownership.

The product is built around one idea: **a model can read a conversation, but it
cannot decide who committed to what.** So AI output never becomes a commitment
on its own. It lands as a *proposal*, carrying the evidence behind it and an
honest statement of how sure it is, and a person approves, edits, or rejects it.

---

## What works right now

Against a real Postgres database, with no stubs:

| Area | State |
|---|---|
| Auth | Open sign-up with email + password, or **Continue with Google**. Server sessions (scrypt hashes, httpOnly cookie, opaque tokens). Sign in, sign out, route protection. |
| Tasks | Create, edit, delete, comment, depend-on, complete. Optimistic updates with rollback. |
| Documents | Every task has a Markdown document body: headings, checklists, quotes, code, dividers and images. Toolbar, `/` block menu, ⌘B/⌘I/⌘E/⌘K, list continuation on Enter, autosave, a full-width split view with live preview, and checklists that can be ticked straight from the read view. |
| Images | Pasted, dropped or picked into a document. Stored in Postgres and served from `/api/attachments/[id]`, which requires a session in the owning workspace — so a screenshot in a task is not readable by URL alone. |
| Boards | Dashboard owner panels + per-page kanban. Drag between statuses and between owners; a move reassigns, never copies. |
| Prioritisation | Smart priority engine with a visible, per-task explanation of *why* a task ranks where it does. |
| Sorting | 8 modes. Manual order is never silently re-sorted. |
| Filtering | 9 facets that combine correctly; filtered counts stay distinct from global counts. |
| Meetings | Create, track through a real lifecycle, attach a transcript, delete. |
| Transcripts | Stored per meeting, server-side; only sent to the browser when explicitly opened. |
| AI review | Summary, decisions, open questions and proposed tasks, each labelled Confirmed / Inferred / Suggested. Approve, edit, bulk-approve or reject. |
| Recommendations | Derived from live task state; every one cites the tasks it came from. |
| Activity | Full audit trail — status, owner, priority and deadline changes, with from → to. |
| Settings | Rename people, change roles and avatar colours, see exactly which integration env vars are missing. |

Everything above was exercised end to end in a browser against the live
database, including a full task lifecycle (create → in progress → waiting →
complete) with the statistics and history verified at each step.

## What needs credentials

Both are **optional**. The product does not simulate either one — where a
credential is missing, the UI says so and the control is disabled.

- **Transcript analysis** needs `ANTHROPIC_API_KEY`. Without it, transcripts are
  stored but the *Analyse* button is disabled and says why.
- **Google sign-in** needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Without
  them the login page simply does not offer it and says which variables are
  missing; email and password keep working.
- **Google Meet** needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
  `GOOGLE_REDIRECT_URI`. Without them, *Create a Google Meet* is disabled and
  you paste a link instead. The app never invents a `meet.google.com` URL.

### Signing in

Three ways in, all real:

- **Create an account** at `/signup` — name, email, password (8 characters or
  more). The account gets its own workspace and is its administrator.
- **Sign in** at `/login` with that email and password.
- **Continue with Google**, on either page.

Google sign-in and the Google *Meet* integration are deliberately separate
flows on the same OAuth client:

| | Sign-in | Meet |
|---|---|---|
| Scopes | `openid email profile` | `meetings.space.created`, `meetings.space.readonly` |
| Redirect URI | `/api/auth/google/callback` | `/api/google/callback` |
| Stores tokens | No — the ID token is read once and discarded | Yes, in `google_accounts` |

Signing in therefore never asks for Meet permissions, and connecting Meet stays
a separate, explicit step in **Settings**. Both redirect URIs have to be listed
on the OAuth client. The sign-in one defaults to `APP_URL` +
`/api/auth/google/callback`; override it with `GOOGLE_AUTH_REDIRECT_URI` when
the public URL differs from `APP_URL`.

A Google account whose verified email matches an existing account is **linked**
to it rather than duplicating the person. Matching is on Google's `sub` claim
first, which does not change when someone changes their Google email address.

### Google Meet transcripts, specifically

Worth knowing before you spend time on the setup:

- Meet only produces transcripts for a **Google Workspace** plan that includes
  transcription. A personal `@gmail.com` account can complete OAuth and call the
  API, but `conferenceRecords.transcripts` will always be empty.
- Transcription must have been **switched on during the call**. It is not
  retroactive.
- Transcripts are **not available the moment a call ends** — which is why
  *Awaiting transcript* is a normal state in the lifecycle, not an error.
- Scopes requested: `meetings.space.created`, `meetings.space.readonly`.
- Google deletes transcript entries **30 days** after the conference ends.

Setup: Google Cloud Console → enable the *Google Meet API* → create an OAuth
client (Web application) → add your redirect URI exactly as it appears in
Settings → put the id and secret in `.env.local`. Then connect your account from
the Settings page.

---

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev -- -p 3100
```

Open `http://localhost:3100`. Either **create an account** at `/signup`, or sign
in with one of the seeded accounts — those emails are printed by the seed, and
the password is the `SEED_PASSWORD` value in `.env.local`.

`db:seed` is optional. It exists so the app is not empty on a first look; a
brand-new account gets its own empty workspace instead. The seeded names
(*Alex Morgan*, *Maya Chen*) are placeholders — rename them, and the workspace,
from **Settings**.

### Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:migrate   # apply migrations
npm run db:seed      # reset + reseed demo content
npm run db:studio    # browse the database
```

---

## Trying the whole flow

1. **Meetings → Start meeting.** Pick *No link yet* (or paste a Meet link).
2. Open the meeting → **Add transcript**. Paste a conversation in
   `Name: what they said` form, one turn per line. Speaker labels are what the
   ownership detection reads.
3. **Analyse** (needs `ANTHROPIC_API_KEY`). The model returns a summary,
   decisions, open questions and proposed tasks.
4. **AI review.** Each proposal shows its owner, priority and deadline with an
   evidence level and a one-line rationale. Anything genuinely ambiguous is
   flagged *Needs a decision*.
5. **Approve.** A real task is created, linked back to the meeting and the
   quote it came from, and marked confirmed-by-human so re-analysis can never
   overwrite it.

Without an API key you can still do steps 1–2 and 4–5, because the workspace is
seeded with a labelled sample analysis.

---

## Architecture

The source tree is split by where the code runs. Each folder has its own
README with the detail.

```
prisma/schema.prisma      17 tables. Ownership is always a member reference,
                          never a "me"/"employer" enum.

src/backend/              Server only — never reaches the browser.
  actions/                Server Functions. Validation, authorisation, activity.
  data/                   Reads → view models (dates serialised for the client).
  auth/                   Sessions, scrypt hashing, account provisioning,
                          the authorisation chokepoint.
  ai/                     Claude extraction behind a strict schema.
  google/                 Sign-in (identity.ts) + Meet REST v2 (oauth.ts, meet.ts).
  images/                 Pixel size read out of an image header.
  db.ts, app-url.ts       Prisma client; the app's public origin.

src/frontend/             Everything the browser gets.
  components/             ui/ primitives, then one folder per surface.
  lib/                    Formatting and class-name helpers.
  styles/globals.css      Design tokens. No component writes a raw colour.

src/shared/               Pure logic both sides run. No database, no DOM.
  domain/                 Priority scoring, filters, stats, labels, types.
  doc/                    The document format: a Markdown subset parsed to a
                          typed block tree, plus the editor's text transforms.

src/app/                  Routes, and nothing else. Next.js requires this
                          folder; pages and route handlers stay thin and call
                          into backend/ and frontend/.
```

**Why `shared/` rather than two folders flat.** Filing the domain logic under
either side would misstate who depends on it — the task list scores priorities
in the browser with the same function the server uses, and the document parser
runs in both. Keeping it apart is what lets `backend/` mean *server only* and
`frontend/` mean *shipped to the browser*, with no exceptions to remember.

**Components importing `backend/actions/` is the network boundary.** A Server
Function's body never ships to the browser; the import is a reference the
bundler turns into an RPC call. It is the one import that crosses layers, and
it crosses in the direction a client-server app expects.

A few decisions worth knowing:

**Authorisation is enforced in the server layer, not by RLS.** Prisma connects
as the Postgres owner role, which carries `BYPASSRLS`, so row-level policies do
not constrain application queries. Every read and write is scoped by a
`workspaceId` that came from `requireSession()`. RLS is still enabled on every
table with no permissive policies, which matters: it locks down the public
PostgREST endpoint Supabase exposes on every project by default.

**Documents render as React, never as HTML.** `lib/doc/markdown.ts` parses the
Markdown subset into a block tree and `components/doc/doc-content.tsx` renders
each node as an element, so there is no `dangerouslySetInnerHTML` on the path a
task body travels and markup pasted into a document stays text. Link and image
targets go through an allow-list; `javascript:` and `data:` URLs render as the
text that was typed.

**Embedded images live in Postgres.** Not in `public/`, which is readable by
anyone holding the URL, and not in a bucket, which would need its own
authorisation story. `task_attachments` rows carry the workspace id, and
`/api/attachments/[id]` fetches by id *and* the caller's workspace — so a
screenshot pasted into a task is behind the same check as the task. Uploads go
through a Route Handler rather than a Server Function because Server Functions
cap request bodies at 1 MB.

**AI output is quarantined.** It is written to `meeting_analyses` and
`task_proposals`, never to `tasks`. `Task.confirmedByHuman` records the moment a
person took responsibility for a value, and re-analysis will not touch those
rows.

**Cache Components is on.** Every route is session-gated, so each page segment
declares `instant = false` and streams a skeleton from a `<Suspense>` boundary.
Clock reads happen after `connection()`, never during prerender.

**Two database URLs.** Runtime uses the transaction pooler (6543); migrations
use the session pooler (5432), because the transaction pooler rejects Prisma's
prepared statements.

---

## Not built

Stated plainly rather than stubbed:

- **Automatic transcript retrieval.** The Meet API client (`lib/google/meet.ts`)
  implements space creation, conference records, transcripts and entries, and
  `Transcript` carries `retryCount` / `nextRetryAt` for backoff — but no
  scheduled job calls it yet. Transcripts are attached manually today.
- **Multi-workspace UI.** The schema supports N workspaces and N members; the
  UI assumes the one you are in.
- **Invites.** Sign-up creates a workspace of your own; there is no way yet to
  invite someone into an existing one, or to join one by link.
- **Password reset.** No email is sent anywhere in the product, so there is no
  recovery flow. An account that signed up with Google has no password at all,
  and the login form says so rather than claiming the password is wrong.
- **Google Meet embedded in-page.** Meet opens in a separate tab, which is both
  what Google supports and what keeps the task board usable during a call.
