-- Retainer amounts belong to booking-form recipient groups, not payment groups.
-- The primary group's recipient is the primary travel_file_travellers row.
create table if not exists public.travel_group_retainers (
  id uuid primary key default gen_random_uuid(),
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  recipient_party_member_id uuid not null references public.travel_file_travellers(id) on delete cascade,
  retainer_amount numeric(12,2) not null check (retainer_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (travel_file_id, recipient_party_member_id)
);
create index if not exists travel_group_retainers_file_idx on public.travel_group_retainers(travel_file_id);
alter table public.travel_group_retainers enable row level security;
-- Access only via the authenticated staff API, using existing Supabase policies/service privileges.
comment on table public.travel_group_retainers is 'Per-recipient retainer amount for Travel Party booking form groups; does not represent payment or agreement acceptance.';
