-- v6: pass + claim with bounty.
--
-- Adds the "pass and pick up" loop: an assignee who can't do their task
-- can Pass it, which puts the task into a free-agent pool with a +10 XP
-- bounty stack (capped at +30 across multiple passes). Anyone NOT in the
-- task's passed_by set can Claim it from the pool. When the claimer
-- eventually completes and is vouched, the bounty is awarded on top of
-- the regular Self-Starter / Sparked Worker XP (handled client-side in
-- vouchForDoneTask).
--
-- Distinct from decline_task: decline = "not getting done in this run"
-- (no bounty, no orphan); pass = "I can't but maybe someone else can".

-- =========================================================================
-- 1. Schema additions
-- =========================================================================

alter table public.tasks
  add column if not exists bounty_xp int not null default 0,
  add column if not exists passed_at timestamptz,
  add column if not exists passed_by uuid[] not null default '{}',
  add column if not exists original_assignee_id uuid references public.tribe_members(id) on delete set null;

alter table public.tasks
  add constraint tasks_bounty_cap check (bounty_xp >= 0 and bounty_xp <= 30);

create index if not exists tasks_orphan_idx
  on public.tasks (project_id)
  where status = 'proposed' and assignee_id is null;

-- =========================================================================
-- 2. RPC: pass_task
-- =========================================================================

create or replace function public.pass_task(p_task uuid, p_member uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task;
  if v_task.id is null then
    raise exception 'task % not found', p_task;
  end if;
  if v_task.assignee_id is null or v_task.assignee_id <> p_member then
    raise exception 'only the current assignee can pass this task';
  end if;
  if v_task.status not in ('proposed','accepted','idle','working') then
    raise exception 'task % cannot be passed in status %', p_task, v_task.status;
  end if;

  update public.tasks
  set assignee_id = null,
      status = 'proposed',
      accepted_at = null,
      started_at = null,
      passed_at = now(),
      bounty_xp = least(bounty_xp + 10, 30),
      passed_by = case
        when p_member = any(passed_by) then passed_by
        else passed_by || p_member
      end,
      original_assignee_id = coalesce(original_assignee_id, p_member)
  where id = p_task
  returning * into v_task;

  -- Free up the (now ex-)assignee so they can pick up something else or
  -- claim a different orphan. We only flip them to idle if they were
  -- mid-flight on this exact task; otherwise leave their state alone.
  update public.tribe_members
  set current_task_id = null,
      status = case when status in ('working','done') then 'idle' else status end,
      last_active_at = now()
  where id = p_member
    and (current_task_id = p_task or current_task_id is null);

  insert into public.tribe_events (kind, actor_id, target_id, payload)
  values (
    'pass',
    p_member,
    v_task.original_assignee_id,
    jsonb_build_object(
      'task_id', v_task.id,
      'task_title', v_task.title,
      'bounty_xp', v_task.bounty_xp,
      'project_id', v_task.project_id
    )
  );

  return v_task;
end;
$$;

-- =========================================================================
-- 3. RPC: claim_task
-- =========================================================================

create or replace function public.claim_task(p_task uuid, p_member uuid)
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
  select * into v_task from public.tasks where id = p_task;
  if v_task.id is null then
    raise exception 'task % not found', p_task;
  end if;
  if v_task.assignee_id is not null then
    raise exception 'task % already assigned', p_task;
  end if;
  if v_task.status <> 'proposed' then
    raise exception 'task % is not claimable in status %', p_task, v_task.status;
  end if;
  if p_member = any(v_task.passed_by) then
    raise exception 'cannot claim a task you previously passed';
  end if;

  update public.tasks
  set assignee_id = p_member,
      status = 'accepted',
      accepted_at = now()
  where id = p_task
  returning * into v_task;

  insert into public.tribe_events (kind, actor_id, target_id, payload)
  values (
    'claim',
    p_member,
    v_task.original_assignee_id,
    jsonb_build_object(
      'task_id', v_task.id,
      'task_title', v_task.title,
      'bounty_xp', v_task.bounty_xp,
      'project_id', v_task.project_id
    )
  );

  -- Mirror accept_task's project-activation logic so a still-planning
  -- project flips active when this claim closes the last 'proposed' gap.
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

-- =========================================================================
-- 4. reset_tribe_session: zero bounty/pass state on active-project tasks
-- =========================================================================

create or replace function public.reset_tribe_session()
returns void
language sql
security definer
set search_path = public
as $$
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

  -- Replay-friendly: rewind tasks of the active project, restoring their
  -- original assignee if they had been passed mid-session.
  update public.tasks t
  set status = 'accepted',
      started_at = null,
      done_at = null,
      verified_at = null,
      bounty_xp = 0,
      passed_at = null,
      passed_by = '{}'::uuid[],
      assignee_id = coalesce(t.original_assignee_id, t.assignee_id),
      original_assignee_id = null
  from public.tribe_meta m
  where m.id = 1
    and m.active_project_id is not null
    and t.project_id = m.active_project_id
    and t.status not in ('declined','expired');
$$;

-- =========================================================================
-- 5. Grants
-- =========================================================================

revoke all on function public.pass_task(uuid, uuid) from public;
revoke all on function public.claim_task(uuid, uuid) from public;

grant execute on function public.pass_task(uuid, uuid) to anon, authenticated;
grant execute on function public.claim_task(uuid, uuid) to anon, authenticated;
