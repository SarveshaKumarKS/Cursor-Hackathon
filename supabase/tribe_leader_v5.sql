-- v5: project visibility fix.
--
-- Bug: create_project_with_tasks left projects in 'planning' status and never
-- set tribe_meta.active_project_id. Since App.jsx derives activeProject from
-- that column, the freshly-created project (and its proposed tasks) was
-- invisible — nobody could accept their task, so the project never flipped
-- to 'active' and never became visible. Dead-end.
--
-- Fix: when no project currently owns the slot, the newly-created project
-- claims it immediately. The ProjectBanner already renders 'planning' state
-- ("Awaiting accept · X / Y") and TaskAcceptance panels surface for each
-- assignee. Once everyone accepts, accept_task flips status to 'active' as
-- before — the slot ownership is idempotent.

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

  -- Claim the active slot when nothing else owns it so the project (and its
  -- proposed tasks) immediately become visible to members for acceptance.
  update public.tribe_meta
  set active_project_id = v_project.id
  where id = 1
    and active_project_id is null;

  return v_project;
end;
$$;

revoke all on function public.create_project_with_tasks(text, text, text, uuid, jsonb) from public;
grant execute on function public.create_project_with_tasks(text, text, text, uuid, jsonb) to anon, authenticated;
