create table if not exists public.travel_file_tasks (
  id uuid primary key default gen_random_uuid(),
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  title text not null,
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'todo' check (status in ('todo','in_progress','complete')),
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travel_file_tasks_file_idx on public.travel_file_tasks(travel_file_id, status, due_date);
create index if not exists travel_file_tasks_assignee_idx on public.travel_file_tasks(assigned_to, status, due_date);

alter table public.travel_file_tasks enable row level security;

create policy "authenticated users can view travel file tasks"
  on public.travel_file_tasks for select to authenticated using (true);
create policy "authenticated users can create travel file tasks"
  on public.travel_file_tasks for insert to authenticated with check (true);
create policy "authenticated users can update travel file tasks"
  on public.travel_file_tasks for update to authenticated using (true) with check (true);
create policy "authenticated users can delete travel file tasks"
  on public.travel_file_tasks for delete to authenticated using (true);
