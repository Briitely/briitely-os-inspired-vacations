alter table public.traveller_profiles add column if not exists is_deceased boolean not null default false;
alter table public.traveller_profiles add column if not exists deceased_at date;
comment on column public.traveller_profiles.is_deceased is 'Client or traveller is deceased. Preserved across relationships and travel history.';
