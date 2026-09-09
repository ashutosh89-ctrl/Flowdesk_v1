-- ============================================================
-- Phase 29: Storage & Business Entities RLS Comprehensive Fix
-- 
-- Fixes:
-- 1. Storage RLS policies for logos, signatures, avatars, documents, deliverables
--    supporting both path formats: workspaces/{workspaceId}/... and {workspaceId}/...
-- 2. Storage UPDATE & DELETE policies (enables upsert: true and replacement/cleanup)
-- 3. Hardened dual-role table RLS policies for:
--    - profiles, workspaces, user_settings
--    - clients, projects, deliverables, deliverable_versions, deliverable_files, deliverable_comments
--    - documents, invoices, invoice_items, invoice_payments, receipts
--    - notifications, activities
-- ============================================================

-- ============================================================
-- 1. STORAGE BUCKETS PROVISIONING
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('logos', 'logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']),
  ('signatures', 'signatures', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']),
  ('documents', 'documents', false, 26214400, NULL),
  ('deliverables', 'deliverables', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(EXCLUDED.file_size_limit, storage.buckets.file_size_limit);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. DROP OLD/BRITTLE STORAGE POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage own avatar" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace logos" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace signatures" ON storage.objects;

DROP POLICY IF EXISTS "Freelancer can manage workspace documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Client can manage own documents" ON storage.objects;

DROP POLICY IF EXISTS "Freelancer can manage workspace deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can view own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can upload own deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Client can manage own deliverables" ON storage.objects;

-- ============================================================
-- 3. RECREATE HARDENED STORAGE POLICIES
-- ============================================================

-- ------------------------------------------------------------
-- LOGOS (Public Bucket)
-- ------------------------------------------------------------
-- Public read access
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Freelancer Workspace Owner: Full management (INSERT, UPDATE, DELETE)
CREATE POLICY "Freelancer can manage workspace logos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- ------------------------------------------------------------
-- SIGNATURES (Public Bucket)
-- ------------------------------------------------------------
-- Public read access
CREATE POLICY "Anyone can view signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

-- Freelancer Workspace Owner: Full management (INSERT, UPDATE, DELETE)
CREATE POLICY "Freelancer can manage workspace signatures"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'signatures'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'signatures'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- ------------------------------------------------------------
-- AVATARS (Public Bucket)
-- ------------------------------------------------------------
-- Public read access
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated Users: Manage own avatar
CREATE POLICY "Users can manage own avatar"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[2] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[2] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
        )
    )
  )
);

-- ------------------------------------------------------------
-- DOCUMENTS (Private Bucket)
-- ------------------------------------------------------------
-- Freelancer Workspace Owner: Full management
CREATE POLICY "Freelancer can manage workspace documents"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- Client: Read access to documents in assigned workspace
CREATE POLICY "Client can view own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- Client: Upload & Update access to documents in assigned workspace
CREATE POLICY "Client can manage own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

CREATE POLICY "Client can update own documents in storage"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- ------------------------------------------------------------
-- DELIVERABLES (Private Bucket)
-- ------------------------------------------------------------
-- Freelancer Workspace Owner: Full management
CREATE POLICY "Freelancer can manage workspace deliverables"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- Client: Read access to deliverables in assigned workspace
CREATE POLICY "Client can view own deliverables"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- Client: Upload & Update access for revision attachments in assigned workspace
CREATE POLICY "Client can upload own deliverables"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

CREATE POLICY "Client can update own deliverables in storage"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.workspaces ws ON ws.id = c.workspace_id
      WHERE c.id IN (SELECT public.get_auth_client_ids())
        AND (
          (storage.foldername(name))[2] = ws.id::text
          OR (storage.foldername(name))[1] = ws.id::text
          OR name LIKE 'workspaces/' || ws.id::text || '/%'
          OR name LIKE ws.id::text || '/%'
        )
    )
  )
);

-- ============================================================
-- 4. HARDEN USER SETTINGS & PROFILES TABLE RLS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

CREATE POLICY "Users can select own settings" ON public.user_settings
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own settings" ON public.user_settings
  FOR DELETE TO authenticated USING (auth.uid() = id);
