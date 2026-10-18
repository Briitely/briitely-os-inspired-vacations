-- Client-specific travel preferences. Never store these on the travel file.
create table if not exists public.traveller_travel_preferences (
  traveller_profile_id uuid primary key references public.traveller_profiles(id) on delete cascade,
  preferred_suppliers text not null default '',
  loyalty_programs text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.traveller_travel_preferences enable row level security;
-- Restricted to service-role API until staff authorization and editing UI are wired.
alter table public.proposal_travel_information_submissions
  add column if not exists primary_traveller_profile_id uuid references public.traveller_profiles(id);
comment on column public.proposal_travel_information_submissions.primary_traveller_profile_id is
  'The primary traveller whose profile owns the preferences captured by this submission.';
