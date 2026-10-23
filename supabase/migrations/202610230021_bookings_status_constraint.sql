-- Align the bookings status constraint with the workflow used by the app.
-- Keep any legacy statuses already present so existing rows remain valid.
DO $$
DECLARE
  allowed_statuses TEXT;
BEGIN
  SELECT string_agg(quote_literal(status), ', ')
  INTO allowed_statuses
  FROM (
    SELECT DISTINCT status::TEXT AS status
    FROM public.bookings
    WHERE status IS NOT NULL

    UNION

    SELECT unnest(ARRAY[
      'pending',
      'awaiting_payment',
      'confirmed',
      'cancelled',
      'expired',
      'completed'
    ])
  ) AS statuses;

  ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_status_check;

  EXECUTE format(
    'ALTER TABLE public.bookings
       ADD CONSTRAINT bookings_status_check
       CHECK (status::TEXT IN (%s)) NOT VALID',
    allowed_statuses
  );
END
$$;

NOTIFY pgrst, 'reload schema';
