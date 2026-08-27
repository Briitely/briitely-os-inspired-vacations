/*
# Add TMF Agreement Type and Revisions Included to Travel Files

1. Purpose
   Adds two new operational columns to `travel_files` to support the
   Initial Consultation completion flow:
   - `tmf_agreement_type` — stores the agreement category selected
     during consultation (ivt or all_inclusive). This is a clean
     operational field, not derived from marketing interests.
   - `revisions_included` — stores the number of revisions included
     with an IVT agreement. Null for All-Inclusive agreements.

2. New Columns
   - `travel_files.tmf_agreement_type` text (nullable) — values: 'ivt' | 'all_inclusive' | null
   - `travel_files.revisions_included` integer (nullable) — integer >= 0 for IVT, null for All-Inclusive

3. Reuses Existing Fields
   - `travel_files.tmf_amount` — already exists, used for TMF Amount
   - `travel_files.assigned_advisor_id` — already exists, used for Assigned Advisor
   - `travel_files.revisions_allowed` — already exists; `revisions_included` is a
     separate additive field capturing the count agreed at consultation time.

4. Security
   - No new tables. No policy changes. Existing RLS on `travel_files` covers the new columns.

5. Idempotent
   - Uses DO $$ ... IF NOT EXISTS ... END $$ blocks for conditional column additions.
   - Safe to re-run.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'travel_files' AND column_name = 'tmf_agreement_type'
  ) THEN
    ALTER TABLE public.travel_files ADD COLUMN tmf_agreement_type text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'travel_files' AND column_name = 'revisions_included'
  ) THEN
    ALTER TABLE public.travel_files ADD COLUMN revisions_included integer;
  END IF;
END $$;
