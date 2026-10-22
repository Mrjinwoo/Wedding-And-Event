-- =============================================================================
-- Migration 002 — Block role self-promotion via trigger + RLS policy fix
-- Audit item #5
--
-- Point 4 compliance:
-- • search_path = '' (empty) — prevents search-path hijacking attacks where
--   a malicious schema could shadow pg_catalog or public functions.
-- • auth.uid() is used only inside the trigger body (not in the function
--   signature) so it resolves correctly via the pg_catalog search path.
-- • The trigger runs as SECURITY DEFINER so it can read profiles regardless
--   of the calling user's RLS context.
-- • Service-role / SQL-editor calls: auth.uid() returns NULL when called from
--   the SQL editor or via the service role key (no JWT in scope).  The trigger
--   explicitly treats NULL as "superuser/service-role" and allows the change.
--   This means admins editing via the table editor work without friction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Point 4: empty search_path prevents search-path injection
SET search_path = ''
AS $$
DECLARE
  caller_id   UUID;
  caller_role TEXT;
BEGIN
  -- Only fire when the role column is actually being changed
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  caller_id := auth.uid();

  -- NULL means the call came from the service role or the SQL editor (no JWT).
  -- Allow it — this covers Supabase dashboard edits and admin SQL scripts.
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the calling user's role using fully-qualified table reference
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  -- Only admins may change the role column
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION
      'permission denied: only an admin may change the role column (caller: %)',
      caller_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_change ON public.profiles;

CREATE TRIGGER trg_prevent_role_self_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_change();

-- ── RLS second layer ─────────────────────────────────────────────────────────
-- Even if the trigger is somehow bypassed, this policy rejects any UPDATE
-- that changes the role column for a non-admin caller.
DROP POLICY IF EXISTS "profiles: owner update" ON public.profiles;

CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
