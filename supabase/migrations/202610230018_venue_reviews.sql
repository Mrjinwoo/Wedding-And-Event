CREATE TABLE IF NOT EXISTS public.venue_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 3 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, user_id)
);

CREATE INDEX IF NOT EXISTS venue_reviews_listing_idx
  ON public.venue_reviews (venue_id, created_at DESC);

ALTER TABLE public.venue_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue reviews public read" ON public.venue_reviews;
CREATE POLICY "venue reviews public read"
  ON public.venue_reviews FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = venue_id AND v.is_active = TRUE AND v.review_status = 'approved'
  ));

DROP POLICY IF EXISTS "venue reviews eligible customer insert" ON public.venue_reviews;
CREATE POLICY "venue reviews eligible customer insert"
  ON public.venue_reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.profiles p ON p.id = b.user_id
      WHERE b.venue_id = venue_reviews.venue_id
        AND b.user_id = auth.uid()
        AND b.status = 'confirmed'
        AND b.event_date < CURRENT_DATE
        AND p.role = 'client'
    )
  );

DROP POLICY IF EXISTS "venue reviews author update" ON public.venue_reviews;
CREATE POLICY "venue reviews author update"
  ON public.venue_reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "venue reviews author delete" ON public.venue_reviews;
CREATE POLICY "venue reviews author delete"
  ON public.venue_reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
