-- Travel information is submitted after the proposal agreement is accepted.
create table if not exists public.proposal_travel_information_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.proposal_deposit_agreement_sessions(id),
  travel_file_id uuid not null references public.travel_files(id),
  preferences text,
  special_requests text,
  loyalty_programs text,
  submitted_at timestamptz not null default now()
);
create index if not exists proposal_travel_info_file_idx on public.proposal_travel_information_submissions(travel_file_id);
alter table public.proposal_travel_information_submissions enable row level security;
-- Public API uses service-role access after validating the hashed session token.
