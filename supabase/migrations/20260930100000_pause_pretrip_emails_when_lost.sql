alter table public.travel_pretrip_emails
  add column if not exists disabled_by_lost boolean not null default false;
