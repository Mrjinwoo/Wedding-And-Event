-- Base profile table required by auth, bookings, admin, and RLS migrations.
-- Safe to run on projects where some or all of the table already exists.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_recovery_codes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mfa_recovery_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: owner select" ON public.profiles;
CREATE POLICY "profiles: owner select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: owner update" ON public.profiles;
CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Prevent a user from changing their own role through the owner update policy.
CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID;
  caller_role TEXT;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'permission denied: only an admin may change the role column'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_change ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();

-- Do not trust role supplied in auth user metadata. New accounts start as
-- customers; the server-side staff invitation flow assigns staff afterward.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    'client'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill accounts created before the profile trigger/table existed.
INSERT INTO public.profiles (id, full_name, phone, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  NULLIF(u.raw_user_meta_data ->> 'phone', ''),
  'client'
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
