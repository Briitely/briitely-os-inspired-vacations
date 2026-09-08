alter table public.traveller_profiles
  add column if not exists is_dnb boolean not null default false;

create index if not exists traveller_profiles_is_dnb_idx
  on public.traveller_profiles (is_dnb)
  where is_dnb = true;
