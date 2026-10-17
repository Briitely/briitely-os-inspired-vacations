create table if not exists public.travel_negotiation_followups (
 id uuid primary key default gen_random_uuid(),
 travel_file_id uuid not null references public.travel_files(id) on delete cascade,
 step integer not null check (step between 1 and 3),
 due_date date not null,
 assigned_advisor_id uuid,
 completed_at timestamptz,
 completed_by uuid,
 created_at timestamptz not null default now(),
 unique(travel_file_id,step)
);
create index if not exists travel_negotiation_followups_file_idx on public.travel_negotiation_followups(travel_file_id);
alter table public.travel_negotiation_followups enable row level security;
