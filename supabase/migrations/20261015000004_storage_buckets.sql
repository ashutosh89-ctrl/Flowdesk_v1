-- ==============================================================================
-- FLOWDESK STORAGE REBUILD: BUCKET PROVISIONING & CONFIGURATION
-- Migration: 20261015000004_storage_buckets.sql
-- Description: Provisions the 5 required Supabase storage buckets with validated
--              size limits and MIME type rules.
-- Note: Does NOT modify storage.objects (which requires supabase_storage_admin).
-- ==============================================================================

-- 1. PROVISION PUBLIC STORAGE BUCKETS (AVATARS, LOGOS, SIGNATURES)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'logos',
    'logos',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'signatures',
    'signatures',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. PROVISION PRIVATE STORAGE BUCKETS (DOCUMENTS, DELIVERABLES)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'documents',
    'documents',
    false, -- Strictly private, requires signed URLs
    26214400, -- 25 MB
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]
  ),
  (
    'deliverables',
    'deliverables',
    false, -- Strictly private, requires signed URLs
    52428800, -- 50 MB
    ARRAY[
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
