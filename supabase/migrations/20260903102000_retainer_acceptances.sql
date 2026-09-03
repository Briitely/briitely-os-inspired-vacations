-- Snapshot each customer retainer acceptance separately from booking-form completion.
-- This preserves the exact agreement terms and commercial details accepted at that moment.

create table if not exists public.retainer_acceptances (
  id uuid primary key default gen_random_uuid(),
  booking_form_session_id uuid not null references public.booking_form_sessions(id) on delete cascade,
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  agreement_version text not null,
  agreement_text text not null,
  retainer_amount numeric,
  agreement_type text,
  revisions_included integer,
  accepted_name text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  created_at timestamptz not null default now(),
  unique (booking_form_session_id)
);

create index if not exists idx_retainer_acceptances_travel_file on public.retainer_acceptances(travel_file_id);

alter table public.retainer_acceptances enable row level security;

create policy "active staff can view retainer acceptances"
on public.retainer_acceptances for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true));
