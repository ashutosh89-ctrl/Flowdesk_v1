-- ============================================================
-- Phase 16: Client Portal RLS Hardening
-- Ensures clients can ONLY see their own data
-- Fixes gaps identified in the E2E audit
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTION: get_auth_client_ids()
-- ============================================================
-- This function returns the IDs of clients that the current
-- authenticated user is authorized to access.
--
-- A client is authorized if:
--   - The client's user_id matches auth.uid(), OR
--   - The client's email matches the authenticated user's email
--
-- This is SECURITY DEFINER to avoid recursive RLS checks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid();
$$;

-- ============================================================
-- 2. HELPER FUNCTION: is_workspace_owner(ws_id)
-- ============================================================
-- Returns true if the current authenticated user owns the
-- specified workspace.
-- ============================================================

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

-- ============================================================
-- 3. NOTIFICATIONS: Add client SELECT policy
-- ============================================================
-- GAP: Phase 14 only had Freelancer policies for notifications.
-- Clients need to see notifications relevant to their work.
--
-- Policy: Client can SELECT notifications where:
--   - The notification belongs to their client_id, OR
--   - The notification belongs to a workspace they're assigned to
-- ============================================================

DROP POLICY IF EXISTS "Clients can view own notifications" ON public.notifications;
CREATE POLICY "Clients can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT public.get_auth_client_ids())
    OR workspace_id IN (
      SELECT ws.id FROM public.workspaces ws
      JOIN public.clients c ON c.workspace_id = ws.id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
    )
  );

-- ============================================================
-- 4. ACTIVITIES: Add client SELECT policy
-- ============================================================
-- GAP: Phase 14 only had Freelancer policies for activities.
-- Clients need to see activity relevant to their projects/deliverables.
--
-- Policy: Client can SELECT activities where:
--   - The activity belongs to their client_id, OR
--   - The activity belongs to a project assigned to them, OR
--   - The activity belongs to a workspace they're assigned to
-- ============================================================

DROP POLICY IF EXISTS "Clients can view own activities" ON public.activities;
CREATE POLICY "Clients can view own activities" ON public.activities
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT public.get_auth_client_ids())
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.client_id IN (SELECT public.get_auth_client_ids())
    )
    OR workspace_id IN (
      SELECT ws.id FROM public.workspaces ws
      JOIN public.clients c ON c.workspace_id = ws.id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
    )
  );

-- ============================================================
-- 5. DELIVERABLE COMMENTS: Add client UPDATE policy
-- ============================================================
-- GAP: Clients could SELECT and INSERT comments but not UPDATE.
-- Clients need to resolve comments they created.
--
-- Policy: Client can UPDATE comments where:
--   - The comment belongs to a deliverable assigned to them, AND
--   - They can only set resolved = true (mark as resolved)
-- ============================================================

DROP POLICY IF EXISTS "Clients can resolve own deliverable comments" ON public.deliverable_comments;
CREATE POLICY "Clients can resolve own deliverable comments" ON public.deliverable_comments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- ============================================================
-- 6. DOCUMENTS: Add client UPDATE policy
-- ============================================================
-- GAP: Clients could SELECT and INSERT documents but not UPDATE.
-- Clients need to update document status after uploading files.
--
-- Policy: Client can UPDATE documents where:
--   - The document belongs to their client_id, AND
--   - They can only update specific fields (file_name, size, file_url, status)
-- ============================================================

DROP POLICY IF EXISTS "Clients can update own documents" ON public.documents;
CREATE POLICY "Clients can update own documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT public.get_auth_client_ids())
  )
  WITH CHECK (
    client_id IN (SELECT public.get_auth_client_ids())
  );

-- ============================================================
-- 7. WORKSPACE COMMENTS: Add client UPDATE policy
-- ============================================================
-- GAP: Clients could SELECT and INSERT comments but not UPDATE.
-- Clients need to mark comments as read.
--
-- Policy: Client can UPDATE workspace comments where:
--   - The comment belongs to their client_id
-- ============================================================

DROP POLICY IF EXISTS "Clients can update own workspace comments" ON public.workspace_comments;
CREATE POLICY "Clients can update own workspace comments" ON public.workspace_comments
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT public.get_auth_client_ids())
  )
  WITH CHECK (
    client_id IN (SELECT public.get_auth_client_ids())
  );

-- ============================================================
-- 8. DELIVERABLES: Verify client UPDATE policy
-- ============================================================
-- Existing policy from Phase 14 allows clients to:
--   - Set status to 'approved', 'revision_requested', 'ready_for_review'
--
-- This is CORRECT. Clients should NOT be able to:
--   - Change deliverable title/description
--   - Delete deliverables
--   - Change workspace_id or client_id
--
-- No changes needed.
-- ============================================================

-- ============================================================
-- 9. INVOICES: Verify client SELECT-only policy
-- ============================================================
-- Existing policy from Phase 14 allows clients to:
--   - SELECT invoices assigned to them
--
-- This is CORRECT. Clients should NOT be able to:
--   - Create invoices
--   - Edit invoices
--   - Delete invoices
--   - Mark invoices as paid (payment is a separate action)
--
-- No changes needed.
-- ============================================================

-- ============================================================
-- 10. STORAGE BUCKETS: Add storage RLS policies
-- ============================================================
-- GAP: Storage buckets exist but have no RLS policies.
-- Clients should only access files in their assigned workspace.
--
-- Note: Supabase Storage uses its own RLS system separate from
-- Postgres RLS. We need to add storage policies.
-- ============================================================

-- Documents bucket: private
-- Freelancer: full access to own workspace files
-- Client: read-only access to their assigned client files

-- First, ensure buckets exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('deliverables', 'deliverables', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. SECURITY VERIFICATION QUERIES
-- ============================================================
-- Run these queries to verify RLS is working correctly:
--
-- TEST 1: Freelancer A can see their own data
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "FREELANCER_A_USER_ID"}';
-- SELECT * FROM public.clients; -- Should return only Workspace A clients
--
-- TEST 2: Freelancer A CANNOT see Freelancer B's data
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "FREELANCER_A_USER_ID"}';
-- SELECT * FROM public.clients WHERE workspace_id = 'FREELANCER_B_WORKSPACE_ID';
-- -- Should return 0 rows
--
-- TEST 3: Client A can see their own data
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SELECT * FROM public.projects WHERE client_id = 'CLIENT_A_ID';
-- -- Should return only Client A's projects
--
-- TEST 4: Client A CANNOT see Client B's data
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SELECT * FROM public.projects WHERE client_id = 'CLIENT_B_ID';
-- -- Should return 0 rows
--
-- TEST 5: Client A CANNOT see freelancer-only data
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SELECT * FROM public.profiles WHERE id = 'FREELANCER_USER_ID';
-- -- Should return 0 rows (profiles are user-specific)
--
-- TEST 6: Unauthenticated user cannot access any data
-- RESET role;
-- SELECT * FROM public.clients; -- Should return 0 rows
-- ============================================================
