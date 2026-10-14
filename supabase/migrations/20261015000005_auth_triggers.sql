-- ==============================================================================
-- FLOWDESK AUTH INTEGRATION: TRIGGERS & AUTOMATIC PROVISIONING
-- Migration: 20261015000005_auth_triggers.sql
-- Description: Sets up triggers on auth.users for automatic profile, workspace,
--              and settings creation upon signup, plus backfill for existing users.
-- ==============================================================================

-- 1. FUNCTION: handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
  v_full_name TEXT;
  v_client_id UUID;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_business_name := COALESCE(
    NEW.raw_user_meta_data->>'business_name',
    NEW.raw_user_meta_data->>'company_name',
    'My Workspace'
  );

  -- 1. Create Profile
  INSERT INTO public.profiles (
    id,
    full_name,
    business_name,
    email,
    onboarding_completed,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_business_name,
    NEW.email,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- 2. Create User Settings
  INSERT INTO public.user_settings (id, created_at, updated_at)
  VALUES (NEW.id, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 3. Create Workspace
  INSERT INTO public.workspaces (
    owner_id,
    name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_business_name,
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  -- 4. Auto-bind to client portal record if matching email exists and is unbound
  IF NEW.email IS NOT NULL THEN
    UPDATE public.clients
    SET user_id = NEW.id,
        updated_at = now()
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. TRIGGER: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. BACKFILL FOR EXISTING AUTH USERS
-- Ensures existing auth users immediately receive profiles, user_settings, and workspaces
DO $$
DECLARE
  r RECORD;
  v_name TEXT;
  v_ws TEXT;
BEGIN
  FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
    v_name := COALESCE(
      r.raw_user_meta_data->>'full_name',
      r.raw_user_meta_data->>'name',
      SPLIT_PART(r.email, '@', 1),
      'Freelancer'
    );
    v_ws := COALESCE(
      r.raw_user_meta_data->>'business_name',
      'My Workspace'
    );

    -- Insert profile if missing
    INSERT INTO public.profiles (id, full_name, business_name, email, onboarding_completed, created_at, updated_at)
    VALUES (r.id, v_name, v_ws, r.email, true, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Insert user_settings if missing
    INSERT INTO public.user_settings (id, created_at, updated_at)
    VALUES (r.id, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Insert workspace if user doesn't already own one
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = r.id) THEN
      INSERT INTO public.workspaces (owner_id, name, created_at, updated_at)
      VALUES (r.id, v_ws, now(), now());
    END IF;

    -- Auto-bind client record if email matches
    IF r.email IS NOT NULL THEN
      UPDATE public.clients
      SET user_id = r.id,
          updated_at = now()
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(r.email))
        AND user_id IS NULL;
    END IF;
  END LOOP;
END $$;
