-- Tribe Leader v2 — additions for Pre-Tribe state, Crowning Ceremony,
-- First Mover, Chain Spark, Crowd Vouch, and Spark cooldown.

alter table public.tribe_members
  add column if not exists last_sparked_at timestamptz,
  add column if not exists first_mover boolean not null default false,
  add column if not exists spark_streak integer not null default 0;

create table if not exists public.tribe_meta (
  id integer primary key default 1 check (id = 1),
  first_vouch_at timestamptz,
  first_mover_id uuid references public.tribe_members(id) on delete set null,
  last_vouch_target_id uuid references public.tribe_members(id) on delete set null,
  last_voucher_id uuid references public.tribe_members(id) on delete set null,
  last_vouch_at timestamptz
);

insert into public.tribe_meta (id) values (1) on conflict (id) do nothing;

alter table public.tribe_meta enable row level security;

drop policy if exists "tribe_meta_read_all" on public.tribe_meta;
create policy "tribe_meta_read_all"
on public.tribe_meta
for select
to anon, authenticated
using (true);

drop policy if exists "tribe_meta_insert_all" on public.tribe_meta;
create policy "tribe_meta_insert_all"
on public.tribe_meta
for insert
to anon, authenticated
with check (true);

drop policy if exists "tribe_meta_update_all" on public.tribe_meta;
create policy "tribe_meta_update_all"
on public.tribe_meta
for update
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tribe_meta'
  ) then
    alter publication supabase_realtime add table public.tribe_meta;
  end if;
end $$;

-- Reset session (call before each demo to wipe XP, badges, and ceremony state).
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
      last_active_at = now();

  update public.tribe_meta
  set first_vouch_at = null,
      first_mover_id = null,
      last_vouch_target_id = null,
      last_voucher_id = null,
      last_vouch_at = null
  where id = 1;
$$;

grant execute on function public.reset_tribe_session() to anon, authenticated;
