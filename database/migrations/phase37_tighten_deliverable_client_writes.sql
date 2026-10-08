-- ============================================================================
-- Phase 37: Tighten Row-Level Security for Deliverables (Phase 5A Batch 2)
-- ============================================================================
-- IMPORTANT NOTICE:
-- DO NOT APPLY THIS MIGRATION YET.
-- This migration removes direct client-side INSERT, UPDATE, and DELETE policies
-- on deliverable tables, transitioning all mutations to secure server route handlers:
--   - POST /api/deliverables/[deliverableId]/approve (Pilot)
--   - POST /api/deliverables/[deliverableId]/submit
--   - POST /api/deliverables/[deliverableId]/revision
--   - POST /api/deliverables/[deliverableId]/versions
--   - POST /api/deliverables/[deliverableId]/comments
--
-- APPLY THIS MIGRATION ONLY AFTER:
-- 1. The server route handlers are deployed and live in production.
-- 2. NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_2=true is verified across all clients.
-- ============================================================================

-- 1. Tighten public.deliverables policies
DROP POLICY IF EXISTS "Freelancer manage workspace deliverables" ON public.deliverables;
DROP POLICY IF EXISTS "Workspace isolation for deliverables" ON public.deliverables;
DROP POLICY IF EXISTS "Freelancer view workspace deliverables" ON public.deliverables;

-- Freelancers can now ONLY SELECT deliverables directly from the browser client.
CREATE POLICY "Freelancer view workspace deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- Ensure client view policy remains intact
DROP POLICY IF EXISTS "Clients can view assigned deliverables" ON public.deliverables;
CREATE POLICY "Clients can view assigned deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.get_auth_client_ids()));

-- 2. Tighten public.deliverable_versions policies
DROP POLICY IF EXISTS "Freelancer manage deliverable versions" ON public.deliverable_versions;
DROP POLICY IF EXISTS "Workspace isolation for deliverable versions" ON public.deliverable_versions;
DROP POLICY IF EXISTS "Freelancer view deliverable versions" ON public.deliverable_versions;

CREATE POLICY "Freelancer view deliverable versions" ON public.deliverable_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND public.is_workspace_owner(d.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Clients view assigned deliverable versions" ON public.deliverable_versions;
CREATE POLICY "Clients view assigned deliverable versions" ON public.deliverable_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- 3. Tighten public.deliverable_comments policies
DROP POLICY IF EXISTS "Freelancer manage deliverable comments" ON public.deliverable_comments;
DROP POLICY IF EXISTS "Clients post deliverable comments" ON public.deliverable_comments;
DROP POLICY IF EXISTS "Freelancer view deliverable comments" ON public.deliverable_comments;

CREATE POLICY "Freelancer view deliverable comments" ON public.deliverable_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND public.is_workspace_owner(d.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Clients view non-internal deliverable comments" ON public.deliverable_comments;
CREATE POLICY "Clients view non-internal deliverable comments" ON public.deliverable_comments
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_comments.deliverable_id
        AND d.client_id IN (SELECT public.get_auth_client_ids())
    )
  );

-- ============================================================================
-- Rollback Instructions for Phase 37:
--
-- To rollback to allowing client-side write access:
-- DROP POLICY IF EXISTS "Freelancer view workspace deliverables" ON public.deliverables;
-- CREATE POLICY "Freelancer manage workspace deliverables" ON public.deliverables
--   FOR ALL TO authenticated
--   USING (public.is_workspace_owner(workspace_id))
--   WITH CHECK (public.is_workspace_owner(workspace_id));
-- ============================================================================
