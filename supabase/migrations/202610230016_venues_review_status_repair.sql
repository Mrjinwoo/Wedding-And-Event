-- Add the review workflow column to existing venues tables as well as new ones.
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venues_review_status_check'
      AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_review_status_check
      CHECK (review_status IN ('pending_review', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS venues_public_listing_idx
  ON public.venues (is_active, review_status, created_at DESC);

NOTIFY pgrst, 'reload schema';
