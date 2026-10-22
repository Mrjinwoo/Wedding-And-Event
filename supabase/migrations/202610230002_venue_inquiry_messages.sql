-- Link message threads to a venue so inquiry context survives admin replies.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_venue_id_idx
  ON public.messages (venue_id)
  WHERE venue_id IS NOT NULL;
