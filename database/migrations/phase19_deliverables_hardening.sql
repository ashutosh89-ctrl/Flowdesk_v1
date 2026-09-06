-- ============================================================
-- Phase 19: Deliverables System Hardening
-- Fixes schema gaps, RLS gaps, and security issues identified
-- in the comprehensive Deliverables audit.
-- ============================================================

-- 1. Add author_id to deliverable_comments for proper attribution
ALTER TABLE public.deliverable_comments
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id);

-- 2. Prevent clients from inserting internal comments via RLS
-- Drop existing client insert policy and recreate with internal check
DROP POLICY IF EXISTS "client_insert_deliverable_comments" ON public.deliverable_comments;

CREATE POLICY "client_insert_deliverable_comments"
  ON public.deliverable_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
    AND is_internal = false
  );

-- 3. Add client UPDATE policy for deliverable_files (pin/unpin)
DROP POLICY IF EXISTS "client_update_deliverable_files" ON public.deliverable_files;

CREATE POLICY "client_update_deliverable_files"
  ON public.deliverable_files FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_files.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- 4. Add deliverable_versions unique constraint to prevent duplicate version numbers
-- Use a conditional unique index to handle existing data
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_version_number
  ON public.deliverable_versions (deliverable_id, version_number);

-- 5. Add client_id to notifications table for client-scoped notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- 6. Add comments_count to deliverables for efficient counting
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;

-- 7. Add files_count to deliverables for efficient counting
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS files_count INT DEFAULT 0;

-- 8. Add review_deadline to deliverables
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS review_deadline DATE;

-- 9. Add submission_message to deliverables
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS submission_message TEXT;

-- 10. Add approval_status to deliverables for separate approval tracking
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- 11. Index for efficient archived filtering
CREATE INDEX IF NOT EXISTS idx_deliverables_status
  ON public.deliverables (workspace_id, status);

-- 12. Index for efficient client deliverable lookups
CREATE INDEX IF NOT EXISTS idx_deliverables_client
  ON public.deliverables (client_id, status);

-- 13. Notifications client RLS - ensure clients can see their notifications
-- Already handled in phase16, but add INSERT policy for freelancer notifications
DROP POLICY IF EXISTS "freelancer_insert_notifications" ON public.notifications;
CREATE POLICY "freelancer_insert_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_owner(workspace_id)
  );
