-- Apply this migration in a Supabase project after authentication is configured.
create type public.workspace_role as enum ('administrator', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'completed');
create type public.task_priority as enum ('urgent', 'high', 'medium', 'low');

create table public.profiles (id uuid primary key references auth.users on delete cascade, full_name text not null, avatar_url text, created_at timestamptz not null default now());
create table public.workspaces (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.workspace_memberships (workspace_id uuid references public.workspaces on delete cascade, profile_id uuid references public.profiles on delete cascade, role public.workspace_role not null default 'member', primary key (workspace_id, profile_id));
create table public.meetings (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade, title text not null, scheduled_at timestamptz, duration_minutes integer, meet_url text, created_at timestamptz not null default now());
create table public.tasks (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces on delete cascade, title text not null, description text, assignee_id uuid references public.profiles, creator_id uuid references public.profiles, priority public.task_priority not null default 'medium', status public.task_status not null default 'todo', due_date date, project text, meeting_id uuid references public.meetings on delete set null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.meeting_participants (meeting_id uuid references public.meetings on delete cascade, profile_id uuid references public.profiles on delete cascade, primary key (meeting_id, profile_id));
create table public.meeting_transcripts (id uuid primary key default gen_random_uuid(), meeting_id uuid unique references public.meetings on delete cascade, status text not null default 'pending', content text, created_at timestamptz not null default now());
create table public.ai_task_proposals (id uuid primary key default gen_random_uuid(), meeting_id uuid references public.meetings on delete cascade, payload jsonb not null, status text not null default 'pending', created_at timestamptz not null default now());
create table public.activity_events (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces on delete cascade, actor_id uuid references public.profiles, entity_type text not null, entity_id uuid, action text not null, metadata jsonb, created_at timestamptz not null default now());

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
create policy "members can access their workspaces" on public.workspaces for all using (exists (select 1 from public.workspace_memberships m where m.workspace_id = id and m.profile_id = auth.uid()));
create policy "members can access membership" on public.workspace_memberships for all using (profile_id = auth.uid() or exists (select 1 from public.workspace_memberships m where m.workspace_id = workspace_id and m.profile_id = auth.uid()));
create policy "members can access tasks" on public.tasks for all using (exists (select 1 from public.workspace_memberships m where m.workspace_id = tasks.workspace_id and m.profile_id = auth.uid()));
create policy "members can access meetings" on public.meetings for all using (exists (select 1 from public.workspace_memberships m where m.workspace_id = meetings.workspace_id and m.profile_id = auth.uid()));
