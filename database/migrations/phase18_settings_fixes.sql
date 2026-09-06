-- Phase 18: Settings System Fixes
-- 1. Add proper RLS policies for user_settings table
-- 2. Fix schema consistency

-- ============================================================
-- 1. USER_SETTINGS RLS POLICIES
-- ============================================================
-- The table has RLS enabled but NO policies defined.
-- This means all queries silently fail in production.

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

-- SELECT: authenticated user can read ONLY their own settings
CREATE POLICY "Users can select own settings" ON public.user_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- INSERT: authenticated user can insert ONLY their own settings
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: authenticated user can update ONLY their own settings
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: authenticated user can delete ONLY their own settings
CREATE POLICY "Users can delete own settings" ON public.user_settings
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- ============================================================
-- 2. Add default_payment_terms column to user_settings
-- ============================================================
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS default_payment_terms INTEGER DEFAULT 14;
