-- Inspired Vacations: referral attribution on the client record (Briitely OS Core standard).
--
-- How a client first found Inspired Vacations now belongs to the client, not to
-- each travel file. Briitely (GHL) is the source of truth: the contact fields
-- "How did you hear about us?" (contact.lead_source), "Referral Name"
-- (contact.referral_name) and "Which event?" (contact.which_event). This table
-- is the dashboard's local copy, used if Briitely can't be reached.
--
-- Same table as Core's referral_attribution, plus event_name. Inspired
-- Vacations doesn't link referrers to client records, so the contact-id and
-- revenue-referrer columns stay empty.

create table if not exists public.referral_attribution (
  contact_id text primary key,
  contact_name text not null default '',
  acquisition_source text not null default '',
  direct_referrer_contact_id text,
  direct_referrer_name text not null default '',
  revenue_referrer_contact_id text,
  revenue_referrer_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.referral_attribution add column if not exists event_name text not null default '';

create index if not exists referral_attribution_source_idx
  on public.referral_attribution (acquisition_source);

alter table public.referral_attribution enable row level security;

-- Signed-in staff may read it; writes go through server routes only.
drop policy if exists "authenticated users can read referral attribution" on public.referral_attribution;
create policy "authenticated users can read referral attribution"
  on public.referral_attribution
  for select
  to authenticated
  using (true);
