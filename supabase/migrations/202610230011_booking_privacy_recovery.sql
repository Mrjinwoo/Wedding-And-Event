-- Restrict receipt objects to the customer who owns the referenced booking.
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings: customers read own" ON public.bookings;
CREATE POLICY "bookings: customers read own"
  ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bookings: customers create own" ON public.bookings;
CREATE POLICY "bookings: customers create own"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "booking proofs: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner or staff read" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner cleanup" ON storage.objects;

CREATE POLICY "booking proofs: booking owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'booking-payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[2]
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "booking proofs: owner or aal2 staff read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'booking-payment-proofs'
    AND (
      (
        (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id::text = (storage.foldername(name))[2]
            AND b.user_id = auth.uid()
        )
      )
      OR (
        (auth.jwt() ->> 'aal') = 'aal2'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
        )
      )
    )
  );

CREATE POLICY "booking proofs: booking owner cleanup"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'booking-payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[2]
        AND b.user_id = auth.uid()
    )
  );

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS last_notification_retry_at timestamptz;

CREATE OR REPLACE FUNCTION public.resend_own_booking_notification(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.bookings%ROWTYPE;
  n_title text;
  n_body text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO b FROM public.bookings
  WHERE id = p_booking_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF b.last_notification_retry_at > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Please wait before resending this update';
  END IF;

  IF b.status = 'awaiting_payment' AND b.payment_proof_status = 'rejected' THEN
    n_title := 'Payment proof needs attention';
    n_body := 'Your receipt could not be verified. Please upload a clearer copy before the payment deadline.';
  ELSIF b.status = 'awaiting_payment' THEN
    n_title := 'Booking approved — downpayment required';
    n_body := 'Your venue request was approved. Review the downpayment instructions and deadline in My Bookings.';
  ELSIF b.status = 'confirmed' THEN
    n_title := 'Booking confirmed';
    n_body := 'Your downpayment was verified and your booking is confirmed.';
  ELSIF b.status = 'expired' THEN
    n_title := 'Booking hold expired';
    n_body := 'The payment deadline passed and the temporary hold expired.';
  ELSIF b.status = 'cancelled' THEN
    n_title := 'Booking request cancelled';
    n_body := 'Your booking request was cancelled.';
  ELSE
    n_title := 'Booking request received';
    n_body := 'Your booking request is waiting for venue review.';
  END IF;

  UPDATE public.bookings SET last_notification_retry_at = now() WHERE id = b.id;
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (auth.uid(), n_title, n_body, '/dashboard/bookings');
END;
$$;

REVOKE ALL ON FUNCTION public.resend_own_booking_notification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resend_own_booking_notification(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
