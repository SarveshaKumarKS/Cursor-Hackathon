-- Tribe Leader v3 — engagement layer
-- Adds: tribe_events feed, Combo Multiplier, Challenge mechanic, Cheers.

-- 1. Combo + Challenge state on existing tables.
alter table public.tribe_meta
  add column if not exists combo_count integer not null default 0,
  add column if not exists combo_last_at timestamptz,
  add column if not exists combo_multiplier_until timestamptz;

alter table public.tribe_members
  add column if not exists challenge_from uuid references public.tribe_members(id) on delete set null,
  add column if not exists challenge_expires_at timestamptz;

-- 2. Battle Log + Cheer feed.
create table if not exists public.tribe_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  actor_id uuid references public.tribe_members(id) on delete set null,
  target_id uuid references public.tribe_members(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tribe_events_created_at_idx
  on public.tribe_events (created_at desc);

alter table public.tribe_events enable row level security;

drop policy if exists "tribe_events_read_all" on public.tribe_events;
create policy "tribe_events_read_all"
on public.tribe_events
for select
to anon, authenticated
using (true);

drop policy if exists "tribe_events_insert_all" on public.tribe_events;
create policy "tribe_events_insert_all"
on public.tribe_events
for insert
to anon, authenticated
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tribe_events'
  ) then
    alter publication supabase_realtime add table public.tribe_events;
  end if;
end $$;

-- 3. Reset session keeps the new state in sync.
create or replace function public.reset_tribe_session()
returns void
language sql
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
      last_active_at = now();

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

  delete from public.tribe_events;
$$;

grant execute on function public.reset_tribe_session() to anon, authenticated;
