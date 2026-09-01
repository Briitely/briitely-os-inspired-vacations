-- Secure customer-facing booking form links.
-- Only a SHA-256 hash of the public token is stored in the database.

create table if not exists public.booking_form_sessions (
  id uuid primary key default gen_random_uuid(),
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  completed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_form_sessions_file_idx
  on public.booking_form_sessions (travel_file_id);

create index if not exists booking_form_sessions_token_idx
  on public.booking_form_sessions (token_hash);

drop trigger if exists set_booking_form_sessions_updated_at on public.booking_form_sessions;
create trigger set_booking_form_sessions_updated_at
before update on public.booking_form_sessions
for each row execute function public.update_updated_at_column();

alter table public.booking_form_sessions enable row level security;

create policy "authenticated staff can manage booking form sessions"
on public.booking_form_sessions for all to authenticated
using (true) with check (true);

comment on table public.booking_form_sessions is
  'Secure public booking form sessions. Raw tokens are never persisted.';
