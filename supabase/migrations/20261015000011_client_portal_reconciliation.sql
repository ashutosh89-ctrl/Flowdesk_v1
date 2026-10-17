-- ==============================================================================
-- FLOWDESK DATABASE ARCHITECTURE: CLIENT PORTAL CANONICAL RECONCILIATION
-- Migration: 20261015000011_client_portal_reconciliation.sql
-- Description:
--   1. Updates clients_select RLS policy to ensure connected client users
--      can always select their canonical client record via client_connections.
--   2. Updates public.connect_client_to_workspace() RPC to prioritize matching
--      freelancer-created client records by email before creating duplicates,
--      ensuring deliverables, projects, and invoices are immediately shared.
-- ==============================================================================

-- 1. UPDATE CLIENTS RLS POLICY
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_owner(workspace_id) OR
    user_id = auth.uid() OR
    id IN (
      SELECT client_id FROM public.client_connections
      WHERE client_user_id = auth.uid() AND status = 'active'
    )
  );

-- 2. UPDATE CANONICAL CLIENT CONNECT RPC
CREATE OR REPLACE FUNCTION public.connect_client_to_workspace(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_email TEXT;
  v_caller_name TEXT;
  v_ws RECORD;
  v_existing_conn RECORD;
  v_client_id UUID;
  v_email_client_id UUID;
BEGIN
  -- Authenticated caller required
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- Extract confirmed email & metadata from auth.users
  SELECT
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
  INTO v_caller_email, v_caller_name
  FROM auth.users
  WHERE id = v_caller_id;

  -- Resolve workspace by permanent slug
  SELECT id, owner_id, name, is_accepting_connections
  INTO v_ws
  FROM public.workspaces
  WHERE lower(portal_slug) = lower(trim(p_slug))
  LIMIT 1;

  IF v_ws.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freelancer portal link does not exist.');
  END IF;

  IF v_ws.is_accepting_connections = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'This freelancer is not currently accepting new connections.');
  END IF;

  -- Block freelancer from connecting to their own workspace as client
  IF v_ws.owner_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot connect to your own workspace as a client.');
  END IF;

  -- Check for existing client row created by freelancer matching caller email
  IF v_caller_email IS NOT NULL THEN
    SELECT id INTO v_email_client_id
    FROM public.clients
    WHERE workspace_id = v_ws.id
      AND lower(email) = lower(trim(v_caller_email))
      AND status != 'pending_deletion'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_email_client_id IS NOT NULL THEN
      v_client_id := v_email_client_id;
      -- Ensure user_id is bound and status active
      UPDATE public.clients
      SET user_id = v_caller_id, status = 'active', updated_at = now()
      WHERE id = v_email_client_id;
    END IF;
  END IF;

  -- Fallback to existing client row bound to user_id if no email match
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE workspace_id = v_ws.id
      AND user_id = v_caller_id
      AND status != 'pending_deletion'
    LIMIT 1;
  END IF;

  -- Create a new client record only if none existed
  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      workspace_id,
      user_id,
      name,
      company,
      email,
      status,
      currency
    ) VALUES (
      v_ws.id,
      v_caller_id,
      COALESCE(v_caller_name, split_part(v_caller_email, '@', 1), 'Client Partner'),
      COALESCE(v_caller_name || ' Workspace', 'Client Organization'),
      COALESCE(v_caller_email, 'client@flowdesk.app'),
      'active',
      'USD'
    ) RETURNING id INTO v_client_id;
  END IF;

  -- Upsert durable connection relationship pointing to canonical client
  INSERT INTO public.client_connections (
    workspace_id,
    freelancer_user_id,
    client_user_id,
    client_id,
    status
  ) VALUES (
    v_ws.id,
    v_ws.owner_id,
    v_caller_id,
    v_client_id,
    'active'
  )
  ON CONFLICT (client_user_id, workspace_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    status = 'active',
    disconnected_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id,
    'workspace_id', v_ws.id,
    'studio_name', v_ws.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_client_to_workspace(TEXT) TO authenticated, service_role;
