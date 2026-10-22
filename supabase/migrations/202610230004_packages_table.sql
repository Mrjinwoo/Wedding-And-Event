CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  guest_capacity INTEGER CHECK (guest_capacity IS NULL OR guest_capacity > 0),
  features TEXT[] NOT NULL DEFAULT '{}',
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages: public read active" ON public.packages;
DROP POLICY IF EXISTS "packages: staff insert" ON public.packages;
DROP POLICY IF EXISTS "packages: staff update" ON public.packages;
DROP POLICY IF EXISTS "packages: admin delete" ON public.packages;

CREATE POLICY "packages: public read active"
  ON public.packages FOR SELECT
  USING (is_active OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  ));

CREATE POLICY "packages: staff insert"
  ON public.packages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  ));

CREATE POLICY "packages: staff update"
  ON public.packages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  ));

CREATE POLICY "packages: admin delete"
  ON public.packages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

INSERT INTO public.packages (name, price, guest_capacity, features, is_popular, sort_order)
SELECT seed.name, seed.price, seed.guest_capacity, seed.features, seed.is_popular, seed.sort_order
FROM (VALUES
  ('Silver Package', 35000::NUMERIC, 150, ARRAY['Basic floral centerpieces', 'Standard sound system', '5-hour venue rental', '1 event coordinator', 'Basic lighting setup']::TEXT[], false, 1),
  ('Gold Package', 55000::NUMERIC, 300, ARRAY['Premium floral arrangements', 'Professional sound & lighting', '8-hour venue rental', '2 event coordinators', 'Photo & video coverage', 'Catering for 300 pax']::TEXT[], true, 2),
  ('Platinum Package', 85000::NUMERIC, 500, ARRAY['Luxury floral & decor setup', 'Full AV production team', '12-hour venue rental', 'Dedicated event manager', 'Full photo & video package', 'Catering for 500 pax', 'Bridal suite access', 'Free rehearsal day']::TEXT[], false, 3)
) AS seed(name, price, guest_capacity, features, is_popular, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages existing WHERE existing.name = seed.name
);

GRANT SELECT ON public.packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;

NOTIFY pgrst, 'reload schema';
