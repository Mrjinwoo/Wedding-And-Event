-- Add the manual downpayment workflow for venue bookings.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- A pending request does not reserve a date. An approved request holds it
-- until its payment deadline; a confirmed booking reserves it permanently.
DROP INDEX IF EXISTS public.bookings_venue_date_unique;
CREATE UNIQUE INDEX bookings_venue_date_unique
  ON public.bookings (venue_id, event_date)
  WHERE status IN ('awaiting_payment', 'confirmed');

CREATE INDEX IF NOT EXISTS bookings_payment_deadline_idx
  ON public.bookings (payment_deadline)
  WHERE status = 'awaiting_payment';
