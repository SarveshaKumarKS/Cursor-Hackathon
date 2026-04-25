-- Tribe Leader v4 — Projects, Tasks, Calendar-aware availability,
-- and the action-coach gating layer.
--
-- New tables: projects, tasks, member_availability.
-- Adds active_project_id to tribe_meta and current_task_id, tz to tribe_members.
-- Wraps task lifecycle in security-definer RPCs so RLS stays simple.

-- =========================================================================
-- 1. Tables
-- =========================================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'custom'
    check (kind in ('cleaning','coding','gym','custom')),
  goal text,
  status text not null default 'planning'
    check (status in ('planning','active','completed','archived')),
  created_by uuid references public.tribe_members(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz
);

create index if not exists projects_status_idx
  on public.projects (status);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignee_id uuid references public.tribe_members(id) on delete set null,
  title text not null,
  description text,
  deadline_at timestamptz,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  status text not null default 'proposed'
    check (status in ('proposed','accepted','declined','idle','working','done','verified','expired')),
  accepted_at timestamptz,
  started_at timestamptz,
  done_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (scheduled_end_at > scheduled_start_at)
);

create index if not exists tasks_project_status_idx
  on public.tasks (project_id, status);
create index if not exists tasks_assignee_window_idx
  on public.tasks (assignee_id, scheduled_start_at);

create table if not exists public.member_availability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tribe_members(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  tz text not null default 'UTC',
  created_at timestamptz not null default now(),
  check (end_minute > start_minute),
  unique (member_id, weekday, start_minute, end_minute)
);

create index if not exists member_availability_member_idx
  on public.member_availability (member_id);

-- =========================================================================
-- 2. Column additions on existing tables
-- =========================================================================

alter table public.tribe_meta
  add column if not exists active_project_id uuid
    references public.projects(id) on delete set null;

alter table public.tribe_members
  add column if not exists current_task_id uuid
    references public.tasks(id) on delete set null,
  add column if not exists tz text not null default 'UTC';

-- =========================================================================
-- 3. RLS — read/insert/update for anon + authenticated.
-- DELETEs go through SECURITY DEFINER RPCs (archive/reset) only.
-- =========================================================================

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.member_availability enable row level security;

drop policy if exists "projects_read_all" on public.projects;
create policy "projects_read_all"
on public.projects for select to anon, authenticated using (true);

drop policy if exists "projects_insert_all" on public.projects;
create policy "projects_insert_all"
on public.projects for insert to anon, authenticated with check (true);

drop policy if exists "projects_update_all" on public.projects;
create policy "projects_update_all"
on public.projects for update to anon, authenticated using (true) with check (true);

drop policy if exists "tasks_read_all" on public.tasks;
create policy "tasks_read_all"
on public.tasks for select to anon, authenticated using (true);

drop policy if exists "tasks_insert_all" on public.tasks;
create policy "tasks_insert_all"
on public.tasks for insert to anon, authenticated with check (true);

drop policy if exists "tasks_update_all" on public.tasks;
create policy "tasks_update_all"
on public.tasks for update to anon, authenticated using (true) with check (true);

drop policy if exists "member_availability_read_all" on public.member_availability;
create policy "member_availability_read_all"
on public.member_availability for select to anon, authenticated using (true);

drop policy if exists "member_availability_insert_all" on public.member_availability;
create policy "member_availability_insert_all"
on public.member_availability for insert to anon, authenticated with check (true);

drop policy if exists "member_availability_update_all" on public.member_availability;
create policy "member_availability_update_all"
on public.member_availability for update to anon, authenticated using (true) with check (true);

-- =========================================================================
-- 4. Realtime publication
-- =========================================================================

do $$
declare
  t text;
begin
  for t in select unnest(array['projects','tasks','member_availability']) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =========================================================================
-- 5. RPCs
-- =========================================================================

