-- =============================================================================
-- Migration 004 — AAL2 RLS policies + security-definer helper functions
-- Batch 2 item #2
--
-- WHAT THIS DOES
-- 1. Creates two SECURITY DEFINER helper functions with search_path = '':
--      is_staff()      — true when caller is admin or staff (any AAL)
--      is_staff_aal2() — true when caller is admin or staff AND session is aal2
--
-- 2. Replaces all existing admin/staff RLS policies on:
--      profiles, bookings, venues, messages, notifications, activity_logs
--    with versions that call is_staff_aal2() so the aal2 check is enforced
--    at the database layer, not only in application code.
--
-- 3. Client policies (users accessing their own rows) are unchanged and do
--    NOT require aal2 — clients never go through TOTP.
--
-- SAFE TO RE-RUN: all statements use DROP … IF EXISTS guards.
-- =============================================================================

-- ── Helper: is_staff() ────────────────────────────────────────────────────────
-- Returns true if the calling user is admin or staff at any assurance level.
-- Used by write policies (INSERT/UPDATE/DELETE) on venues where staff write
-- is allowed once they have a valid session.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
-- Empty search_path prevents search-path injection attacks
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
  )
$$;

-- ── Helper: is_staff_aal2() ───────────────────────────────────────────────────
-- Returns true when:
--   1. The calling user has role admin or staff, AND
--   2. The session's assurance level is exactly 'aal2'
--      (i.e. TOTP challenge was completed this session)
--
-- auth.jwt() ->> 'aal' is set by Supabase Auth when the session is elevated.
-- At aal1 the claim is absent or 'aal1'.
CREATE OR REPLACE FUNCTION public.is_staff_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
$$;

-- ── Helper: is_admin_aal2() ───────────────────────────────────────────────────
-- Admin-only variant for policies that restrict write access further.
CREATE OR REPLACE FUNCTION public.is_admin_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (auth.jwt() ->> 'aal') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
$$;

-- =============================================================================
-- PROFILES
-- =============================================================================
DROP POLICY IF EXISTS "profiles: staff read all"      ON public.profiles;
DROP POLICY IF EXISTS "profiles: staff read all aal2" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles aal2" ON public.profiles;

-- Staff/admin can read all profiles only at aal2
CREATE POLICY "profiles: staff read all aal2"
  ON public.profiles FOR SELECT
  USING (public.is_staff_aal2());

-- Owner select and owner update remain unchanged (no aal2 required for clients)
-- (defined in migration 002)

-- =============================================================================
-- BOOKINGS
-- =============================================================================
DROP POLICY IF EXISTS "bookings: staff select all"    ON public.bookings;
DROP POLICY IF EXISTS "bookings: staff update all"    ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings aal2"   ON public.bookings;
DROP POLICY IF EXISTS "Admins can update bookings aal2"     ON public.bookings;
DROP POLICY IF EXISTS "Admins can delete bookings aal2"     ON public.bookings;

-- Staff/admin: select all bookings at aal2
CREATE POLICY "bookings: staff select all aal2"
  ON public.bookings FOR SELECT
  USING (public.is_staff_aal2());

-- Admin-only: update any booking at aal2
CREATE POLICY "bookings: admin update all aal2"
  ON public.bookings FOR UPDATE
  USING  (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

-- Admin-only: delete bookings at aal2
CREATE POLICY "bookings: admin delete aal2"
  ON public.bookings FOR DELETE
  USING (public.is_admin_aal2());

-- Client policies (select/insert own, cancel own pending) are unchanged
-- (defined in migration 001 / the base schema)

-- =============================================================================
-- VENUES
-- =============================================================================
DROP POLICY IF EXISTS "venues: staff write"   ON public.venues;
DROP POLICY IF EXISTS "venues: staff update"  ON public.venues;
DROP POLICY IF EXISTS "venues: admin delete"  ON public.venues;

-- Staff/admin: insert at aal2
CREATE POLICY "venues: staff write aal2"
  ON public.venues FOR INSERT
  WITH CHECK (public.is_staff_aal2());

-- Staff/admin: update at aal2
CREATE POLICY "venues: staff update aal2"
  ON public.venues FOR UPDATE
  USING  (public.is_staff_aal2())
  WITH CHECK (public.is_staff_aal2());

-- Admin-only: delete at aal2
CREATE POLICY "venues: admin delete aal2"
  ON public.venues FOR DELETE
  USING (public.is_admin_aal2());

-- Public read remains unchanged (no auth required)

-- =============================================================================
-- MESSAGES
-- =============================================================================
DROP POLICY IF EXISTS "messages: staff read all"      ON public.messages;
DROP POLICY IF EXISTS "messages: staff read all aal2" ON public.messages;

-- Staff/admin: read all messages at aal2
CREATE POLICY "messages: staff read all aal2"
  ON public.messages FOR SELECT
  USING (public.is_staff_aal2());

-- Participant select and sender insert unchanged (no aal2 for clients)

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
-- No staff-read-all policy was previously defined for notifications.
-- Add one now, requiring aal2.
DROP POLICY IF EXISTS "notifications: staff read all aal2" ON public.notifications;

CREATE POLICY "notifications: staff read all aal2"
  ON public.notifications FOR SELECT
  USING (public.is_staff_aal2());

-- =============================================================================
-- ACTIVITY_LOGS
-- =============================================================================
DROP POLICY IF EXISTS "activity_logs: admin select"      ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs: admin select aal2" ON public.activity_logs;

-- Admin-only: read all activity logs at aal2
CREATE POLICY "activity_logs: admin select aal2"
  ON public.activity_logs FOR SELECT
  USING (public.is_admin_aal2());

-- =============================================================================
-- AUDIT_LOG
-- =============================================================================
DROP POLICY IF EXISTS "audit_log: admin select"      ON public.audit_log;
DROP POLICY IF EXISTS "audit_log: admin select aal2" ON public.audit_log;

-- Admin-only: read audit log at aal2
CREATE POLICY "audit_log: admin select aal2"
  ON public.audit_log FOR SELECT
  USING (public.is_admin_aal2());
