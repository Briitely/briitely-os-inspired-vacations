-- Group-level signed agreement records are separate from payment records.
-- This table does not change existing legacy retainer_acceptances or booking form sessions.
create table if not exists public.travel_group_retainer_acceptances (
  id uuid primary key default gen_random_uuid(),
  travel_file_id uuid not null references public.travel_files(id) on delete cascade,
  recipient_party_member_id uuid not null references public.travel_file_travellers(id),
  booking_form_session_id uuid not null unique references public.booking_form_sessions(id),
  agreement_version text not null,
  agreement_text text not null,
  retainer_amount numeric(12,2) not null check (retainer_amount >= 0),
  revisions_included integer,
  accepted_name text not null,
  accepted_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (travel_file_id, recipient_party_member_id, booking_form_session_id)
);
create index if not exists travel_group_retainer_acceptances_group_idx on public.travel_group_retainer_acceptances(travel_file_id,recipient_party_member_id);
alter table public.travel_group_retainer_acceptances enable row level security;
comment on table public.travel_group_retainer_acceptances is 'Immutable snapshots of group-specific retainer agreement acceptance; payment is tracked separately.';
