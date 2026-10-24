-- Expose only the public event total. Booking rows remain protected by RLS.
CREATE OR REPLACE FUNCTION public.get_public_events_hosted_count()
RETURNS BIGINT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)
  FROM public.bookings
  WHERE status IN ('confirmed', 'completed');
$$;

REVOKE ALL ON FUNCTION public.get_public_events_hosted_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_events_hosted_count() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
