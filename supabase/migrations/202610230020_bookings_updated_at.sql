-- Add the timestamp referenced by booking updates and expiry workflows.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

NOTIFY pgrst, 'reload schema';
