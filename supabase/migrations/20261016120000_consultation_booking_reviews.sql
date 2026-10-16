create table if not exists public.consultation_booking_reviews (
  id uuid primary key default gen_random_uuid(),
  contact_id text not null,
  appointment_id text,
  client_name text,
  appointment_start timestamptz,
  booking_payload jsonb not null,
  candidate_file_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','resolved')),
  resolved_file_id uuid references public.travel_files(id),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists consultation_booking_reviews_appointment_unique
  on public.consultation_booking_reviews(contact_id,appointment_id) where appointment_id is not null;
create unique index if not exists consultation_booking_reviews_contact_without_appointment_unique
  on public.consultation_booking_reviews(contact_id) where appointment_id is null and status='pending';
create index if not exists consultation_booking_reviews_pending_idx on public.consultation_booking_reviews(status,created_at);
alter table public.consultation_booking_reviews enable row level security;
-- The webhook and authenticated review API use the service client. No direct client access.
