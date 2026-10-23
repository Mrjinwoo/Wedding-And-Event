-- Ensure the private receipt bucket and owner-scoped policies exist in the
-- deployed Supabase project. This also replaces policies from earlier drafts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-payment-proofs',
  'booking-payment-proofs',
  FALSE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "booking proofs: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner or staff read" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner cleanup" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: booking owner upload" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner or aal2 staff read" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: booking owner cleanup" ON storage.objects;

CREATE POLICY "booking proofs: booking owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'booking-payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id::TEXT = (storage.foldername(name))[2]
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "booking proofs: owner or aal2 staff read"
  ON storage.objects FOR SELECT TO authenticated
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
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id::TEXT = (storage.foldername(name))[2]
        AND b.user_id = auth.uid()
    )
  );
