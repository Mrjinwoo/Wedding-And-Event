-- Package edits are handled by the admin panel and require an admin session
-- with completed MFA. Keep public reads of active packages unchanged.
DROP POLICY IF EXISTS "packages: public read active" ON public.packages;
DROP POLICY IF EXISTS "packages: staff insert" ON public.packages;
DROP POLICY IF EXISTS "packages: staff update" ON public.packages;
DROP POLICY IF EXISTS "packages: admin delete" ON public.packages;
DROP POLICY IF EXISTS "packages: admin insert aal2" ON public.packages;
DROP POLICY IF EXISTS "packages: admin update aal2" ON public.packages;
DROP POLICY IF EXISTS "packages: admin delete aal2" ON public.packages;

CREATE POLICY "packages: public read active"
  ON public.packages FOR SELECT TO anon, authenticated
  USING (
    is_active
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
    OR EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.package_id = packages.id AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "packages: admin insert aal2"
  ON public.packages FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "packages: admin update aal2"
  ON public.packages FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "packages: admin delete aal2"
  ON public.packages FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
