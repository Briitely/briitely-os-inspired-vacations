-- Proposal acceptance is independent of retainer acceptance and payment processing.
create table if not exists public.proposal_deposit_agreement_sessions (
 id uuid primary key default gen_random_uuid(),
 travel_file_id uuid not null references public.travel_files(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 completed_at timestamptz,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint proposal_deposit_session_expiry check (expires_at > created_at)
);
create index if not exists proposal_deposit_sessions_file_idx on public.proposal_deposit_agreement_sessions(travel_file_id);
alter table public.proposal_deposit_agreement_sessions enable row level security;
create table if not exists public.proposal_deposit_agreement_acceptances (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null unique references public.proposal_deposit_agreement_sessions(id),
 travel_file_id uuid not null references public.travel_files(id) on delete cascade,
 agreement_version text not null,
 agreement_text text not null,
 deposit_amount numeric(12,2) not null check(deposit_amount > 0),
 proposal_url text,
 accepted_name text not null,
 accepted_at timestamptz not null default now(),
 user_agent text,
 created_at timestamptz not null default now()
);
create index if not exists proposal_deposit_acceptances_file_idx on public.proposal_deposit_agreement_acceptances(travel_file_id,accepted_at desc);
alter table public.proposal_deposit_agreement_acceptances enable row level security;
-- These records are intentionally service-role only; no authenticated/anon policies.
comment on table public.proposal_deposit_agreement_acceptances is 'Immutable snapshots of proposal/deposit agreement acceptance; no payment processing occurs here.';
