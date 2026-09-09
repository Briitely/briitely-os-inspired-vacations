alter table public.travel_file_tasks
  alter column travel_file_id drop not null;
alter table public.travel_file_tasks
  add column if not exists task_context text not null default 'travel_file'
  check (task_context in ('travel_file','general'));
update public.travel_file_tasks
set task_context = case when travel_file_id is null then 'general' else 'travel_file' end;
