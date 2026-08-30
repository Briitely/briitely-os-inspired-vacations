-- Client-level travel profile and relationship foundation.
-- Travel profile data belongs to the Briitely contact, not an individual Travel File.

create table if not exists public.client_travel_profiles (
  id uuid primary key default gen_random_uuid(),
  briitely_contact_id text not null unique,
  travel_interests text[] not null default '{}',
  travel_seasons text[] not null default '{}',
  last_travel_destination text,
  last_travel_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_travel_profiles_contact_idx
  on public.client_travel_profiles (briitely_contact_id);

create table if not exists public.traveller_profiles (
  id uuid primary key default gen_random_uuid(),
  briitely_contact_id text unique,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  date_of_birth date,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_relationships (
  id uuid primary key default gen_random_uuid(),
  primary_contact_id text not null,
  related_traveller_id uuid not null references public.traveller_profiles(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('spouse_partner','child','parent','other_family','household')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (primary_contact_id, related_traveller_id)
);

create index if not exists client_relationships_primary_contact_idx
  on public.client_relationships (primary_contact_id);

create table if not exists public.travel_file_travellers (
  id uuid primary key default gen_random_uuid(),
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  traveller_profile_id uuid not null references public.traveller_profiles(id) on delete cascade,
  traveller_role text not null default 'traveller' check (traveller_role in ('primary','traveller')),
  relationship_to_primary text,
  receive_trip_communications boolean not null default false,
  booking_form_required boolean not null default false,
  booking_form_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (travel_file_id, traveller_profile_id)
);

create index if not exists travel_file_travellers_file_idx
  on public.travel_file_travellers (travel_file_id);

drop trigger if exists set_client_travel_profiles_updated_at on public.client_travel_profiles;
create trigger set_client_travel_profiles_updated_at
before update on public.client_travel_profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists set_traveller_profiles_updated_at on public.traveller_profiles;
create trigger set_traveller_profiles_updated_at
before update on public.traveller_profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists set_client_relationships_updated_at on public.client_relationships;
create trigger set_client_relationships_updated_at
before update on public.client_relationships
for each row execute function public.update_updated_at_column();

drop trigger if exists set_travel_file_travellers_updated_at on public.travel_file_travellers;
create trigger set_travel_file_travellers_updated_at
before update on public.travel_file_travellers
for each row execute function public.update_updated_at_column();

alter table public.client_travel_profiles enable row level security;
alter table public.traveller_profiles enable row level security;
alter table public.client_relationships enable row level security;
alter table public.travel_file_travellers enable row level security;

create policy "authenticated staff can manage client travel profiles"
on public.client_travel_profiles for all to authenticated
using (true) with check (true);

create policy "authenticated staff can manage traveller profiles"
on public.traveller_profiles for all to authenticated
using (true) with check (true);

create policy "authenticated staff can manage client relationships"
on public.client_relationships for all to authenticated
using (true) with check (true);

create policy "authenticated staff can manage travel file travellers"
on public.travel_file_travellers for all to authenticated
using (true) with check (true);

insert into public.client_travel_profiles (
  briitely_contact_id,
  travel_interests,
  travel_seasons
)
select distinct on (tf.briitely_contact_id)
  tf.briitely_contact_id,
  coalesce(tf.travel_interests, '{}'),
  coalesce(tf.travel_seasons, '{}')
from public.travel_files tf
where tf.briitely_contact_id is not null
  and tf.briitely_contact_id <> 'pending'
order by tf.briitely_contact_id, tf.updated_at desc
on conflict (briitely_contact_id) do nothing;