-- Create project + tasks atomically. p_tasks is a JSON array of:
--   { title, description, assignee_id, scheduled_start_at, scheduled_end_at, deadline_at }
create or replace function public.create_project_with_tasks(
  p_name text,
  p_kind text,
  p_goal text,
  p_creator uuid,
  p_tasks jsonb
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_task jsonb;
begin
  insert into public.projects (name, kind, goal, created_by)
  values (p_name, coalesce(p_kind, 'custom'), p_goal, p_creator)
  returning * into v_project;

  if jsonb_typeof(p_tasks) = 'array' then
    for v_task in select * from jsonb_array_elements(p_tasks) loop
      insert into public.tasks (
        project_id, assignee_id, title, description,
        scheduled_start_at, scheduled_end_at, deadline_at
      ) values (
        v_project.id,
        nullif(v_task->>'assignee_id','')::uuid,
        coalesce(v_task->>'title','Untitled task'),
        v_task->>'description',
        (v_task->>'scheduled_start_at')::timestamptz,
        (v_task->>'scheduled_end_at')::timestamptz,
        nullif(v_task->>'deadline_at','')::timestamptz
      );
    end loop;
  end if;

  return v_project;
end;
$$;

-- When all tasks in a project are accepted, flip the project to active and
-- claim the meta active_project_id slot if free.
create or replace function public.accept_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_pending integer;
  v_active_count integer;
begin
  update public.tasks
  set status = 'accepted',
      accepted_at = now()
  where id = p_task
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task % not found', p_task;
  end if;

  -- Project goes active when no tasks are still 'proposed'.
  -- Declined tasks don't block (they're passed on for this run).
  select count(*) into v_pending
  from public.tasks
  where project_id = v_task.project_id
    and status = 'proposed';

  if v_pending = 0 then
    update public.projects
    set status = 'active',
        started_at = coalesce(started_at, now())
    where id = v_task.project_id
      and status = 'planning';

    select count(*) into v_active_count
    from public.projects p
    join public.tribe_meta m on m.active_project_id = p.id
    where m.id = 1 and p.status = 'active';

    if v_active_count = 0 then
      update public.tribe_meta
      set active_project_id = v_task.project_id
      where id = 1;
    end if;
  end if;

  return v_task;
end;
$$;

create or replace function public.decline_task(p_task uuid)
returns public.tasks
language sql
security definer
set search_path = public
as $$
  update public.tasks
  set status = 'declined'
  where id = p_task
  returning *;
$$;

-- Member begins their task — flips status, sets started_at, points the
-- member's current_task_id at it, and bumps last_active_at.
create or replace function public.start_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  update public.tasks
  set status = 'working',
      started_at = coalesce(started_at, now())
  where id = p_task
    and status in ('accepted','idle')
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task % not in startable state', p_task;
  end if;

  update public.tribe_members
  set current_task_id = v_task.id,
      status = 'working',
      last_active_at = now()
  where id = v_task.assignee_id;

  return v_task;
end;
$$;

create or replace function public.complete_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  update public.tasks
  set status = 'done',
      done_at = now()
  where id = p_task
    and status = 'working'
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task % not in completable state', p_task;
  end if;

  update public.tribe_members
  set status = 'done',
      last_active_at = now()
  where id = v_task.assignee_id;

  return v_task;
end;
$$;

