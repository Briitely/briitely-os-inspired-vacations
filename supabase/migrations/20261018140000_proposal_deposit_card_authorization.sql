alter table public.proposal_deposit_agreement_acceptances add column if not exists payment_choice text;
alter table public.proposal_deposit_agreement_acceptances add column if not exists saved_card_reference_id uuid;
alter table public.proposal_deposit_agreement_acceptances add column if not exists saved_card_brand text;
alter table public.proposal_deposit_agreement_acceptances add column if not exists saved_card_last_four text;
