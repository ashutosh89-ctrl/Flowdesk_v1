-- ============================================================================
-- FLOWDESK DATABASE MIGRATION — PHASE 33
-- SEC-HIGH-02: Strict Cross-Client Storage Isolation & Canonical Path RLS
-- ============================================================================
-- This migration hardens Supabase Storage RLS policies for private buckets:
-- 1. 'documents'
-- 2. 'deliverables'
--
-- VULNERABILITY ADDRESSED:
-- Previously, storage policies allowed any client in a workspace to read, and
-- for documents upload/update, files belonging to other clients within the same
-- workspace because RLS only checked the workspace ID segment. Policies also
-- accepted multiple loose path prefixes (workspaces/<id>/%, <id>/%, folder segments).
--
-- CANONICAL PATH ARCHITECTURE:
-- Client-scoped private objects:
--   workspaces/<workspaceId>/clients/<clientId>/<randomPrefix>_<fileName>
--
-- Workspace-scoped shared objects:
--   workspaces/<workspaceId>/shared/<randomPrefix>_<fileName>
--   NOTE: Workspace shared files default to freelancer-only access. Clients cannot
--   read or write shared workspace files.
--
-- PATH MATCHING RULE:
-- Standard PostgreSQL split_part(name, '/', N) is used exclusively:
--   Segment 1 = 'workspaces'
--   Segment 2 = workspace_id (UUID text)
--   Segment 3 = 'clients' (or 'shared')
--   Segment 4 = client_id (UUID text, when segment 3 is 'clients')
--
-- ROLE ACCESS MATRIX:
-- ┌────────────┬─────────────┬──────────┬────────────────────────────────────────────────────────┐
-- │ Bucket     │ Role        │ Action   │ Allowed Scope                                          │
-- ├────────────┼─────────────┼──────────┼────────────────────────────────────────────────────────┤
-- │ documents  │ Freelancer  │ ALL      │ Entire workspace (segment 2 owns workspace)            │
-- │ documents  │ Client      │ SELECT   │ Own client folder only (segment 2 ws + segment 4 cli)  │
-- │ documents  │ Client      │ INSERT   │ Own client folder only (segment 2 ws + segment 4 cli)  │
-- │ documents  │ Client      │ UPDATE   │ Own client folder only (segment 2 ws + segment 4 cli)  │
-- │ documents  │ Client      │ DELETE   │ Own client folder only (segment 2 ws + segment 4 cli)  │
-- │deliverables│ Freelancer  │ ALL      │ Entire workspace (segment 2 owns workspace)            │
-- │deliverables│ Client      │ SELECT   │ Own client folder only (segment 2 ws + segment 4 cli)  │
-- │deliverables│ Client      │ INS/UPD  │ BLOCKED (Deliverables bucket is read-only for clients) │
-- │Both        │ Anon        │ NONE     │ BLOCKED (No anonymous access permitted)                │
-- └────────────┴─────────────┴──────────┴────────────────────────────────────────────────────────┘

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. DROP EXISTING OVERLAPPING STORAGE POLICIES
-- ============================================================================
-- Documents policies (Phase 16 and Phase 29)
DROP POLICY IF EXISTS "Freelancer can manage workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can manage own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can update own documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can view workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can update workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can delete workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can view assigned workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload documents to workspace" ON storage.objects;
DROP POLICY IF EXISTS "Client can update documents in workspace" ON storage.objects;

-- Deliverables policies (Phase 16, Phase 19, and Phase 29)
DROP POLICY IF EXISTS "Freelancer can manage workspace deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can view own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can update own deliverables in storage" ON storage.objects;
DROP POLICY IF EXISTS "Client can manage own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can view deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload deliverables" ON storage.objects;

-- ============================================================================
-- 2. CREATE STRICT CANONICAL STORAGE POLICIES: DOCUMENTS
-- ============================================================================

-- Freelancer (Workspace Owner): Full management of all documents in owned workspace
CREATE POLICY "Freelancer can manage workspace documents"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
);

-- Client: SELECT (Read) access to own documents only
CREATE POLICY "Client can view own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND split_part(name, '/', 3) = 'clients'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id IN (SELECT public.get_auth_client_ids())
      AND c.workspace_id::text = split_part(name, '/', 2)
      AND c.id::text = split_part(name, '/', 4)
  )
);

-- Client: INSERT (Upload) access restricted to own client folder
CREATE POLICY "Client can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND split_part(name, '/', 3) = 'clients'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id IN (SELECT public.get_auth_client_ids())
      AND c.workspace_id::text = split_part(name, '/', 2)
      AND c.id::text = split_part(name, '/', 4)
  )
);

-- Client: UPDATE access restricted to own client folder
CREATE POLICY "Client can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND split_part(name, '/', 3) = 'clients'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id IN (SELECT public.get_auth_client_ids())
      AND c.workspace_id::text = split_part(name, '/', 2)
      AND c.id::text = split_part(name, '/', 4)
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND split_part(name, '/', 3) = 'clients'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id IN (SELECT public.get_auth_client_ids())
      AND c.workspace_id::text = split_part(name, '/', 2)
      AND c.id::text = split_part(name, '/', 4)
  )
);

-- Client: DELETE access restricted to own client folder (e.g. cleanup on failed metadata save)
CREATE POLICY "Client can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND split_part(name, '/', 1) = 'workspaces'
  AND split_part(name, '/', 3) = 'clients'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id IN (SELECT public.get_auth_client_ids())
      AND c.workspace_id::text = split_part(name, '/', 2)
      AND c.id::text = split_part(name, '/', 4)
  )
);

-- ============================================================================
-- 3. CREATE STRICT CANONICAL STORAGE POLICIES: DELIVERABLES
-- ============================================================================

-- Freelancer (Workspace Owner): Full management of all deliverables in owned workspace
CREATE POLICY "Freelancer can manage workspace deliverables"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'deliverables'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
);

-- Client: SELECT (Read-only) access to assigned deliverables in own client folder
-- Deliverables bucket is strictly READ-ONLY for clients. No INSERT, UPDATE, or DELETE is granted.
CREATE POLICY "Client can view own deliverables"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'deliverables'
  AND split_part(name, '/', 1) = 'workspaces'
  AND split_part(name, '/', 3) = 'clients'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id IN (SELECT public.get_auth_client_ids())
      AND c.workspace_id::text = split_part(name, '/', 2)
      AND c.id::text = split_part(name, '/', 4)
  )
);
