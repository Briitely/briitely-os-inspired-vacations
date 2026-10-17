-- Split preparation ledger. Preserve source signatures and payment references.
-- This migration does not create Travel Files or alter payment status.
alter table public.travel_file_group_splits
  add column if not exists source_retainer_payment_id uuid references public.travel_payments(id),
  add column if not exists source_retainer_acceptance_id uuid references public.travel_group_retainer_acceptances(id),
  add column if not exists finalized_at timestamptz;
create index if not exists travel_file_group_splits_payment_idx
  on public.travel_file_group_splits(source_retainer_payment_id);
comment on column public.travel_file_group_splits.source_retainer_payment_id is
  'Existing payment ledger ID on the source file; never create a second retainer charge during splitting.';
comment on column public.travel_file_group_splits.source_retainer_acceptance_id is
  'Immutable signed retainer acceptance retained on the source file as evidence.';
