-- ============================================================================
-- FLOWDESK DATABASE MIGRATION — PHASE 43
-- Storage Buckets Provisioning for Studio Branding (Logos & Signatures)
-- ============================================================================
-- Note: 'storage.objects' is owned by 'supabase_storage_admin' in Supabase.
-- Running 'ALTER TABLE storage.objects' or 'CREATE POLICY ON storage.objects'
-- as the 'postgres' role in the Supabase SQL editor raises ERROR: 42501
-- ("must be owner of table objects").
--
-- In FlowDesk:
-- 1. Storage uploads for logos & signatures are handled via the secure server
--    route (/api/settings/upload), which uses SUPABASE_SERVICE_ROLE_KEY and
--    bypasses storage RLS completely.
-- 2. Once uploaded to public buckets ('logos', 'signatures'), files are
--    publicly accessible via CDN URL without checking storage.objects RLS.
--
-- This script safely provisions and configures the storage buckets.
-- ============================================================================

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

UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'logos', 'signatures');
UPDATE storage.buckets SET public = false WHERE id IN ('documents', 'deliverables');
