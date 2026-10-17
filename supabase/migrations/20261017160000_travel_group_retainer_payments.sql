-- One payment ledger entry per Travel Group retainer; preserves legacy payment groups.
create table if not exists public.travel_group_retainer_payments (
  id uuid primary key default gen_random_uuid(),
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  recipient_party_member_id uuid not null references public.travel_file_travellers(id) on delete cascade,
  payment_id uuid not null unique references public.travel_payments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (travel_file_id, recipient_party_member_id)
);
create index if not exists travel_group_retainer_payments_file_idx on public.travel_group_retainer_payments(travel_file_id);
alter table public.travel_group_retainer_payments enable row level security;
-- Access only through authenticated, role-checked server routes using service credentials.
