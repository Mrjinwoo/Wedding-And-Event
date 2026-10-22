-- Public event gallery and staff-managed image storage.
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  category TEXT NOT NULL CHECK (category IN ('wedding', 'reception', 'birthday', 'corporate', 'venue')),
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 300),
  image_url TEXT NOT NULL,
  storage_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gallery_images_public_order_idx
  ON public.gallery_images (is_active, sort_order, created_at DESC);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gallery: public read active" ON public.gallery_images;
CREATE POLICY "gallery: public read active"
  ON public.gallery_images FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "gallery: staff read all aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff read all aal2"
  ON public.gallery_images FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "gallery: staff insert aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff insert aal2"
  ON public.gallery_images FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "gallery: staff update aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff update aal2"
  ON public.gallery_images FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "gallery: staff delete aal2" ON public.gallery_images;
CREATE POLICY "gallery: staff delete aal2"
  ON public.gallery_images FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

GRANT SELECT ON public.gallery_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gallery_images TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gallery', 'gallery', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "gallery storage: staff upload aal2" ON storage.objects;
CREATE POLICY "gallery storage: staff upload aal2"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "gallery storage: staff update aal2" ON storage.objects;
CREATE POLICY "gallery storage: staff update aal2"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    bucket_id = 'gallery'
    AND (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "gallery storage: staff delete aal2" ON storage.objects;
CREATE POLICY "gallery storage: staff delete aal2"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Keep the existing six gallery images when installing the managed gallery.
INSERT INTO public.gallery_images (title, category, caption, image_url, sort_order)
SELECT seed.title, seed.category, seed.caption, seed.image_url, seed.sort_order
FROM (VALUES
  ('Wedding Ceremony', 'wedding', 'A beautiful setting for a once-in-a-lifetime celebration.', '/wed.jpg', 1),
  ('Seaside Event Setup', 'reception', 'An elegant reception setup by the sea.', '/back.jpg', 2),
  ('Birthday Celebration', 'birthday', 'A joyful space for celebrating together.', '/birth.jpg', 3),
  ('Garden of Love', 'venue', 'A garden setting for special occasions.', '/day.jpg', 4),
  ('Royal Banquet Hall', 'reception', 'A refined hall prepared for a memorable event.', '/weeding venue.jpg', 5),
  ('The Grand', 'wedding', 'A grand backdrop for your celebration.', '/wedd.jpg', 6)
) AS seed(title, category, caption, image_url, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.gallery_images AS existing WHERE existing.image_url = seed.image_url
);

NOTIFY pgrst, 'reload schema';
