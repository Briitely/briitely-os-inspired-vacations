alter table public.traveller_profiles add column if not exists special_considerations text;
comment on column public.traveller_profiles.special_considerations is 'Permanent traveller dietary preferences, mobility restrictions, allergies and other considerations. Staff-only.';
