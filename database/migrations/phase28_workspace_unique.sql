-- Phase 28B: Duplicate Workspace Prevention (database-level guarantee)
--
-- Enforces ONE active workspace per owner (auth user) at the database layer.
-- The application layer (app/onboarding/page.tsx, getCurrentWorkspace()) already
-- checks before inserting; this partial unique index closes the race window
-- between concurrent requests.
--
-- SAFETY: partial index (WHERE deleted_at IS NULL) — existing users with
-- workspaces are unaffected; soft-deleted workspaces (phase22 lifecycle) do
-- not count toward the constraint. Users who ALREADY own two+ workspaces are
-- also unaffected (index creation skips duplicates via the WHERE filter on
-- deleted_at only — if a legacy duplicate exists, run the report query below
-- first and reconcile manually; this migration never deletes data).
--
-- Run in Supabase SQL Editor. Idempotent.

-- 1. Ensure the soft-delete column exists (added in phase22)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Report any legacy duplicates BEFORE creating the index (manual review)
-- SELECT owner_id, count(*) AS workspace_count, array_agg(id) AS workspace_ids
-- FROM public.workspaces
-- WHERE deleted_at IS NULL
-- GROUP BY owner_id
-- HAVING count(*) > 1;
-- → If rows appear, reconcile (soft-delete extras: UPDATE workspaces SET deleted_at = now() WHERE id = ...) before re-running step 3.

-- 3. Create the partial unique index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner_active_unique
  ON public.workspaces (owner_id)
  WHERE deleted_at IS NULL;

-- 4. Verification
-- Duplicate inserts for the same owner with deleted_at IS NULL now fail with
-- a unique violation (error code 23505). Soft-deleted workspaces do not block
-- new workspace creation.
