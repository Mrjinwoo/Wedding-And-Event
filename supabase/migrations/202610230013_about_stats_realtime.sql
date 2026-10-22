-- Enable live invalidation events for public About page catalog statistics.
-- Apply after the venues, packages, and services tables have been created.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'supabase_realtime publication is unavailable; About stats will use polling.';
    RETURN;
  END IF;

  FOREACH table_name IN ARRAY ARRAY['venues', 'packages', 'services'] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = table_name
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END
$$;
