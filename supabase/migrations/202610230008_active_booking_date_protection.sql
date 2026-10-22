-- A customer request in `pending` does not reserve a date. A venue approval
-- creates a 48-hour hold (`awaiting_payment`); a verified booking remains
-- reserved (`confirmed`). This database index is the concurrency-safe guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE status IN ('awaiting_payment', 'confirmed')
    GROUP BY venue_id, event_date
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enable active booking date protection: resolve duplicate awaiting_payment or confirmed bookings for the same venue and date first.';
  END IF;
END
$$;

DROP INDEX IF EXISTS public.bookings_venue_date_unique;
CREATE UNIQUE INDEX bookings_venue_date_unique
  ON public.bookings (venue_id, event_date)
  WHERE status IN ('awaiting_payment', 'confirmed');

CREATE INDEX IF NOT EXISTS bookings_payment_deadline_idx
  ON public.bookings (payment_deadline)
  WHERE status = 'awaiting_payment';

-- Match the availability check's strict `deadline > now()` rule at the
-- boundary so a hold ending at this instant is released immediately.
CREATE OR REPLACE FUNCTION public.expire_overdue_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.bookings
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'awaiting_payment'
      AND payment_deadline <= NOW()
    RETURNING user_id
  )
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT
    user_id,
    'Booking hold expired',
    'The downpayment deadline passed, so the date is no longer being held. Contact the venue if you still want to book.',
    '/dashboard/bookings'
  FROM expired;

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_bookings() TO authenticated;

NOTIFY pgrst, 'reload schema';
