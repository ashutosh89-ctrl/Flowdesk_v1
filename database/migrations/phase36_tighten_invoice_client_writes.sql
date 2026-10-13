-- ============================================================================
-- Phase 36: Tighten Row-Level Security for Invoices (Phase 5A Batch 1)
-- ============================================================================
-- IMPORTANT NOTICE:
-- DO NOT APPLY THIS MIGRATION YET.
-- This migration removes direct client-side INSERT, UPDATE, and DELETE policies
-- on invoice tables, transitioning all mutations to secure server route handlers:
--   - POST /api/invoices (Create)
--   - PATCH /api/invoices/[invoiceId] (Update)
--   - DELETE /api/invoices/[invoiceId] (Delete)
--   - POST /api/invoices/[invoiceId]/status (State machine transitions)
--   - POST /api/invoices/[invoiceId]/payments/offline (Offline settlement)
--
-- APPLY THIS MIGRATION ONLY AFTER:
-- 1. The server route handlers are deployed and live in production.
-- 2. NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1=true is verified across all clients.
-- ============================================================================

-- 1. Tighten public.invoices policies
DROP POLICY IF EXISTS "Freelancer manage workspace invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workspace isolation for invoices" ON public.invoices;
DROP POLICY IF EXISTS "Freelancer view workspace invoices" ON public.invoices;

-- Freelancers can now ONLY SELECT invoices directly from the client.
-- All writes must be mediated by server routes using the service role client.
CREATE POLICY "Freelancer view workspace invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- Ensure client view policy remains intact
DROP POLICY IF EXISTS "Clients can view assigned invoices" ON public.invoices;
CREATE POLICY "Clients can view assigned invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.get_auth_client_ids()));

-- 2. Tighten public.invoice_items policies
DROP POLICY IF EXISTS "Freelancer manage workspace invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Workspace isolation for invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Freelancer view workspace invoice items" ON public.invoice_items;

CREATE POLICY "Freelancer view workspace invoice items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.is_workspace_owner(i.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Clients view assigned invoice items" ON public.invoice_items;
CREATE POLICY "Clients view assigned invoice items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- ============================================================================
-- Rollback Instructions for Phase 36:
--
-- To rollback to allowing client-side write access:
-- DROP POLICY IF EXISTS "Freelancer view workspace invoices" ON public.invoices;
-- CREATE POLICY "Freelancer manage workspace invoices" ON public.invoices
--   FOR ALL TO authenticated
--   USING (public.is_workspace_owner(workspace_id))
--   WITH CHECK (public.is_workspace_owner(workspace_id));
-- ============================================================================
