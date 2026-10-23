-- Reconcile the existing venue schema and add event categories for public filters.
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_review_status_check'
      AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_review_status_check
      CHECK (review_status IN ('pending_review', 'approved', 'rejected'));
  END IF;
END
$$;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_category_check'
      AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_category_check
      CHECK (category IN ('wedding', 'reception', 'birthday', 'corporate', 'other'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS venues_category_listing_idx
  ON public.venues (category, is_active, review_status);

NOTIFY pgrst, 'reload schema';
