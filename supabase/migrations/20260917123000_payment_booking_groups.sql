-- Group Travel File payments by independent booking / payment party.

CREATE TABLE IF NOT EXISTS public.travel_payment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,
  booking_number text,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.travel_payment_group_travellers (
  payment_group_id uuid NOT NULL REFERENCES public.travel_payment_groups(id) ON DELETE CASCADE,
  travel_file_traveller_id uuid NOT NULL REFERENCES public.travel_file_travellers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_group_id, travel_file_traveller_id)
);

ALTER TABLE public.travel_payments
  ADD COLUMN IF NOT EXISTS payment_group_id uuid REFERENCES public.travel_payment_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_travel_payment_groups_file
  ON public.travel_payment_groups(travel_file_id);
CREATE INDEX IF NOT EXISTS idx_travel_payment_group_travellers_traveller
  ON public.travel_payment_group_travellers(travel_file_traveller_id);
CREATE INDEX IF NOT EXISTS idx_travel_payments_group
  ON public.travel_payments(payment_group_id);

DROP TRIGGER IF EXISTS set_travel_payment_groups_updated_at ON public.travel_payment_groups;
CREATE TRIGGER set_travel_payment_groups_updated_at
  BEFORE UPDATE ON public.travel_payment_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.travel_payment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_payment_group_travellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active staff can read travel payment groups" ON public.travel_payment_groups;
CREATE POLICY "Active staff can read travel payment groups"
  ON public.travel_payment_groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));
DROP POLICY IF EXISTS "Active staff can manage travel payment groups" ON public.travel_payment_groups;
CREATE POLICY "Active staff can manage travel payment groups"
  ON public.travel_payment_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));

DROP POLICY IF EXISTS "Active staff can read payment group travellers" ON public.travel_payment_group_travellers;
CREATE POLICY "Active staff can read payment group travellers"
  ON public.travel_payment_group_travellers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));
DROP POLICY IF EXISTS "Active staff can manage payment group travellers" ON public.travel_payment_group_travellers;
CREATE POLICY "Active staff can manage payment group travellers"
  ON public.travel_payment_group_travellers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true));
