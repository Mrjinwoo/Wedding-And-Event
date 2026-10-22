-- =============================================================================
-- Migration 001 — RLS on venues, messages, notifications, activity_logs
-- Audit item #1
-- Revision: removed client-insert policies on notifications and activity_logs.
--           These tables are written only from server code using the service
--           role key (which bypasses RLS entirely).  Authenticated-user INSERT
--           policies would allow any logged-in user to forge entries.
--
-- Safe to re-run: all statements use DROP … IF EXISTS guards.
-- =============================================================================

-- ── VENUES ───────────────────────────────────────────────────────────────────
-- The app's initial schema may not include messaging yet. Create the table
-- before the RLS statements below so this migration also works on fresh DBs.
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  booking_id UUID,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues: public read"   ON venues;
DROP POLICY IF EXISTS "venues: staff write"   ON venues;
DROP POLICY IF EXISTS "venues: staff update"  ON venues;
DROP POLICY IF EXISTS "venues: admin delete"  ON venues;

-- Anyone (including unauthenticated visitors) can read venues
CREATE POLICY "venues: public read"
  ON venues FOR SELECT
  USING (true);

-- Only admin/staff can insert
CREATE POLICY "venues: staff write"
  ON venues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Only admin/staff can update
CREATE POLICY "venues: staff update"
  ON venues FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- Only admin can delete
CREATE POLICY "venues: admin delete"
  ON venues FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages: participants select" ON messages;
DROP POLICY IF EXISTS "messages: sender insert"       ON messages;
DROP POLICY IF EXISTS "messages: staff read all"      ON messages;

-- Users can only read messages they sent or received
CREATE POLICY "messages: participants select"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- Users can only insert messages where they are the sender
-- (service-role calls bypass RLS and can insert with any sender_id)
CREATE POLICY "messages: sender insert"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Staff/admin can read all messages
CREATE POLICY "messages: staff read all"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'staff')
    )
  );

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
-- Point 1: NO insert policy for authenticated users.
-- Notifications are inserted by server code using the service role key, which
-- bypasses RLS.  An anon/authenticated INSERT policy would let any user create
-- notifications for any other user.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: owner select"  ON notifications;
DROP POLICY IF EXISTS "notifications: owner update"  ON notifications;
DROP POLICY IF EXISTS "notifications: system insert" ON notifications;  -- remove old permissive policy

-- Users can only read their own notifications
CREATE POLICY "notifications: owner select"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read (is_read only)
CREATE POLICY "notifications: owner update"
  ON notifications FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NO INSERT policy — service role bypasses RLS; anon/auth users cannot insert.

-- ── ACTIVITY_LOGS ─────────────────────────────────────────────────────────────
-- Point 1: NO insert policy for authenticated users.
-- Written only from server code via service role.
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs: owner select"  ON activity_logs;
DROP POLICY IF EXISTS "activity_logs: system insert" ON activity_logs;  -- remove old permissive policy
DROP POLICY IF EXISTS "activity_logs: admin select"  ON activity_logs;

-- Users can only read their own activity
CREATE POLICY "activity_logs: owner select"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all activity logs
CREATE POLICY "activity_logs: admin select"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- NO INSERT, UPDATE, DELETE policies — service role only; immutable.
