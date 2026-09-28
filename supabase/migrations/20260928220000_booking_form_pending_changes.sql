alter table public.booking_form_sessions
  add column if not exists pending_changed_fields jsonb not null default '[]'::jsonb;

comment on column public.booking_form_sessions.pending_changed_fields is
  'Unsumbitted booking-form changes captured by section saves so final submission can preserve before/after review history.';
