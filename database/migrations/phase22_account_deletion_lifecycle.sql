-- ============================================================
-- Phase 22: Account Deletion Lifecycle & Recovery Migration
-- Implements:
-- 1. account_deletions table for audit and recovery management
-- 2. Client 30-day recovery policy (freelancer controlled)
-- 3. Freelancer 5-day recovery policy (self-controlled)
-- 4. Status columns for pending_deletion on clients and workspaces
-- 5. Strict multi-tenant RLS policies
-- ============================================================

-- 1. Add status and deleted_at columns to clients, workspaces, and profiles if missing
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
  -- Update clients status check constraint to include pending_deletion
  ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;
  ALTER TABLE public.clients ADD CONSTRAINT clients_status_check 
    CHECK (status IN ('active', 'inactive', 'lead', 'archived', 'pending_deletion'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create account_deletions table
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL CHECK (account_type IN ('client', 'freelancer')),
  user_id UUID,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  deleted_by UUID,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restore_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_deletion' CHECK (status IN ('pending_deletion', 'restored', 'permanently_deleted')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Workspace owners can manage deletion records" ON public.account_deletions;
CREATE POLICY "Workspace owners can manage deletion records" ON public.account_deletions
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid() OR user_id = auth.uid())
    OR user_id = auth.uid()
    OR deleted_by = auth.uid()
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid() OR user_id = auth.uid())
    OR user_id = auth.uid()
    OR deleted_by = auth.uid()
  );

-- 5. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_account_deletions_workspace_status ON public.account_deletions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_account_deletions_client ON public.account_deletions(client_id, status);
CREATE INDEX IF NOT EXISTS idx_account_deletions_restore_until ON public.account_deletions(restore_until) WHERE status = 'pending_deletion';
CREATE INDEX IF NOT EXISTS idx_clients_workspace_status ON public.clients(workspace_id, status);
