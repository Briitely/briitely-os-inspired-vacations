create table if not exists public.travel_group_negotiations (
 id uuid primary key default gen_random_uuid(),
 travel_file_id uuid not null references public.travel_files(id) on delete cascade,
 recipient_party_member_id uuid not null references public.travel_file_travellers(id) on delete cascade,
 revisions_used integer not null default 0 check (revisions_used >= 0),
 decision text not null default 'negotiating' check (decision in ('negotiating','accepted','declined')),
 deposit_amount numeric(12,2) check (deposit_amount > 0),
 decided_at timestamptz,
 decided_by uuid,
 updated_at timestamptz not null default now(),
 unique(travel_file_id,recipient_party_member_id),
 constraint accepted_requires_deposit check (decision <> 'accepted' or deposit_amount is not null)
);
create index if not exists travel_group_negotiations_file_idx on public.travel_group_negotiations(travel_file_id);
alter table public.travel_group_negotiations enable row level security;
-- Server-only access via role-checked routes.
