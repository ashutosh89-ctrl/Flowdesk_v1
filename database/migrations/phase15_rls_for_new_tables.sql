-- Phase 15: RLS Policies for deliverable_versions, deliverable_files, deliverable_comments, invoice_items, invoice_payments
-- These tables were created in schema.sql but had no RLS policies

-- Enable RLS on all tables
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- deliverable_versions
-- ============================================================
-- Freelancer (workspace owner): full access to own workspace data
CREATE POLICY "freelancer_select_deliverable_versions"
  ON public.deliverable_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_insert_deliverable_versions"
  ON public.deliverable_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_update_deliverable_versions"
  ON public.deliverable_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_delete_deliverable_versions"
  ON public.deliverable_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

-- Client: SELECT only for versions on deliverables assigned to them
CREATE POLICY "client_select_deliverable_versions"
  ON public.deliverable_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND d.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
  );

-- ============================================================
-- deliverable_files
-- ============================================================
CREATE POLICY "freelancer_select_deliverable_files"
  ON public.deliverable_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_insert_deliverable_files"
  ON public.deliverable_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_update_deliverable_files"
  ON public.deliverable_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_delete_deliverable_files"
  ON public.deliverable_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

-- Client: SELECT only for files on deliverables assigned to them
CREATE POLICY "client_select_deliverable_files"
  ON public.deliverable_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
  );

-- ============================================================
-- deliverable_comments
-- ============================================================
CREATE POLICY "freelancer_select_deliverable_comments"
  ON public.deliverable_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_insert_deliverable_comments"
  ON public.deliverable_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_update_deliverable_comments"
  ON public.deliverable_comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_delete_deliverable_comments"
  ON public.deliverable_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

-- Client: SELECT + INSERT only for NON-INTERNAL comments on deliverables assigned to them.
-- Internal (freelancer-only) comments must never be readable by clients at the RLS layer.
CREATE POLICY "client_select_deliverable_comments"
  ON public.deliverable_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
    AND is_internal = false
  );

CREATE POLICY "client_insert_deliverable_comments"
  ON public.deliverable_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
  );

-- ============================================================
-- invoice_items
-- ============================================================
CREATE POLICY "freelancer_select_invoice_items"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_insert_invoice_items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_update_invoice_items"
  ON public.invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_delete_invoice_items"
  ON public.invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

-- Client: SELECT only for invoice items on invoices assigned to them
CREATE POLICY "client_select_invoice_items"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
  );

-- ============================================================
-- invoice_payments
-- ============================================================
CREATE POLICY "freelancer_select_invoice_payments"
  ON public.invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
        AND i.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "freelancer_insert_invoice_payments"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
        AND i.workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    )
  );

-- Client: SELECT only for payments on invoices assigned to them
CREATE POLICY "client_select_invoice_payments"
  ON public.invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
        AND i.client_id IN (SELECT id FROM public.get_auth_client_ids())
    )
  );
