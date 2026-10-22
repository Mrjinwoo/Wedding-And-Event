INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-payment-proofs',
  'booking-payment-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "booking proofs: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner or staff read" ON storage.objects;
DROP POLICY IF EXISTS "booking proofs: owner cleanup" ON storage.objects;

CREATE POLICY "booking proofs: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'booking-payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "booking proofs: owner or staff read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'booking-payment-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR (
        (auth.jwt() ->> 'aal') = 'aal2'
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'staff')
        )
      )
    )
  );

CREATE POLICY "booking proofs: owner cleanup"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'booking-payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