-- Vouch flips a done task to verified, clears the member's current_task,
-- returns whether this verification completes the project (so the client
-- can play the "Project Won" ceremony).
-- OUT param names are prefixed with out_ to avoid shadowing tasks.project_id
-- when we select from public.tasks inside the function body.
create or replace function public.vouch_task(p_task uuid, p_voucher uuid)
returns table (out_task_id uuid, out_project_id uuid, out_project_completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_open integer;
begin
  update public.tasks
  set status = 'verified',
      verified_at = now()
  where id = p_task
    and status = 'done'
  returning * into v_task;

  if v_task.id is null then
    raise exception 'task % not in vouchable state', p_task;
  end if;

  update public.tribe_members
  set current_task_id = null,
      status = 'idle',
      last_active_at = now()
  where id = v_task.assignee_id;

  select count(*) into v_open
  from public.tasks
  where tasks.project_id = v_task.project_id
    and status not in ('verified','declined','expired');

  if v_open = 0 then
    update public.projects
    set status = 'completed',
        completed_at = now()
    where id = v_task.project_id;
  end if;

  return query
    select v_task.id,
           v_task.project_id,
           v_open = 0;
end;
$$;

create or replace function public.archive_project(p_project uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  update public.projects
  set status = 'archived',
      archived_at = now()
  where id = p_project
  returning * into v_project;

  if v_project.id is null then
    raise exception 'project % not found', p_project;
  end if;

  update public.tribe_meta
  set active_project_id = null
  where id = 1
    and active_project_id = v_project.id;

  return v_project;
end;
$$;

-- Replace a member's recurring availability slots in one transaction.
-- p_slots: jsonb array of { weekday, start_minute, end_minute, tz? }
create or replace function public.set_availability(
  p_member uuid,
  p_slots jsonb
)
returns setof public.member_availability
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot jsonb;
begin
  delete from public.member_availability
  where member_id = p_member;

  if jsonb_typeof(p_slots) = 'array' then
    for v_slot in select * from jsonb_array_elements(p_slots) loop
      insert into public.member_availability (
        member_id, weekday, start_minute, end_minute, tz
      ) values (
        p_member,
        (v_slot->>'weekday')::smallint,
        (v_slot->>'start_minute')::smallint,
        (v_slot->>'end_minute')::smallint,
        coalesce(v_slot->>'tz','UTC')
      );
    end loop;
  end if;

  return query
    select * from public.member_availability where member_id = p_member;
end;
$$;

-- =========================================================================
-- 6. Reset session — extended for v4 to clear current_task_id and replay
-- the active project (statuses revert to 'accepted'). Project rows stay.
-- =========================================================================

create or replace function public.reset_tribe_session()
returns void
language sql
security definer
set search_path = public
as $$
  -- Supabase rejects bare UPDATE/DELETE (error 21000), so each statement is
  -- scoped with a trivially-true predicate.
  update public.tribe_members
  set xp = 0,
      status = 'idle',
      last_sparked_by = null,
      last_sparked_at = null,
      first_mover = false,
      spark_streak = 0,
      challenge_from = null,
      challenge_expires_at = null,
      current_task_id = null,
      last_active_at = now()
  where id is not null;

  update public.tribe_meta
  set first_vouch_at = null,
      first_mover_id = null,
      last_vouch_target_id = null,
      last_voucher_id = null,
      last_vouch_at = null,
      combo_count = 0,
      combo_last_at = null,
      combo_multiplier_until = null
  where id = 1;

  delete from public.tribe_events where id is not null;

  -- Replay-friendly: rewind tasks of the active project back to 'accepted'.
  update public.tasks t
  set status = 'accepted',
      started_at = null,
      done_at = null,
      verified_at = null
  from public.tribe_meta m
  where m.id = 1
    and m.active_project_id is not null
    and t.project_id = m.active_project_id
    and t.status not in ('declined','expired');
$$;

-- =========================================================================
-- 7. Grants
-- =========================================================================

revoke all on function public.create_project_with_tasks(text, text, text, uuid, jsonb) from public;
revoke all on function public.accept_task(uuid) from public;
revoke all on function public.decline_task(uuid) from public;
revoke all on function public.start_task(uuid) from public;
revoke all on function public.complete_task(uuid) from public;
revoke all on function public.vouch_task(uuid, uuid) from public;
revoke all on function public.archive_project(uuid) from public;
revoke all on function public.set_availability(uuid, jsonb) from public;
revoke all on function public.reset_tribe_session() from public;

grant execute on function public.create_project_with_tasks(text, text, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.accept_task(uuid) to anon, authenticated;
grant execute on function public.decline_task(uuid) to anon, authenticated;
grant execute on function public.start_task(uuid) to anon, authenticated;
grant execute on function public.complete_task(uuid) to anon, authenticated;
grant execute on function public.vouch_task(uuid, uuid) to anon, authenticated;
grant execute on function public.archive_project(uuid) to anon, authenticated;
grant execute on function public.set_availability(uuid, jsonb) to anon, authenticated;
grant execute on function public.reset_tribe_session() to anon, authenticated;
