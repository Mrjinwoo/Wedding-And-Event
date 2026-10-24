-- Allow active staff and admins to process routine booking workflow actions.
-- Admin-only deletion and user management remain separately restricted.

CREATE OR REPLACE FUNCTION public.update_booking_status_by_staff(
  p_booking_id UUID,
  p_new_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
  booking_total NUMERIC;
  transition_allowed BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active staff or admin access is required';
  END IF;

  IF p_new_status NOT IN ('awaiting_payment', 'confirmed', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'Invalid booking status';
  END IF;

  SELECT status::TEXT, total_amount
  INTO current_status, booking_total
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  transition_allowed :=
    (current_status = 'pending' AND p_new_status IN ('awaiting_payment', 'cancelled'))
    OR (current_status = 'awaiting_payment' AND p_new_status IN ('confirmed', 'cancelled'))
    OR (current_status = 'confirmed' AND p_new_status IN ('completed', 'cancelled'));

  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'Cannot transition from % to %', current_status, p_new_status;
  END IF;

  UPDATE public.bookings
  SET status = p_new_status,
      deposit_amount = CASE WHEN p_new_status = 'awaiting_payment'
        THEN ROUND(booking_total * 0.30, 2) ELSE deposit_amount END,
      payment_deadline = CASE WHEN p_new_status = 'awaiting_payment'
        THEN NOW() + INTERVAL '48 hours' ELSE payment_deadline END,
      payment_instructions = CASE WHEN p_new_status = 'awaiting_payment'
        THEN 'Call +63 975 940 3511 or use the Contact page to arrange payment. Include your event date and booking details so the venue can verify your downpayment.'
        ELSE payment_instructions END,
      deposit_paid_at = CASE
        WHEN p_new_status = 'awaiting_payment' THEN NULL
        WHEN p_new_status = 'confirmed' THEN NOW()
        ELSE deposit_paid_at
      END,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN current_status;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_status_by_staff(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_status_by_staff(UUID, TEXT) TO authenticated;

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
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active staff or admin access is required';
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

CREATE OR REPLACE FUNCTION public.notify_booking_status(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_user_id UUID;
  booking_status TEXT;
  booking_event_type TEXT;
  booking_deposit NUMERIC;
  proof_status TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active staff or admin access is required';
  END IF;

  SELECT user_id, status, event_type, deposit_amount, payment_proof_status
  INTO booking_user_id, booking_status, booking_event_type, booking_deposit, proof_status
  FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF booking_status = 'confirmed' AND proof_status = 'verified' THEN RETURN; END IF;

  IF booking_status = 'awaiting_payment' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (booking_user_id, 'Booking approved — downpayment required',
      'Your ' || booking_event_type || ' request was approved. Pay the 30% downpayment of ₱' ||
      TO_CHAR(booking_deposit, 'FM999,999,990.00') || ' within 48 hours to confirm the booking.',
      '/dashboard/bookings');
  ELSIF booking_status = 'cancelled' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (booking_user_id, 'Booking request cancelled',
      'Your venue booking request or payment hold was cancelled.', '/dashboard/bookings');
  ELSIF booking_status = 'confirmed' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (booking_user_id, 'Booking confirmed',
      'Your downpayment was verified and your venue booking is confirmed.', '/dashboard/bookings');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_booking_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_booking_status(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
