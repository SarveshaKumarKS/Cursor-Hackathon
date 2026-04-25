-- Tribe Leader demo schema (single table, no auth)
create extension if not exists pgcrypto;

drop table if exists public.tribe_members cascade;

create table public.tribe_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  xp integer not null default 0 check (xp >= 0),
  status text not null default 'idle' check (status in ('idle', 'working', 'done')),
  last_sparked_by uuid references public.tribe_members(id) on delete set null,
  last_active_at timestamptz not null default now()
);

alter table public.tribe_members enable row level security;

create policy "tribe_members_read_all"
on public.tribe_members
for select
to anon, authenticated
using (true);

create policy "tribe_members_insert_all"
on public.tribe_members
for insert
to anon, authenticated
with check (true);

create policy "tribe_members_update_all"
on public.tribe_members
for update
to anon, authenticated
using (true)
with check (true);

insert into public.tribe_members (name, status, xp)
values
  ('Ari', 'idle', 0),
  ('Blaze', 'idle', 0),
  ('Cyra', 'idle', 0),
  ('Dax', 'idle', 0)
on conflict (name) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tribe_members'
  ) then
    alter publication supabase_realtime add table public.tribe_members;
  end if;
end $$;
