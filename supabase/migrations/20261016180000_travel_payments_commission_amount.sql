-- Commission is tracked separately from booking value and uses the payment currency.
ALTER TABLE public.travel_payments
ADD COLUMN IF NOT EXISTS commission_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.travel_payments
DROP CONSTRAINT IF EXISTS travel_payments_commission_amount_nonnegative;
ALTER TABLE public.travel_payments
ADD CONSTRAINT travel_payments_commission_amount_nonnegative CHECK (commission_amount >= 0);
