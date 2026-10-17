-- Linked Travel Files created from a single negotiated Travel File.
-- This is the persistence foundation only. The finalization RPC must be
-- implemented and tested before the UI action can be enabled.
create table if not exists public.travel_file_group_splits (
  id uuid primary key default gen_random_uuid(),
  source_travel_file_id uuid not null references public.travel_files(id) on delete restrict,
  recipient_party_member_id uuid not null references public.travel_file_travellers(id) on delete restrict,
  resulting_travel_file_id uuid not null references public.travel_files(id) on delete restrict,
  decision text not null check (decision = 'accepted'),
  deposit_amount numeric(14,2) not null check (deposit_amount > 0),
  created_at timestamptz not null default now(),
  unique (source_travel_file_id, recipient_party_member_id),
  unique (resulting_travel_file_id)
);
create index if not exists travel_file_group_splits_source_idx
  on public.travel_file_group_splits(source_travel_file_id);
alter table public.travel_file_group_splits enable row level security;
-- No direct client writes: split creation will use a server-side transaction.
comment on table public.travel_file_group_splits is
  'Idempotency and linkage ledger for accepted travel groups split from a negotiated file.';
