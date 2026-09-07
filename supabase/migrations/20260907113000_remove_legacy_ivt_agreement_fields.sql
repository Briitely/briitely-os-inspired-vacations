-- Remove legacy IVT / Custom agreement classification fields.
-- The current Retainer flow uses tmf_amount and revisions_included directly.

ALTER TABLE public.travel_files
  DROP COLUMN IF EXISTS ivt_custom,
  DROP COLUMN IF EXISTS tmf_agreement_type;

ALTER TABLE public.travel_consultations
  DROP COLUMN IF EXISTS ivt_custom;
