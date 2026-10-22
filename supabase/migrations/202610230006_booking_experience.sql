-- Some existing Supabase projects were created without the messages table.
-- Create the columns used by the app before adding inquiry/package context.
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  booking_id UUID,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages: participants select" ON public.messages;
DROP POLICY IF EXISTS "messages: sender insert" ON public.messages;
DROP POLICY IF EXISTS "messages: staff read all" ON public.messages;
DROP POLICY IF EXISTS "messages: staff read all aal2" ON public.messages;

CREATE POLICY "messages: participants select"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "messages: sender insert"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "messages: staff read all aal2"
  ON public.messages FOR SELECT
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

CREATE INDEX IF NOT EXISTS messages_sender_created_at_idx ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_receiver_created_at_idx ON public.messages (receiver_id, created_at DESC);

-- Keep this migration runnable when the deposit-workflow migration was not
-- applied yet (for example, when migrations are pasted into the SQL Editor).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_proof_path TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS payment_proof_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_proof_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_proof_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_payment_proof_status_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payment_proof_status_check
      CHECK (payment_proof_status IN ('not_submitted', 'pending', 'rejected', 'verified'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_venue_unavailable_dates(
  p_venue_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(event_date DATE)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.event_date
  FROM public.bookings AS b
  JOIN public.venues AS v ON v.id = b.venue_id AND v.is_active
  WHERE b.venue_id = p_venue_id
    AND p_end_date >= p_start_date
    AND p_end_date <= p_start_date + 430
    AND b.event_date BETWEEN p_start_date AND p_end_date
    AND (
      b.status = 'confirmed'
      OR (b.status = 'awaiting_payment' AND b.payment_deadline > NOW())
    )
  ORDER BY b.event_date;
$$;

REVOKE ALL ON FUNCTION public.get_venue_unavailable_dates(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_unavailable_dates(UUID, DATE, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_venue_admin_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE role = 'admin' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_venue_admin_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_admin_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_message_recipient(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_id UUID;
  receiver_id UUID;
  sender_role TEXT;
  message_content TEXT;
  venue_name TEXT;
  package_name TEXT;
  notice_title TEXT;
  notice_link TEXT;
BEGIN
  SELECT m.sender_id, m.receiver_id, p.role, m.content, v.name, pkg.name
  INTO sender_id, receiver_id, sender_role, message_content, venue_name, package_name
  FROM public.messages AS m
  JOIN public.profiles AS p ON p.id = m.sender_id
  LEFT JOIN public.venues AS v ON v.id = m.venue_id
  LEFT JOIN public.packages AS pkg ON pkg.id = m.package_id
  WHERE m.id = p_message_id AND m.sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or caller is not its sender';
  END IF;

  IF sender_role IN ('admin', 'staff') THEN
    notice_title := CASE WHEN package_name IS NOT NULL THEN 'Venue team replied about ' || package_name
                         WHEN venue_name IS NOT NULL THEN 'Venue team replied about ' || venue_name
                         ELSE 'Venue team replied to your message' END;
    notice_link := '/dashboard/messages';
  ELSE
    notice_title := CASE WHEN message_content LIKE 'Package inquiry:%' THEN 'Package inquiry: ' || COALESCE(package_name, '')
                         WHEN message_content LIKE 'Venue inquiry:%' THEN 'Venue inquiry: ' || COALESCE(venue_name, '')
                         WHEN package_name IS NOT NULL THEN 'New message about ' || package_name
                         WHEN venue_name IS NOT NULL THEN 'New message about ' || venue_name
                         ELSE 'New Message' END;
    notice_link := '/admin/messages?userId=' || sender_id::TEXT;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (receiver_id, notice_title, LEFT(message_content, 80), notice_link);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_message_recipient(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_message_recipient(UUID) TO authenticated;

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
  IF (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2'
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin MFA verification is required';
  END IF;

  SELECT user_id, status, event_type, deposit_amount, payment_proof_status
  INTO booking_user_id, booking_status, booking_event_type, booking_deposit, proof_status
  FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF booking_status = 'confirmed' AND proof_status = 'verified' THEN
    RETURN; -- The payment proof review already notified the customer.
  END IF;

  IF booking_status = 'awaiting_payment' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (booking_user_id, 'Booking approved — downpayment required',
      'Your ' || booking_event_type || ' request was approved. Pay the 30% downpayment of ₱' || TO_CHAR(booking_deposit, 'FM999,999,990.00') || ' within 48 hours to confirm the booking.',
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
  booking_user_id UUID;
  booking_event_type TEXT;
BEGIN
  IF auth.uid() IS NULL OR p_storage_path NOT LIKE auth.uid()::TEXT || '/' || p_booking_id::TEXT || '/%' THEN
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
  RETURNING user_id, event_type INTO booking_user_id, booking_event_type;

  GET DIAGNOSTICS submitted_count = ROW_COUNT;
  IF submitted_count = 0 THEN
    RAISE EXCEPTION 'This booking is not accepting a payment proof';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT id, 'Payment proof submitted', 'A customer submitted a downpayment receipt for ' || booking_event_type || '.', '/admin/bookings'
  FROM public.profiles
  WHERE role = 'admin' AND is_active = true;
END;
$$;

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
  IF (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2'
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin MFA verification is required';
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

REVOKE ALL ON FUNCTION public.submit_booking_payment_proof(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_booking_payment_proof(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_booking_payment_proof(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_booking_payment_proof(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
