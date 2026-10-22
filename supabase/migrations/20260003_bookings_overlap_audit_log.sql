-- =============================================================================
-- Migration 003 — Double-booking constraint, total_amount fix, audit_log
-- Audit items #2, #9, #10
--
-- Point 3 compliance:
-- • Bookings in this app are stored with event_date (DATE) only — no time
--   range columns yet.  The constraint is therefore a UNIQUE index on
--   (venue_id, event_date) filtered to pending/confirmed rows.  This is
--   simpler, honest about what is actually stored, and avoids a complex
--   tsrange exclusion that would silently pass because start_time/end_time
--   are NULL for all existing rows.
-- • If/when start_time + end_time are added to the booking form, replace the
--   UNIQUE index with the btree_gist exclusion constraint in the comment below.
-- • The route catches PostgreSQL error code 23505 (unique_violation) which is
--   what this constraint raises, and returns 409 Conflict.
-- • audit_log insert policy is removed (Point 1): written via service role only.
-- =============================================================================

-- ── Item #9: rename total_price → total_amount (no-op if already correct) ────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'total_price'
  ) THEN
    ALTER TABLE public.bookings RENAME COLUMN total_price TO total_amount;
  END IF;
END;
$$;

-- ── Item #2: date-only overlap constraint ─────────────────────────────────────
-- Prevents two pending/confirmed bookings for the same venue on the same date.
-- Uses a partial unique index (lighter than a full constraint, same semantics).

DROP INDEX IF EXISTS bookings_venue_date_unique;

CREATE UNIQUE INDEX bookings_venue_date_unique
  ON public.bookings (venue_id, event_date)
  WHERE status IN ('pending', 'confirmed');

-- ── If you later add time ranges, replace the index above with this: ──────────
-- (requires: CREATE EXTENSION IF NOT EXISTS btree_gist)
--
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time TIME;
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time   TIME;
--
-- DROP INDEX IF EXISTS bookings_venue_date_unique;
--
-- ALTER TABLE bookings
--   ADD CONSTRAINT bookings_no_time_overlap
--   EXCLUDE USING gist (
--     venue_id WITH =,
--     tsrange(
--       event_date::timestamp + COALESCE(start_time, '00:00'::time),
--       event_date::timestamp + COALESCE(end_time,   '23:59'::time),
--       '[)'
--     ) WITH &&
--   )
--   WHERE (status IN ('pending', 'confirmed'));

-- ── Item #10: audit_log table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  target_table  TEXT,
  target_id     UUID,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_performed_by_idx ON public.audit_log (performed_by);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx   ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx       ON public.audit_log (target_table, target_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop any old permissive insert policy from the previous draft
DROP POLICY IF EXISTS "audit_log: system insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log: admin select"  ON public.audit_log;

-- Only admins can read the audit log
CREATE POLICY "audit_log: admin select"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Point 1: NO INSERT policy — service role bypasses RLS.
-- Authenticated users cannot insert into audit_log at all.
-- NO UPDATE or DELETE policies — audit log is immutable.
