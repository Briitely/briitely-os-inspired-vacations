-- Add automated client trip-history rollups.
alter table public.client_travel_profiles
  add column if not exists number_of_trips integer not null default 0,
  add column if not exists lifetime_value numeric(14,2) not null default 0;

alter table public.travel_files
  add column if not exists client_rollup_recorded_at timestamptz;
