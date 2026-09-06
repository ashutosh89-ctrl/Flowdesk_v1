-- ============================================================
-- Phase 23: Storage Buckets Provisioning & Hardening
-- Ensures all 5 required Supabase Storage buckets exist with
-- exact public/private visibility and robust RLS policies.
-- ============================================================

-- 1. Idempotently insert required storage buckets
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

-- 2. Signatures Storage Policies (if not already existing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can view signatures'
  ) THEN
    CREATE POLICY "Anyone can view signatures"
    ON storage.objects FOR SELECT TO authenticated, anon
    USING (bucket_id = 'signatures');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Freelancer can upload signatures'
  ) THEN
    CREATE POLICY "Freelancer can upload signatures"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'signatures'
      AND (
        EXISTS (
          SELECT 1 FROM public.workspaces ws
          WHERE ws.owner_id = auth.uid()
            AND (storage.foldername(name))[1] = ws.id::text
        )
      )
    );
  END IF;
END $$;
