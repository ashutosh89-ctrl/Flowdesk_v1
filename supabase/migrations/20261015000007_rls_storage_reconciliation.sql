-- ==============================================================================
-- FLOWDESK RLS: RECONCILED TABLES + SUPABASE STORAGE OBJECT POLICIES
-- Migration: 20261015000007_rls_storage_reconciliation.sql
-- Description: Enables RLS + least-privilege policies for the reconciled tables
--              (email_events, razorpay_orders) and installs storage.objects
--              policies for the five canonical buckets.
--
-- Storage path convention (enforced by src/backend/storage/storage-helper.ts):
--   Private buckets (documents, deliverables):
--     workspaces/<workspaceId>/clients/<clientId>/<uuid>_<filename>
--     workspaces/<workspaceId>/shared/<uuid>_<filename>
--   Public buckets (avatars, logos, signatures):
--     workspaces/<workspaceId>/branding/<uuid>_<filename>
--
-- NOTE: storage.objects is owned by supabase_storage_admin. On Supabase Cloud
-- the SQL editor / CLI migration role may not own storage.objects, so every
-- CREATE POLICY below is wrapped in an exception handler that degrades to a
-- NOTICE instead of aborting the migration. The bucket configuration itself is
-- always provisioned by migration 20261015000004_storage_buckets.sql.
-- ==============================================================================

-- 1. EMAIL EVENTS RLS ---------------------------------------------------------
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_events_select_owner" ON public.email_events;
CREATE POLICY "email_events_select_owner" ON public.email_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workspace_owner(workspace_id));

-- Writes are performed exclusively by the trusted server layer (service role),
-- which bypasses RLS. No authenticated INSERT/UPDATE/DELETE policy is granted,
-- so the default is deny (mirrors the RLS matrix: AUDIT PROTECTED).

-- 2. RAZORPAY ORDERS RLS ------------------------------------------------------
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "razorpay_orders_select" ON public.razorpay_orders;
CREATE POLICY "razorpay_orders_select" ON public.razorpay_orders
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    client_id IN (SELECT public.get_auth_client_ids())
  );

DROP POLICY IF EXISTS "razorpay_orders_manage_owner" ON public.razorpay_orders;
CREATE POLICY "razorpay_orders_manage_owner" ON public.razorpay_orders
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

-- 3. STORAGE OBJECT POLICIES --------------------------------------------------
-- Encapsulated in an exception-safe block: if the executing role does not own
-- storage.objects (Supabase Cloud default), the migration records a notice and
-- continues. Buckets remain provisioned; privileged uploads still run through
-- the service-role server routes.
DO $storage_policies$
BEGIN
  -- 3a. Public buckets: world-readable (avatars, logos, signatures).
  DROP POLICY IF EXISTS "flowdesk_public_buckets_read" ON storage.objects;
  CREATE POLICY "flowdesk_public_buckets_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id IN ('avatars', 'logos', 'signatures'));

  -- 3b. Workspace owners: full control of their own workspace objects.
  DROP POLICY IF EXISTS "flowdesk_owner_manage_objects" ON storage.objects;
  CREATE POLICY "flowdesk_owner_manage_objects" ON storage.objects
    FOR ALL TO authenticated
    USING (
      bucket_id IN ('documents', 'deliverables', 'avatars', 'logos', 'signatures')
      AND (storage.foldername(name))[1] = 'workspaces'
      AND public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
    )
    WITH CHECK (
      bucket_id IN ('documents', 'deliverables', 'avatars', 'logos', 'signatures')
      AND (storage.foldername(name))[1] = 'workspaces'
      AND public.is_workspace_owner(((storage.foldername(name))[2])::uuid)
    );

  -- 3c. Clients: read their own client-scoped document/deliverable objects.
  DROP POLICY IF EXISTS "flowdesk_client_read_objects" ON storage.objects;
  CREATE POLICY "flowdesk_client_read_objects" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id IN ('documents', 'deliverables')
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    );

  -- 3d. Clients: upload into their own client-scoped documents folder only.
  --     Clients may NOT write to deliverables (freelancer-owned output).
  DROP POLICY IF EXISTS "flowdesk_client_insert_documents" ON storage.objects;
  CREATE POLICY "flowdesk_client_insert_documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    );

  -- 3e. Clients: overwrite their own client-scoped document objects on re-upload.
  DROP POLICY IF EXISTS "flowdesk_client_update_documents" ON storage.objects;
  CREATE POLICY "flowdesk_client_update_documents" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    )
    WITH CHECK (
      bucket_id = 'documents'
      AND (storage.foldername(name))[1] = 'workspaces'
      AND (storage.foldername(name))[3] = 'clients'
      AND public.is_client_user(((storage.foldername(name))[4])::uuid)
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipped storage.objects policies (role does not own storage.objects). Apply these via the Supabase Dashboard Storage policy editor or the Supabase CLI.';
END
$storage_policies$;
