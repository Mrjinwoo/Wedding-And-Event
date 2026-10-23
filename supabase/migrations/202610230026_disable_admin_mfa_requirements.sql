-- Make admin/staff authorization role-based instead of requiring an AAL2 MFA session.
-- The existing admin/staff role checks remain in place.

-- Ensure the notification relation exists because admin actions and messages
-- create notifications as part of their normal workflow.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff_aal2()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff') AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_aal2()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
$$;

DROP POLICY IF EXISTS "notifications: owner select" ON public.notifications;
CREATE POLICY "notifications: owner select" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications: owner update" ON public.notifications;
CREATE POLICY "notifications: owner update" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- Packages
DROP POLICY IF EXISTS "packages: admin insert aal2" ON public.packages;
DROP POLICY IF EXISTS "packages: admin update aal2" ON public.packages;
DROP POLICY IF EXISTS "packages: admin delete aal2" ON public.packages;
CREATE POLICY "packages: admin insert aal2" ON public.packages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_aal2());
CREATE POLICY "packages: admin update aal2" ON public.packages FOR UPDATE TO authenticated
  USING (public.is_admin_aal2()) WITH CHECK (public.is_admin_aal2());
CREATE POLICY "packages: admin delete aal2" ON public.packages FOR DELETE TO authenticated
  USING (public.is_admin_aal2());

-- Venue review and management
CREATE OR REPLACE FUNCTION public.guard_venue_review_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid() AND is_active = TRUE;

  IF caller_role = 'admin' THEN RETURN NEW; END IF;
  IF caller_role = 'staff' THEN
    NEW.review_status := 'pending_review';
    NEW.is_active := FALSE;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Active staff or admin access is required to manage venues';
END;
$$;

DROP POLICY IF EXISTS "venues: staff read all aal2" ON public.venues;
CREATE POLICY "venues: staff read all aal2" ON public.venues FOR SELECT TO authenticated
  USING (public.is_staff_aal2());
DROP POLICY IF EXISTS "venues: staff write aal2" ON public.venues;
CREATE POLICY "venues: staff write aal2" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_aal2());
DROP POLICY IF EXISTS "venues: staff update aal2" ON public.venues;
CREATE POLICY "venues: staff update aal2" ON public.venues FOR UPDATE TO authenticated
  USING (public.is_staff_aal2()) WITH CHECK (public.is_staff_aal2());
DROP POLICY IF EXISTS "venues: admin delete aal2" ON public.venues;
CREATE POLICY "venues: admin delete aal2" ON public.venues FOR DELETE TO authenticated
  USING (public.is_admin_aal2());

-- Messages and notifications
DROP POLICY IF EXISTS "messages: staff read all aal2" ON public.messages;
CREATE POLICY "messages: staff read all aal2" ON public.messages FOR SELECT TO authenticated
  USING (public.is_staff_aal2());
DROP POLICY IF EXISTS "notifications: staff read all aal2" ON public.notifications;
CREATE POLICY "notifications: staff read all aal2" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_staff_aal2());

-- Public gallery management and its storage bucket
DROP POLICY IF EXISTS "gallery: staff read all aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff read all aal2" ON public.gallery_images FOR SELECT TO authenticated
  USING (public.is_staff_aal2());
DROP POLICY IF EXISTS "gallery: staff insert aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff insert aal2" ON public.gallery_images FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_staff_aal2());
DROP POLICY IF EXISTS "gallery: staff update aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff update aal2" ON public.gallery_images FOR UPDATE TO authenticated
  USING (public.is_staff_aal2()) WITH CHECK (public.is_staff_aal2());
DROP POLICY IF EXISTS "gallery: staff delete aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff delete aal2" ON public.gallery_images FOR DELETE TO authenticated
  USING (public.is_staff_aal2());

DROP POLICY IF EXISTS "gallery storage: staff upload aal2" ON storage.objects;
CREATE POLICY "gallery storage: staff upload aal2" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.is_staff_aal2());
DROP POLICY IF EXISTS "gallery storage: staff update aal2" ON storage.objects;
CREATE POLICY "gallery storage: staff update aal2" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_staff_aal2())
  WITH CHECK (bucket_id = 'gallery' AND public.is_staff_aal2());
DROP POLICY IF EXISTS "gallery storage: staff delete aal2" ON storage.objects;
CREATE POLICY "gallery storage: staff delete aal2" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_staff_aal2());

-- Staff can view payment receipts without MFA; customers remain owner-scoped.
DROP POLICY IF EXISTS "booking proofs: owner or aal2 staff read" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner or staff read" ON storage.objects;
CREATE POLICY "booking proofs: owner or staff read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'booking-payment-proofs'
    AND (
      (
        (storage.foldername(name))[1] = auth.uid()::TEXT
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id::TEXT = (storage.foldername(name))[2]
            AND b.user_id = auth.uid()
        )
      )
      OR public.is_staff_aal2()
    )
  );

-- Keep the existing notification behavior for booking status changes, without an AAL2 gate.
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
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active admin access is required';
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

NOTIFY pgrst, 'reload schema';
