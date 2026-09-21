-- Configurable pre-trip client email schedule for each Travel File.
CREATE TABLE IF NOT EXISTS public.travel_pretrip_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,
  email_code text NOT NULL,
  email_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  scheduled_date date,
  timing_note text,
  sequence_order integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (travel_file_id, email_code)
);
CREATE INDEX IF NOT EXISTS idx_travel_pretrip_emails_file ON public.travel_pretrip_emails(travel_file_id);
CREATE INDEX IF NOT EXISTS idx_travel_pretrip_emails_schedule ON public.travel_pretrip_emails(scheduled_date) WHERE enabled = true AND sent_at IS NULL;
DROP TRIGGER IF EXISTS set_travel_pretrip_emails_updated_at ON public.travel_pretrip_emails;
CREATE TRIGGER set_travel_pretrip_emails_updated_at BEFORE UPDATE ON public.travel_pretrip_emails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.travel_pretrip_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active staff can read pretrip email plans" ON public.travel_pretrip_emails;
CREATE POLICY "Active staff can read pretrip email plans" ON public.travel_pretrip_emails FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true));
DROP POLICY IF EXISTS "Active staff can manage pretrip email plans" ON public.travel_pretrip_emails;
CREATE POLICY "Active staff can manage pretrip email plans" ON public.travel_pretrip_emails FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true));
