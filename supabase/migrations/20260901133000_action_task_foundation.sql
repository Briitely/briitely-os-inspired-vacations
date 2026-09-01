-- Action task foundation for Current Action workflow steps.
-- Reuses travel_action_requirements as the persistent task store so tasks stay
-- attached to their action history after the workflow advances.

alter table public.travel_action_requirements
  add column if not exists requirement_label text,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.profiles(id) on delete set null;

-- Existing requirement rows may predate the task UI. Give them a readable
-- fallback label so the Current Action card can render safely.
update public.travel_action_requirements
set requirement_label = coalesce(nullif(requirement_label, ''), initcap(replace(requirement_code, '_', ' ')))
where requirement_label is null or requirement_label = '';

create unique index if not exists idx_travel_action_requirements_action_code
  on public.travel_action_requirements (travel_action_id, requirement_code);

create index if not exists idx_travel_action_requirements_status
  on public.travel_action_requirements (status);

create index if not exists idx_travel_action_requirements_completed_by
  on public.travel_action_requirements (completed_by);
