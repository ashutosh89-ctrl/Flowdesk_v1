-- ============================================================================
-- FLOWDESK DATABASE MIGRATION — PHASE 43
-- Storage Buckets & RLS Repair for Studio Branding (Logos & Signatures)
-- ============================================================================
-- Problem addressed:
--   - "new row violates row-level security policy" when uploading logos or signatures
--   - Missing 'signatures' bucket in some environments
--   - Incomplete or overly restrictive policies on storage.objects that blocked
--     upsert or workspace-owner queries during branding asset upload.
--
-- This migration is idempotent and can be safely executed multiple times.
-- ============================================================================

-- 1. Ensure storage buckets exist and are marked public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('logos', 'logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('signatures', 'signatures', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('documents', 'documents', false, 26214400, NULL),
  ('deliverables', 'deliverables', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enforce private visibility on documents and deliverables
UPDATE storage.buckets SET public = false WHERE id IN ('documents', 'deliverables');
UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'logos', 'signatures');

-- 2. Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Clean up legacy conflicting policy names for logos and signatures
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace logos" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace logos canonical" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace signatures" ON storage.objects;
DROP POLICY IF EXISTS "Freelancer can manage workspace signatures canonical" ON storage.objects;
DROP POLICY IF EXISTS "fd_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "fd_logos_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "fd_signatures_public_read" ON storage.objects;
DROP POLICY IF EXISTS "fd_signatures_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "fd_logos_authenticated_manage" ON storage.objects;
DROP POLICY IF EXISTS "fd_signatures_authenticated_manage" ON storage.objects;

-- 4. Public SELECT policy: Anyone can view logos and signatures
-- (Required for displaying branding on invoice PDFs, client portals, and preview)
CREATE POLICY "fd_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "fd_signatures_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

-- 5. Authenticated Manage policy: Authenticated users can upload and manage branding assets
-- Covers INSERT, UPDATE, DELETE, and SELECT for authenticated users
CREATE POLICY "fd_logos_authenticated_manage"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'logos')
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "fd_signatures_authenticated_manage"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'signatures')
WITH CHECK (bucket_id = 'signatures');
