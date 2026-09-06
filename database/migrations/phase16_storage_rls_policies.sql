-- ============================================================
-- Phase 16: Storage RLS Policies
-- Ensures clients can only access their own files in storage
-- ============================================================

-- ============================================================
-- STORAGE POLICIES
-- ============================================================
-- Supabase Storage uses its own policy system (separate from
-- Postgres RLS). These policies control access to files in
-- storage buckets.
--
-- Storage paths follow the pattern:
--   workspaces/{workspaceId}/{folder}/{filename}
--
-- ============================================================

-- ============================================================
-- DOCUMENTS BUCKET (private)
-- ============================================================

-- Freelancer: full access to own workspace files
CREATE POLICY "Freelancer can manage workspace documents"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    -- Path contains workspace ID that the freelancer owns
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- Client: read-only access to their assigned client files
CREATE POLICY "Client can view own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    -- Path contains workspace ID that the client is assigned to
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- Client: insert (upload) access to their assigned client files
CREATE POLICY "Client can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    -- Path contains workspace ID that the client is assigned to
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- ============================================================
-- DELIVERABLES BUCKET (private)
-- ============================================================

-- Freelancer: full access to own workspace files
CREATE POLICY "Freelancer can manage workspace deliverables"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- Client: read-only access to their assigned client files
CREATE POLICY "Client can view own deliverables"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (storage.foldername(name))[2] = ws.id::text
    )
  )
);

-- ============================================================
-- AVATARS BUCKET (public)
-- ============================================================

-- Anyone can read avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- LOGOS BUCKET (public)
-- ============================================================

-- Anyone can read logos (public bucket)
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'logos');

-- Authenticated users can upload logos to their workspace
CREATE POLICY "Freelancer can upload workspace logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = ws.id::text
    )
  )
);

-- ============================================================
-- SECURITY NOTES
-- ============================================================
--
-- 1. Private buckets (documents, deliverables) require
--    authenticated access and workspace ownership verification.
--
-- 2. Public buckets (avatars, logos) allow read access to
--    authenticated users but restrict write access.
--
-- 3. Storage paths include workspace IDs to prevent
--    cross-workspace file access.
--
-- 4. The storage.foldername() function splits the path
--    into segments. For "workspaces/{wsId}/documents/{file}",
--    foldername returns ['workspaces', '{wsId}', 'documents', '{file}'].
--
-- 5. These policies work in conjunction with the Postgres RLS
--    policies on the metadata tables (documents, deliverables).
--    Both layers must pass for a file to be accessible.
-- ============================================================
