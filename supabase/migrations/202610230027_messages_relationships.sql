-- Ensure PostgREST can embed message participants and inquiry context even
-- when an older project already had the columns but lacked their foreign keys.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS venue_id UUID,
  ADD COLUMN IF NOT EXISTS package_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_sender_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_receiver_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_venue_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_venue_id_fkey
      FOREIGN KEY (venue_id) REFERENCES public.venues(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_package_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES public.packages(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
