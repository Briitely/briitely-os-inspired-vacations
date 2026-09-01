-- Action task foundation for Current Action workflow steps.
-- Reuses travel_action_requirements as the persistent task store so tasks stay
-- attached to their action history after the workflow advances.

create unique index if not exists idx_travel_action_requirements_action_code
  on public.travel_action_requirements (travel_action_id, requirement_code);

create index if not exists idx_travel_action_requirements_status
  on public.travel_action_requirements (status);

create index if not exists idx_travel_action_requirements_completed_by
  on public.travel_action_requirements (completed_by);
