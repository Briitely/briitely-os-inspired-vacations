-- Distinguish the initial Retainer + Booking link from later booking-information-only links.
-- Existing sessions become booking-only. New Retainer invitations explicitly opt in.

alter table public.booking_form_sessions
  add column if not exists include_retainer boolean not null default false;

create index if not exists idx_booking_form_sessions_include_retainer
  on public.booking_form_sessions (travel_file_id, include_retainer, created_at desc);
