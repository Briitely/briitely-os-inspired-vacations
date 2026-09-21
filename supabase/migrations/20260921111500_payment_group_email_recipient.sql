ALTER TABLE public.travel_payment_groups
  ADD COLUMN IF NOT EXISTS payment_email_recipient_traveller_id uuid REFERENCES public.travel_file_travellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_payment_groups_email_recipient
  ON public.travel_payment_groups(payment_email_recipient_traveller_id);
