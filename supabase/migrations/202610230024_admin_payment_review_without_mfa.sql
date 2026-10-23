-- Allow an authenticated, active admin to review payment receipts without
-- enrolling in MFA. Other admin operations retain their application AAL2 gate.
CREATE OR REPLACE FUNCTION public.review_booking_payment_proof(
  p_booking_id UUID,
  p_approved BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_user_id UUID;
  booking_event_type TEXT;
  reviewed_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active admin access is required';
  END IF;

  UPDATE public.bookings
  SET payment_proof_status = CASE WHEN p_approved THEN 'verified' ELSE 'rejected' END,
      status = CASE WHEN p_approved THEN 'confirmed' ELSE status END,
      deposit_paid_at = CASE WHEN p_approved THEN NOW() ELSE deposit_paid_at END,
      payment_proof_reviewed_at = NOW(),
      payment_proof_reviewed_by = auth.uid(),
      updated_at = NOW()
  WHERE id = p_booking_id
    AND status = 'awaiting_payment'
    AND payment_proof_status = 'pending'
    AND payment_deadline > NOW()
  RETURNING user_id, event_type INTO booking_user_id, booking_event_type;

  GET DIAGNOSTICS reviewed_count = ROW_COUNT;
  IF reviewed_count = 0 THEN
    RAISE EXCEPTION 'No pending payment proof was found for this booking';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    booking_user_id,
    CASE WHEN p_approved THEN 'Downpayment verified — booking confirmed' ELSE 'Payment proof needs attention' END,
    CASE WHEN p_approved
      THEN 'Your downpayment for ' || booking_event_type || ' was verified. Your venue booking is confirmed.'
      ELSE 'The venue team could not verify your payment proof. Please contact the venue or upload a clearer receipt before the deadline.'
    END,
    '/dashboard/bookings'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_booking_payment_proof(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_booking_payment_proof(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
