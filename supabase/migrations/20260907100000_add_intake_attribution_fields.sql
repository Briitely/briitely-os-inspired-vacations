-- Add intake attribution fields used by the internal New Inquiry flow.
-- These are intentionally nullable because existing clients should not have
-- their original acquisition source overwritten on later trip inquiries.

ALTER TABLE public.travel_files
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_detail text,
  ADD COLUMN IF NOT EXISTS event_detail text,
  ADD COLUMN IF NOT EXISTS special_considerations text;

COMMENT ON COLUMN public.travel_files.referral_source IS
  'Original acquisition/referral source captured for a new client inquiry.';
COMMENT ON COLUMN public.travel_files.referral_detail IS
  'Named person or relationship detail for Referral, BNI, Breakfast Club, Existing Client, or Rotary sources.';
COMMENT ON COLUMN public.travel_files.event_detail IS
  'Event name when referral_source is Event.';
COMMENT ON COLUMN public.travel_files.special_considerations IS
  'Inquiry-stage special considerations captured before consultation.';
