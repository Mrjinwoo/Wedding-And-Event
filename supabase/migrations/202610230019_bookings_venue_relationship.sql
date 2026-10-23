-- Add the foreign-key relationship used by the customer and admin booking
-- queries to embed venue details. NOT VALID preserves existing rows while
-- enforcing the relationship for new or changed booking rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_venue_id_fkey'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_venue_id_fkey
      FOREIGN KEY (venue_id)
      REFERENCES public.venues(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
