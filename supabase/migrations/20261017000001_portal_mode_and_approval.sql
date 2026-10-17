-- ==============================================================================
-- FLOWDESK DATABASE ARCHITECTURE: PORTAL ACCESS MODES & CLIENT VERIFICATION QUEUE
-- Migration: 20261017000001_portal_mode_and_approval.sql
-- Description:
--   1. Adds portal_mode ('public' | 'private') to public.workspaces.
--   2. Updates client_connections status constraint to support 'rejected'.
--   3. Updates public.get_auth_client_ids() and public.is_client_user()
--      so pending/rejected clients CANNOT access workspace deliverables,
--      invoices, documents, or projects via Row Level Security (RLS).
--   4. Updates public.resolve_freelancer_portal(p_slug) to return portal_mode.
--   5. Updates public.connect_client_to_workspace(p_slug) to enforce Private Mode:
--      - Pre-added clients (created in advance by freelancer) are auto-approved ('active').
--      - Cold joins in Private Mode are assigned status 'pending' and await freelancer approval.
--      - Public Mode allows instant connection ('active').
-- ==============================================================================

-- 1. ADD PORTAL MODE TO WORKSPACES
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS portal_mode TEXT NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspaces_portal_mode_check'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_portal_mode_check CHECK (portal_mode IN ('public', 'private'));
  END IF;
END $$;

-- 2. UPDATE CLIENT CONNECTIONS STATUS CHECK CONSTRAINT
ALTER TABLE public.client_connections
  DROP CONSTRAINT IF EXISTS client_connections_status_check;

ALTER TABLE public.client_connections
  ADD CONSTRAINT client_connections_status_check
  CHECK (status IN ('active', 'disconnected', 'pending', 'rejected'));

-- 3. STRICT RLS ISOLATION FOR PENDING/REJECTED CLIENTS
CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid()
    AND status NOT IN ('pending_deletion', 'pending', 'rejected')
  UNION
  SELECT client_id FROM public.client_connections
  WHERE client_user_id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_client_user(check_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    LEFT JOIN public.client_connections cc ON cc.client_id = c.id
    WHERE c.id = check_client_id
      AND (
        (c.user_id = auth.uid() AND c.status NOT IN ('pending_deletion', 'pending', 'rejected'))
        OR (cc.client_user_id = auth.uid() AND cc.status = 'active')
      )
  );
$$;

-- 4. UPDATE RESOLVE FREELANCER PORTAL RPC (INCLUDES PORTAL_MODE)
CREATE OR REPLACE FUNCTION public.resolve_freelancer_portal(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws RECORD;
  v_prof RECORD;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) < 3 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid portal identifier format');
  END IF;

  SELECT w.id, w.owner_id, w.name, w.logo_url, w.currency, w.is_accepting_connections, w.portal_mode
  INTO v_ws
  FROM public.workspaces w
  WHERE lower(w.portal_slug) = lower(trim(p_slug));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Freelancer portal not found');
  END IF;

  SELECT p.full_name, p.business_name, p.profession, p.avatar_url, p.logo_url
  INTO v_prof
  FROM public.profiles p
  WHERE p.id = v_ws.owner_id;

  RETURN jsonb_build_object(
    'valid', true,
    'slug', trim(p_slug),
    'is_accepting_connections', v_ws.is_accepting_connections,
    'portal_mode', COALESCE(v_ws.portal_mode, 'public'),
    'freelancer_name', COALESCE(v_prof.full_name, 'FlowDesk Freelancer'),
    'studio_name', COALESCE(v_ws.name, v_prof.business_name, 'Studio Workspace'),
    'profession', COALESCE(v_prof.profession, 'Independent Professional'),
    'avatar_url', COALESCE(v_prof.avatar_url, ''),
    'logo_url', COALESCE(v_ws.logo_url, v_prof.logo_url, ''),
    'currency', COALESCE(v_ws.currency, 'USD')
  );
END;
$$;

-- 5. UPDATE CANONICAL CLIENT CONNECT RPC WITH PUBLIC / PRIVATE MODE LOGIC
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
  v_is_pre_added BOOLEAN := false;
  v_target_status TEXT := 'active';
  v_requires_approval BOOLEAN := false;
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
  SELECT id, owner_id, name, is_accepting_connections, COALESCE(portal_mode, 'public') AS portal_mode
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

  -- Check if client was pre-added by freelancer matching email
  IF v_caller_email IS NOT NULL THEN
    SELECT id INTO v_email_client_id
    FROM public.clients
    WHERE workspace_id = v_ws.id
      AND lower(email) = lower(trim(v_caller_email))
      AND status NOT IN ('pending_deletion', 'rejected')
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_email_client_id IS NOT NULL THEN
      v_client_id := v_email_client_id;
      v_is_pre_added := true;
    END IF;
  END IF;

  -- Fallback to existing client row bound to user_id if no email match
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE workspace_id = v_ws.id
      AND user_id = v_caller_id
      AND status NOT IN ('pending_deletion', 'rejected')
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      v_is_pre_added := true;
    END IF;
  END IF;

  -- Determine status based on portal mode and whether client was pre-added
  IF v_ws.portal_mode = 'private' AND NOT v_is_pre_added THEN
    v_target_status := 'pending';
    v_requires_approval := true;
  ELSE
    v_target_status := 'active';
    v_requires_approval := false;
  END IF;

  -- Update existing client row if found, or create new client record
  IF v_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET
      user_id = v_caller_id,
      status = CASE WHEN v_target_status = 'active' THEN 'active' ELSE status END,
      updated_at = now()
    WHERE id = v_client_id;
  ELSE
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
      v_target_status,
      'USD'
    ) RETURNING id INTO v_client_id;
  END IF;

  -- Upsert connection relationship with appropriate status
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
    v_target_status
  )
  ON CONFLICT (client_user_id, workspace_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    status = CASE
      -- If already active, keep active
      WHEN public.client_connections.status = 'active' THEN 'active'
      ELSE EXCLUDED.status
    END,
    disconnected_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id,
    'workspace_id', v_ws.id,
    'studio_name', v_ws.name,
    'status', v_target_status,
    'requires_approval', v_requires_approval
  );
END;
$$;
