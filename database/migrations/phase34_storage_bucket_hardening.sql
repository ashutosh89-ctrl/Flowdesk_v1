-- ============================================================
-- Phase 34: Storage Bucket Hardening & Direct Upload Enforcement
-- Sets strict file_size_limit and allowed_mime_types on every Supabase
-- storage bucket so limits hold even if client-side code is bypassed.
-- NOTE: Do NOT apply directly; pending staging review.
-- ============================================================

-- 1. Avatars: Images only, max 2MB (2,097,152 bytes)
UPDATE storage.buckets
SET 
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'avatars';

-- 2. Logos: Images only (SVG strictly disabled), max 2MB (2,097,152 bytes)
UPDATE storage.buckets
SET 
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'logos';

-- 3. Signatures: Images only (SVG strictly disabled), max 2MB (2,097,152 bytes)
UPDATE storage.buckets
SET 
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'signatures';

-- 4. Documents: Documents & safe images, max 25MB (26,214,400 bytes)
UPDATE storage.buckets
SET 
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
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
    'image/png',
    'image/webp',
    'image/gif'
  ]
WHERE id = 'documents';

-- 5. Deliverables: Project deliverables & revisions, max 25MB (26,214,400 bytes)
UPDATE storage.buckets
SET 
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
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
    'image/png',
    'image/webp',
    'image/gif'
  ]
WHERE id = 'deliverables';
