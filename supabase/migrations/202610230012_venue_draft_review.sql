-- Staff-created or staff-edited venues remain private until an admin reviews them.
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_review_status_check'
      AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_review_status_check
      CHECK (review_status IN ('pending_review', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_venue_review_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Trusted server operations can manage venues without an end-user JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role = 'admin' AND (auth.jwt() ->> 'aal') = 'aal2' THEN
    RETURN NEW;
  END IF;

  IF caller_role = 'staff' AND (auth.jwt() ->> 'aal') = 'aal2' THEN
    -- Staff may prepare and revise listings, but cannot publish them.
    NEW.review_status := 'pending_review';
    NEW.is_active := FALSE;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'A verified staff or admin session is required to manage venues';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_venue_review_status ON public.venues;
CREATE TRIGGER trg_guard_venue_review_status
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.guard_venue_review_status();

-- Customers and guests can read published, active venues only.
DROP POLICY IF EXISTS "venues: public read" ON public.venues;
DROP POLICY IF EXISTS "venues: public read approved" ON public.venues;
CREATE POLICY "venues: public read approved"
  ON public.venues FOR SELECT TO anon, authenticated
  USING (is_active = TRUE AND review_status = 'approved');

-- AAL2 staff can see drafts and rejected listings in the management screen.
DROP POLICY IF EXISTS "venues: staff read all aal2" ON public.venues;
CREATE POLICY "venues: staff read all aal2"
  ON public.venues FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Replace older write policies so the review guard is enforced consistently.
DROP POLICY IF EXISTS "venues: staff write" ON public.venues;
DROP POLICY IF EXISTS "venues: staff write aal2" ON public.venues;
CREATE POLICY "venues: staff write aal2"
  ON public.venues FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "venues: staff update" ON public.venues;
DROP POLICY IF EXISTS "venues: staff update aal2" ON public.venues;
CREATE POLICY "venues: staff update aal2"
  ON public.venues FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Never expose availability for a venue until it has been approved and published.
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
  JOIN public.venues AS v
    ON v.id = b.venue_id
   AND v.is_active = TRUE
   AND v.review_status = 'approved'
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

NOTIFY pgrst, 'reload schema';
