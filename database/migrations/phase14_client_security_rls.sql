-- Phase 14 Client Portal Security, Authentication, Authorization & Data Isolation
-- Implements Dual RLS Policies (Freelancer Workspace Owner vs. Authenticated Client)

-- 1. EXTEND TABLES WITH CLIENT IDENTITY & VISIBILITY FLAGS
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS portal_token TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON public.clients(portal_token);

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
ALTER TABLE public.workspace_comments ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- 2. HELPER FUNCTIONS FOR CLIENT RESOLUTION
-- Client identity is bound to the authenticated Supabase user via clients.user_id
-- (established at first client login). Email matching across all workspaces is NOT
-- used because it would grant a person with the same email address access to every
-- freelancer workspace where that email appears as a client.
CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = ws_id AND owner_id = auth.uid()
  );
$$;

-- 3. DROP OLD STRICT POLICIES
DROP POLICY IF EXISTS "Workspace isolation for clients" ON public.clients;
DROP POLICY IF EXISTS "Workspace isolation for projects" ON public.projects;
DROP POLICY IF EXISTS "Workspace isolation for deliverables" ON public.deliverables;
DROP POLICY IF EXISTS "Workspace isolation for documents" ON public.documents;
DROP POLICY IF EXISTS "Workspace isolation for invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workspace isolation for comments" ON public.workspace_comments;
DROP POLICY IF EXISTS "Workspace isolation for notifications" ON public.notifications;
DROP POLICY IF EXISTS "Workspace isolation for activities" ON public.activities;

-- 4. HARDENED DUAL-ROLE RLS POLICIES

-- CLIENTS
CREATE POLICY "Freelancer manage own workspace clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Clients can view own client profile" ON public.clients
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_auth_client_ids()));

-- PROJECTS
CREATE POLICY "Freelancer manage workspace projects" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Clients can view assigned projects" ON public.projects
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.get_auth_client_ids()));

-- DELIVERABLES
CREATE POLICY "Freelancer manage workspace deliverables" ON public.deliverables
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Clients can view assigned deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.get_auth_client_ids()));

CREATE POLICY "Clients can sign-off or request revisions on deliverables" ON public.deliverables
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT public.get_auth_client_ids()))
  WITH CHECK (
    client_id IN (SELECT public.get_auth_client_ids())
    AND status IN ('approved', 'revision_requested', 'ready_for_review')
  );

-- DOCUMENTS
CREATE POLICY "Freelancer manage workspace documents" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Clients can view non-internal shared documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND client_id IN (SELECT public.get_auth_client_ids())
  );

CREATE POLICY "Clients can upload requested intake documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal = false
    AND client_id IN (SELECT public.get_auth_client_ids())
  );

-- INVOICES
CREATE POLICY "Freelancer manage workspace invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Clients can view assigned invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.get_auth_client_ids()));

-- WORKSPACE COMMENTS
CREATE POLICY "Freelancer manage workspace comments" ON public.workspace_comments
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Clients can view non-internal comments" ON public.workspace_comments
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND client_id IN (SELECT public.get_auth_client_ids())
  );

CREATE POLICY "Clients can post collaboration comments" ON public.workspace_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal = false
    AND client_id IN (SELECT public.get_auth_client_ids())
  );

-- NOTIFICATIONS & ACTIVITIES
CREATE POLICY "Freelancer manage workspace notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Freelancer manage workspace activities" ON public.activities
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id));
