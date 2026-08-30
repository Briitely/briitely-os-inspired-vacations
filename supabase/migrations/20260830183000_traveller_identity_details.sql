-- Expand permanent traveller profiles with identity, passport, and emergency contact details.
-- These fields belong to the person and can be reused across Travel Files.

alter table public.traveller_profiles
  add column if not exists middle_name text,
  add column if not exists passport_number text,
  add column if not exists passport_country text,
  add column if not exists passport_issue_date date,
  add column if not exists passport_expiry_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_email text;

comment on column public.traveller_profiles.passport_number is
  'Sensitive passport identifier. Staff access only; do not expose in public client-facing responses.';
