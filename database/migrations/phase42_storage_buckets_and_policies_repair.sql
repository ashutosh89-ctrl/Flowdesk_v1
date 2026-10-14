-- ============================================================================
-- FLOWDESK DATABASE MIGRATION — PHASE 42
-- Storage Bucket Provisioning & Storage RLS Repair
-- ============================================================================
-- ROOT CAUSE ADDRESSED (production audit on 2026-10-13):
--   * The `signatures` bucket referenced by the Studio Branding signature upload
--     did not exist  -> Supabase Storage returned "Bucket not found".
--   * `storage.objects` had NO policies at all for any bucket -> every upload
--     returned "new row violates row-level security policy".
--   * `documents` and `deliverables` had drifted to `public = true` (they must be
--     private, served only through signed URLs).
--   * Bucket-level `file_size_limit` / `allowed_mime_types` were unset.
--
-- This migration is fully idempotent: it can be re-run safely and it drops any
-- prior/legacy policy names before recreating the canonical set.
--
-- CANONICAL OBJECT PATHS (must match src/backend/storage/storage-helper.ts):
--   Public branding (logos, signatures, avatars):
--     workspaces/<workspaceId>/branding/<uuid>_<filename>
--   Private client-scoped (documents, deliverables):
--     workspaces/<workspaceId>/clients/<clientId>/<uuid>_<filename>
--   Private workspace-shared:
--     workspaces/<workspaceId>/shared/<uuid>_<filename>
--
-- Segment layout (split_part(name, '/', N)):
--   1 = 'workspaces'   2 = workspaceId   3 = 'clients' | 'shared' | 'branding'
--   4 = clientId (only when segment 3 = 'clients')
--
-- AUTHORIZATION MATRIX
--   ┌────────────┬────────────┬────────┬───────────────────────────────────────┐
--   │ Bucket     │ Role       │ Action │ Scope                                 │
--   ├────────────┼────────────┼────────┼───────────────────────────────────────┤
--   │ logos      │ public     │ SELECT │ bucket read (public branding asset)   │
--   │ logos      │ owner      │ ALL    │ own workspace only                    │
--   │ signatures │ public     │ SELECT │ bucket read (public branding asset)   │
--   │ signatures │ owner      │ ALL    │ own workspace only                    │
--   │ avatars    │ public     │ SELECT │ bucket read                           │
--   │ avatars    │ owner      │ ALL    │ own workspace / own uid only          │
--   │ documents  │ owner      │ ALL    │ entire owned workspace                │
--   │ documents  │ client     │ ALL    │ own client folder only                │
--   │ deliverables│ owner     │ ALL    │ entire owned workspace               │
--   │ deliverables│ client    │ SELECT │ own client folder only (read-only)   │
--   │ all        │ anon       │ write  │ BLOCKED                               │
--   └────────────┴────────────┴────────┴───────────────────────────────────────┘
-- ============================================================================

-- ============================================================================
-- 1. PROVISION BUCKETS (idempotent)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',      'avatars',      true,  2097152,  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('logos',        'logos',        true,  2097152,  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('signatures',   'signatures',   true,  2097152,  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('documents',    'documents',    false, 26214400, NULL),
  ('deliverables', 'deliverables', false, 26214400, NULL)
ON CONFLICT (id) DO UPDATE SET
  public           = EXCLUDED.public,
  file_size_limit  = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enforce privacy on the private buckets even if they previously drifted public.
UPDATE storage.buckets SET public = false WHERE id IN ('documents', 'deliverables');

-- ============================================================================
-- 2. ENABLE RLS ON storage.objects
-- ============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. DROP ALL LEGACY STORAGE POLICY NAMES (phase16 / 23 / 29 / 33 / 35)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage own avatar" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace logos canonical" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace signatures canonical" ON storage.objects;

DROP POLICY IF EXISTS "Freelancer can manage workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can manage own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can update own documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "Client can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can delete own documents" ON storage.objects;

DROP POLICY IF EXISTS "Freelancer can manage workspace deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can view own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can update own deliverables in storage" ON storage.objects;
DROP POLICY IF EXISTS "Client can manage own deliverables" ON storage.objects;

-- Idempotent re-run guard for this migration's own names
DROP POLICY IF EXISTS "fd_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "fd_logos_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "fd_signatures_public_read" ON storage.objects;
DROP POLICY IF EXISTS "fd_signatures_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "fd_avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "fd_avatars_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "fd_documents_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "fd_documents_client_select" ON storage.objects;
DROP POLICY IF EXISTS "fd_documents_client_insert" ON storage.objects;
DROP POLICY IF EXISTS "fd_documents_client_update" ON storage.objects;
DROP POLICY IF EXISTS "fd_documents_client_delete" ON storage.objects;
DROP POLICY IF EXISTS "fd_deliverables_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "fd_deliverables_client_select" ON storage.objects;

-- ============================================================================
-- 4. LOGOS (public branding) — public read, workspace-owner write
-- ============================================================================
CREATE POLICY "fd_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "fd_logos_owner_write"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'logos'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
);

-- ============================================================================
-- 5. SIGNATURES (public branding) — public read, workspace-owner write
-- ============================================================================
CREATE POLICY "fd_signatures_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

CREATE POLICY "fd_signatures_owner_write"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'signatures'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
)
WITH CHECK (
  bucket_id = 'signatures'
  AND split_part(name, '/', 1) = 'workspaces'
  AND EXISTS (
    SELECT 1 FROM public.workspaces ws
    WHERE ws.owner_id = auth.uid()
      AND ws.id::text = split_part(name, '/', 2)
  )
);

-- ============================================================================
-- 6. AVATARS (public) — public read; owner writes own avatar or own workspace
-- ============================================================================
CREATE POLICY "fd_avatars_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "fd_avatars_owner_write"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND split_part(name, '/', 1) = 'workspaces'
        AND ws.id::text = split_part(name, '/', 2)
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    split_part(name, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND split_part(name, '/', 1) = 'workspaces'
        AND ws.id::text = split_part(name, '/', 2)
    )
  )
);

-- ============================================================================
-- 7. DOCUMENTS (private) — owner full control; client scoped to own folder
-- ============================================================================
CREATE POLICY "fd_documents_owner_all"
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

CREATE POLICY "fd_documents_client_select"
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

CREATE POLICY "fd_documents_client_insert"
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

CREATE POLICY "fd_documents_client_update"
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

CREATE POLICY "fd_documents_client_delete"
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
-- 8. DELIVERABLES (private) — owner full control; client READ-ONLY on own folder
-- ============================================================================
CREATE POLICY "fd_deliverables_owner_all"
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

CREATE POLICY "fd_deliverables_client_select"
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
