alter table public.traveller_profiles
  add column if not exists dnb_reason text;

comment on column public.traveller_profiles.dnb_reason is
  'Historical reason a client was marked Do Not Book. Retained even if active DNB status is later removed.';
