CREATE TABLE IF NOT EXISTS public.travel_payment_email_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,
  payment_group_id uuid NOT NULL REFERENCES public.travel_payment_groups(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  template_code text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payment_group_id,due_date)
);
CREATE INDEX IF NOT EXISTS idx_payment_email_reminders_due ON public.travel_payment_email_reminders(travel_file_id,due_date);
