# Meetup

A premium shared workspace for turning employer conversations into focused, trackable work. The current MVP provides a polished task-management experience with local demo persistence, a meeting setup flow, and an AI proposal review surface. It does not claim to retrieve transcripts or run AI extraction before those integrations are configured.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app starts with clearly labeled sample data and saves task changes to browser storage for the active demo workspace.

## Available workflows

- Create, edit, delete, filter, search, and complete tasks.
- Drag a task onto another task in the target status to update its status.
- Start a meeting record and open Google Meet in a separate tab.
- Review, approve, or reject suggested tasks from a realistic demo proposal set.
- Navigate activity, shared tasks, personal tasks, employer tasks, and settings without dead-end controls.

## Supabase setup

The initial SQL schema is in [`supabase/schema.sql`](supabase/schema.sql). Create a Supabase project, run that script in the SQL editor, then add these values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The browser client is intentionally optional while the UI uses demo data. Before switching data operations to Supabase, configure authentication and complete policies for all tables (including profiles, participants, transcripts, AI proposals, and activity events) for the intended workspace roles. Never expose a service-role key in the client.

## Google Meet and AI readiness

The meeting experience deliberately opens Google Meet rather than embedding it. To make transcript processing real:

1. Create a Google Cloud OAuth client and request only the scopes needed for meeting and transcript access.
2. Store OAuth tokens server-side and implement a server-only Google integration service.
3. Retrieve transcripts only after authorization and save source metadata plus processing state in `meeting_transcripts`.
4. Send authorized transcript text to a server-side OpenAI extraction service.
5. Persist generated suggestions as `ai_task_proposals`, then require human approval before creating shared tasks.

Keep the Google and OpenAI calls behind server-side services; the current UI is designed for those boundaries and intentionally does not fabricate their results.

## Checks

```bash
npm run lint
npm run build
```
