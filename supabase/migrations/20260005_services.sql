-- =============================================================================
-- Migration 005 — Services table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        TEXT        NOT NULL DEFAULT '🎉',
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services: public read"  ON public.services;
DROP POLICY IF EXISTS "services: admin write"  ON public.services;
DROP POLICY IF EXISTS "services: admin update" ON public.services;
DROP POLICY IF EXISTS "services: admin delete" ON public.services;

CREATE POLICY "services: public read"
  ON public.services FOR SELECT USING (true);

CREATE POLICY "services: admin write"
  ON public.services FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff')));

CREATE POLICY "services: admin update"
  ON public.services FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff')));

CREATE POLICY "services: admin delete"
  ON public.services FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed default services
INSERT INTO public.services (icon, title, description, sort_order) VALUES
  ('💍', 'Weddings',            'From intimate ceremonies to grand celebrations, we craft bespoke wedding experiences tailored to your love story.', 1),
  ('🎂', 'Birthdays & Debuts',  'Celebrate life''s milestones in style. We handle everything from venue décor to catering for your special day.', 2),
  ('🏢', 'Corporate Events',    'Professional event management for conferences, product launches, seminars, and company celebrations.', 3),
  ('🎓', 'Graduation Parties',  'Honor your achievements with a memorable gathering. We provide the perfect backdrop for your next chapter.', 4),
  ('🥂', 'Receptions & Galas',  'Elegant settings for cocktail receptions, charity galas, and formal dinners with impeccable service.', 5),
  ('🌸', 'Floral & Décor',      'Our in-house design team creates stunning floral arrangements and themed décor that bring your vision to life.', 6),
  ('📸', 'Photo & Video',       'Capture every precious moment with our partner photographers and videographers skilled in event coverage.', 7),
  ('🍽️', 'Catering',           'Delight your guests with curated menus from our partner caterers — from Filipino classics to international cuisine.', 8)
ON CONFLICT DO NOTHING;
