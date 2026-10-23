-- A notification failure must not roll back a valid receipt submission.
CREATE OR REPLACE FUNCTION public.submit_booking_payment_proof(
  p_booking_id UUID,
  p_storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submitted_count INTEGER;
  booking_event_type TEXT;
BEGIN
  IF auth.uid() IS NULL
    OR p_storage_path NOT LIKE auth.uid()::TEXT || '/' || p_booking_id::TEXT || '/%'
  THEN
    RAISE EXCEPTION 'Invalid payment proof owner or path';
  END IF;

  UPDATE public.bookings
  SET payment_proof_path = p_storage_path,
      payment_proof_status = 'pending',
      payment_proof_submitted_at = NOW(),
      payment_proof_reviewed_at = NULL,
      payment_proof_reviewed_by = NULL,
      updated_at = NOW()
  WHERE id = p_booking_id
    AND user_id = auth.uid()
    AND status = 'awaiting_payment'
    AND payment_deadline > NOW()
    AND payment_proof_status IN ('not_submitted', 'rejected')
  RETURNING event_type INTO booking_event_type;

  GET DIAGNOSTICS submitted_count = ROW_COUNT;
  IF submitted_count = 0 THEN
    RAISE EXCEPTION 'This booking is not accepting a payment proof';
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT id,
           'Payment proof submitted',
           'A customer submitted a downpayment receipt for ' || booking_event_type || '.',
           '/admin/bookings'
    FROM public.profiles
    WHERE role = 'admin' AND is_active = TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Payment proof saved, but admin notification failed for booking %: %',
      p_booking_id, SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_booking_payment_proof(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_booking_payment_proof(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
