-- ============================================================================
-- FLOWDESK DATABASE MIGRATION — PHASE 35
-- SEC-RLS-01: Multi-Tenant RLS Policy Hardening & Client Cross-Scope Resolution
-- ============================================================================
-- Addresses cross-tenant gaps identified in the Phase 4B security audit:
-- 1. Adds client SELECT policy on public.workspaces for assigned workspaces.
-- 2. Adds client SELECT policy on public.profiles for workspace owners.
-- 3. Hardens storage path rules on public buckets (logos, signatures).
-- 4. Ensures all tables have RLS enabled and default-deny semantics.
-- ============================================================================

-- 1. Ensure RLS is enabled on all core tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- 2. WORKSPACES: Allow authenticated clients to view their assigned workspace
-- Fixes client portal loading issue where client cannot query workspace branding/name.
DROP POLICY IF EXISTS "Clients can view assigned workspace" ON public.workspaces;
CREATE POLICY "Clients can view assigned workspace"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT c.workspace_id FROM public.clients c
      WHERE c.id IN (SELECT public.get_auth_client_ids())
    )
  );

-- 3. PROFILES: Allow authenticated clients to view the profile of their workspace owner
-- Fixes freelancer name and avatar presentation on invoices and deliverables in client portal.
DROP POLICY IF EXISTS "Clients can view workspace owner profile" ON public.profiles;
CREATE POLICY "Clients can view workspace owner profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT ws.owner_id FROM public.workspaces ws
      JOIN public.clients c ON c.workspace_id = ws.id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
    )
  );

-- 4. STORAGE: Canonicalize path policy for logos and signatures
DROP POLICY IF EXISTS "Freelancer can manage workspace logos canonical" ON storage.objects;
CREATE POLICY "Freelancer can manage workspace logos canonical"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (name LIKE 'workspaces/' || ws.id::text || '/%' OR name LIKE ws.id::text || '/%')
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (name LIKE 'workspaces/' || ws.id::text || '/%' OR name LIKE ws.id::text || '/%')
    )
  );

DROP POLICY IF EXISTS "Freelancer can manage workspace signatures canonical" ON storage.objects;
CREATE POLICY "Freelancer can manage workspace signatures canonical"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'signatures'
    AND EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (name LIKE 'workspaces/' || ws.id::text || '/%' OR name LIKE ws.id::text || '/%')
    )
  )
  WITH CHECK (
    bucket_id = 'signatures'
    AND EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (name LIKE 'workspaces/' || ws.id::text || '/%' OR name LIKE ws.id::text || '/%')
    )
  );
