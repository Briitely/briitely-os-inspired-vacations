-- Preserve every completed booking form as a reviewable before/after snapshot.
-- Staff can see exactly what the traveller changed even after permanent profiles are updated.

create table if not exists public.booking_form_submissions (
  id uuid primary key default gen_random_uuid(),
  booking_form_session_id uuid not null references public.booking_form_sessions(id) on delete cascade,
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  before_snapshot jsonb not null default '{}'::jsonb,
  submitted_snapshot jsonb not null default '{}'::jsonb,
  changed_fields jsonb not null default '[]'::jsonb,
  change_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_form_submissions_travel_file
  on public.booking_form_submissions (travel_file_id, submitted_at desc);

create index if not exists idx_booking_form_submissions_session
  on public.booking_form_submissions (booking_form_session_id);

alter table public.booking_form_submissions enable row level security;

create policy "active staff can view booking form submissions"
on public.booking_form_submissions for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.is_active = true
));
