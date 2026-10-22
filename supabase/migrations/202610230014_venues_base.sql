-- Base venue schema required by the app and the venue review migrations.
-- Safe to run when the table is already present: it will leave existing data intact.
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  review_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venues_public_listing_idx
  ON public.venues (is_active, review_status, created_at DESC);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Public visitors only see venues that have been published.
DROP POLICY IF EXISTS "venues: public read" ON public.venues;
DROP POLICY IF EXISTS "venues: public read approved" ON public.venues;
CREATE POLICY "venues: public read approved"
  ON public.venues FOR SELECT TO anon, authenticated
  USING (is_active = TRUE AND review_status = 'approved');

-- Staff can manage draft listings after completing MFA; only admins can publish.
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

DROP POLICY IF EXISTS "venues: admin delete aal2" ON public.venues;
CREATE POLICY "venues: admin delete aal2"
  ON public.venues FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
