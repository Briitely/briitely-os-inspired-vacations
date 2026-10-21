-- Briitely OS Core reliability: double-submit protection storage.
-- Safe to run more than once.
--
-- Each row records one submit attempt (an Idempotency-Key sent by the dashboard)
-- and the response it produced, so a repeated click returns the same result
-- instead of creating a second invoice, payment or Travel File.
-- Only the server (service role) reads or writes this table.

create table if not exists public.idempotency_records (
  fingerprint text primary key,
  response_value jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.idempotency_records enable row level security;
revoke all on table public.idempotency_records from anon, authenticated;

create index if not exists idempotency_records_expires_at_idx
  on public.idempotency_records (expires_at);
