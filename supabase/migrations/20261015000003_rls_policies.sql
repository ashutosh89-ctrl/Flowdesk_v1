-- ==============================================================================
-- FLOWDESK ROW-LEVEL SECURITY (RLS) POLICIES & SECURITY DEFINER HELPERS
-- Migration: 20261015000003_rls_policies.sql
-- Description: Enables RLS on all tables and implements least-privilege policies
--              for workspace owners and authenticated client portal users.
-- ==============================================================================

-- 1. SECURITY DEFINER AUTHORIZATION HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_workspace_owner(check_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = check_workspace_id
      AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid()
    AND status != 'pending_deletion';
$$;

CREATE OR REPLACE FUNCTION public.is_client_user(check_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = check_client_id
      AND user_id = auth.uid()
      AND status != 'pending_deletion'
  );
$$;

-- 2. ENABLE ROW LEVEL SECURITY ON ALL APPLICATION TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own_or_workspace" ON public.profiles;
CREATE POLICY "profiles_select_own_or_workspace" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    id IN (
      SELECT w.owner_id FROM public.workspaces w
      JOIN public.clients c ON c.workspace_id = w.id
      WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4. USER SETTINGS POLICIES
DROP POLICY IF EXISTS "user_settings_all_own" ON public.user_settings;
CREATE POLICY "user_settings_all_own" ON public.user_settings
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. WORKSPACES POLICIES
DROP POLICY IF EXISTS "workspaces_select_owner_or_client" ON public.workspaces;
CREATE POLICY "workspaces_select_owner_or_client" ON public.workspaces
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT workspace_id FROM public.clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "workspaces_manage_owner" ON public.workspaces;
CREATE POLICY "workspaces_manage_owner" ON public.workspaces
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 6. CLIENTS POLICIES
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "clients_owner_insert" ON public.clients;
CREATE POLICY "clients_owner_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    user_id = auth.uid()
  )
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (user_id = auth.uid() AND workspace_id = workspace_id)
  );

DROP POLICY IF EXISTS "clients_owner_delete" ON public.clients;
CREATE POLICY "clients_owner_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- 7. CLIENT INVITATIONS POLICIES
DROP POLICY IF EXISTS "invitations_owner_manage" ON public.client_invitations;
CREATE POLICY "invitations_owner_manage" ON public.client_invitations
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 8. PROJECTS & MILESTONES POLICIES
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "projects_owner_manage" ON public.projects;
CREATE POLICY "projects_owner_manage" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "milestones_select" ON public.project_milestones;
CREATE POLICY "milestones_select" ON public.project_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (public.is_workspace_owner(p.workspace_id) OR p.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "milestones_owner_manage" ON public.project_milestones;
CREATE POLICY "milestones_owner_manage" ON public.project_milestones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.is_workspace_owner(p.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.is_workspace_owner(p.workspace_id)
    )
  );

-- 9. DELIVERABLES POLICIES
DROP POLICY IF EXISTS "deliverables_select" ON public.deliverables;
CREATE POLICY "deliverables_select" ON public.deliverables
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND status != 'archived')
  );

DROP POLICY IF EXISTS "deliverables_insert" ON public.deliverables;
CREATE POLICY "deliverables_insert" ON public.deliverables
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "deliverables_update" ON public.deliverables;
CREATE POLICY "deliverables_update" ON public.deliverables
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  )
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "deliverables_delete" ON public.deliverables;
CREATE POLICY "deliverables_delete" ON public.deliverables
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "deliv_versions_select" ON public.deliverable_versions;
CREATE POLICY "deliv_versions_select" ON public.deliverable_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (public.is_workspace_owner(d.workspace_id) OR d.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "deliv_versions_manage" ON public.deliverable_versions;
CREATE POLICY "deliv_versions_manage" ON public.deliverable_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND public.is_workspace_owner(d.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND public.is_workspace_owner(d.workspace_id)
    )
  );

DROP POLICY IF EXISTS "deliv_files_select" ON public.deliverable_files;
CREATE POLICY "deliv_files_select" ON public.deliverable_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (public.is_workspace_owner(d.workspace_id) OR d.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "deliv_files_insert" ON public.deliverable_files;
CREATE POLICY "deliv_files_insert" ON public.deliverable_files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (public.is_workspace_owner(d.workspace_id) OR d.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "deliv_comments_select" ON public.deliverable_comments;
CREATE POLICY "deliv_comments_select" ON public.deliverable_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (
          public.is_workspace_owner(d.workspace_id) OR
          (d.client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
        )
    )
  );

DROP POLICY IF EXISTS "deliv_comments_insert" ON public.deliverable_comments;
CREATE POLICY "deliv_comments_insert" ON public.deliverable_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_id
        AND (
          public.is_workspace_owner(d.workspace_id) OR
          (d.client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
        )
    )
  );

-- 10. DOCUMENTS POLICIES (INTERNAL DOCUMENTS HIDDEN FROM CLIENTS)
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  )
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- 11. INVOICES & PAYMENTS POLICIES
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "invoices_manage_owner" ON public.invoices;
CREATE POLICY "invoices_manage_owner" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "invoice_items_select" ON public.invoice_items;
CREATE POLICY "invoice_items_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (public.is_workspace_owner(i.workspace_id) OR i.client_id IN (SELECT public.get_auth_client_ids()))
    )
  );

DROP POLICY IF EXISTS "invoice_items_manage" ON public.invoice_items;
CREATE POLICY "invoice_items_manage" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.is_workspace_owner(i.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.is_workspace_owner(i.workspace_id)
    )
  );

DROP POLICY IF EXISTS "invoice_payments_select" ON public.invoice_payments;
CREATE POLICY "invoice_payments_select" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

DROP POLICY IF EXISTS "invoice_payments_insert" ON public.invoice_payments;
CREATE POLICY "invoice_payments_insert" ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- 12. COLLABORATION COMMENTS (INTERNAL COMMENTS RESTRICTED TO FREELANCER)
DROP POLICY IF EXISTS "comments_select" ON public.workspace_comments;
CREATE POLICY "comments_select" ON public.workspace_comments
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "comments_insert" ON public.workspace_comments;
CREATE POLICY "comments_insert" ON public.workspace_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    (client_id IN (SELECT public.get_auth_client_ids()) AND is_internal = false)
  );

DROP POLICY IF EXISTS "comments_manage_owner" ON public.workspace_comments;
CREATE POLICY "comments_manage_owner" ON public.workspace_comments
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 13. ACTIVITIES & NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 14. SUBSCRIPTIONS, JOBS, REMINDERS & ACCOUNT DELETION POLICIES
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "billing_events_select" ON public.billing_events;
CREATE POLICY "billing_events_select" ON public.billing_events
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "entitlements_select" ON public.entitlement_overrides;
CREATE POLICY "entitlements_select" ON public.entitlement_overrides
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "usage_counters_select" ON public.usage_counters;
CREATE POLICY "usage_counters_select" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
CREATE POLICY "jobs_select" ON public.jobs
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "job_runs_select" ON public.job_runs;
CREATE POLICY "job_runs_select" ON public.job_runs
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "reminder_settings_owner" ON public.reminder_settings;
CREATE POLICY "reminder_settings_owner" ON public.reminder_settings
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "reminder_log_select" ON public.reminder_log;
CREATE POLICY "reminder_log_select" ON public.reminder_log
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "account_deletions_select" ON public.account_deletions;
CREATE POLICY "account_deletions_select" ON public.account_deletions
  FOR SELECT TO authenticated
  USING (deleted_by = auth.uid());
