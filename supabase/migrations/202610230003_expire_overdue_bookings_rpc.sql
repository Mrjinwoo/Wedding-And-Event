-- Expire payment holds without requiring the application service-role key.
-- Callers can only invoke this fixed operation; RLS remains enabled for all
-- direct table access.
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
      AND payment_deadline < NOW()
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

-- Make the new RPC visible to PostgREST immediately after applying the migration.
NOTIFY pgrst, 'reload schema';
