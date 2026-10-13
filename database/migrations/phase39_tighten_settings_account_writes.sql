-- ============================================================================
-- Phase 39: Tighten User Settings & Account Deletion RLS (Batch 4 Server Mutation Migration)
--
-- IMPORTANT: DO NOT APPLY THIS MIGRATION BEFORE SERVER ROUTES ARE FULLY DEPLOYED
-- AND NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_4 IS ENABLED IN PRODUCTION.
--
-- PURPOSE:
-- Restricts direct client-side INSERT/UPDATE/DELETE operations on public.user_settings
-- and public.account_deletions.
-- All settings modifications, notification preferences, account deletion requests,
-- and restoration lifecycles are now exclusively orchestrated via authenticated server
-- routes (/api/account/settings, /api/account/notifications, /api/account/delete, /api/account/restore).
-- Direct SELECT permissions remain intact for client-side reads.
-- ============================================================================

-- 1. Remove direct client-side write policies on public.user_settings
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

-- Ensure SELECT policy remains intact
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
CREATE POLICY "Users can select own settings" ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (id = auth.uid()::text);

-- 2. Remove direct client-side mutation policy on public.account_deletions
DROP POLICY IF EXISTS "Workspace owners can manage deletion records" ON public.account_deletions;

-- Replace with SELECT-only policy for authenticated workspace owners
CREATE POLICY "Workspace owners can view deletion records" ON public.account_deletions
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

COMMENT ON TABLE public.user_settings IS 'User preferences & billing configuration. Direct browser writes disabled; all mutations route through /api/account/settings and /api/account/notifications.';
COMMENT ON TABLE public.account_deletions IS 'Account deletion lifecycle audit records. Direct browser writes disabled; all transitions orchestrated via /api/account/delete and /api/account/restore.';
