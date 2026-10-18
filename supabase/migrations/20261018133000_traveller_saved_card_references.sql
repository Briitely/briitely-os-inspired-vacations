-- Only card network and last four digits are stored. No PAN, CVV or expiry.
create table if not exists public.traveller_saved_card_references (
  id uuid primary key default gen_random_uuid(),
  traveller_profile_id uuid not null references public.traveller_profiles(id) on delete cascade,
  card_brand text not null check (card_brand in ('Visa','Mastercard','American Express','Discover','Other')),
  last_four text not null check (last_four ~ '^[0-9]{4}$'),
  label text,
  source_system text not null default 'ClientBase' check (source_system = 'ClientBase'),
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists traveller_saved_cards_profile_idx on public.traveller_saved_card_references(traveller_profile_id);
create unique index if not exists traveller_saved_cards_one_preferred_idx on public.traveller_saved_card_references(traveller_profile_id) where is_preferred;
alter table public.traveller_saved_card_references enable row level security;
-- No public/authenticated policies: all reads/writes use staff-checked service role.
