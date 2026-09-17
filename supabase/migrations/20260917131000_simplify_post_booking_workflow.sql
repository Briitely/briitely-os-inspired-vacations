-- Simplify the post-booking workflow while preserving existing stage values
-- for historical Travel Files. New workflow uses:
-- proposal_accepted -> booking_confirmed -> trip_plans_created -> travelling
-- -> post_trip -> travel_complete.

ALTER TYPE public.travel_stage ADD VALUE IF NOT EXISTS 'post_trip' AFTER 'travelling';
