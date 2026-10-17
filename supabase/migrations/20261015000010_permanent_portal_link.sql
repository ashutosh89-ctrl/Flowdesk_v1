-- ==============================================================================
-- FLOWDESK DATABASE ARCHITECTURE: PERMANENT CLIENT PORTAL LINK & MULTI-FREELANCER CONNECTIONS
-- Migration: 20261015000010_permanent_portal_link.sql
-- Description:
--   1. Adds unique, stable, high-entropy portal_slug and is_accepting_connections
--      to public.workspaces.
--   2. Auto-generates high-entropy public identifiers for workspaces.
--   3. Creates public.client_connections table supporting many-to-many relationships
--      between authenticated clients and multiple independent freelancers/workspaces.
--   4. Configures Row Level Security (RLS) policies for cross-workspace isolation.
--   5. Updates public.get_auth_client_ids() and public.is_client_user() to recognize
--      authorized client connections.
--   6. Provides secure RPC functions:
--      - public.resolve_freelancer_portal(p_slug TEXT) -> safe public metadata only
--      - public.connect_client_to_workspace(p_slug TEXT) -> atomic, idempotent connection
-- ==============================================================================

-- 1. ADD PORTAL SLUG AND CONNECTION SETTINGS TO WORKSPACES
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS portal_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_accepting_connections BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing workspaces that do not yet have a portal_slug
UPDATE public.workspaces
SET portal_slug = 'fd_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 16))
WHERE portal_slug IS NULL OR portal_slug = '';

-- Ensure non-null and unique constraint on portal_slug
ALTER TABLE public.workspaces
  ALTER COLUMN portal_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_portal_slug ON public.workspaces(portal_slug);

-- Auto-provision portal_slug on workspace creation if not supplied
CREATE OR REPLACE FUNCTION public.generate_workspace_portal_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.portal_slug IS NULL OR NEW.portal_slug = '' THEN
    NEW.portal_slug := 'fd_' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_portal_slug ON public.workspaces;
CREATE TRIGGER trg_workspace_portal_slug
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_workspace_portal_slug();

-- 2. CLIENT CONNECTIONS (MANY-TO-MANY FREELANCER-CLIENT RELATIONSHIP)
CREATE TABLE IF NOT EXISTS public.client_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  freelancer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'pending')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_workspace_connection UNIQUE (client_user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_client_conn_workspace_id ON public.client_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_client_user_id ON public.client_connections(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_freelancer_user_id ON public.client_connections(freelancer_user_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_client_id ON public.client_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_client_conn_status ON public.client_connections(status);

-- Backfill active client records that have user_id set
INSERT INTO public.client_connections (workspace_id, freelancer_user_id, client_user_id, client_id, status, connected_at)
SELECT
  c.workspace_id,
  w.owner_id,
  c.user_id,
  c.id,
  'active',
  c.created_at
FROM public.clients c
JOIN public.workspaces w ON w.id = c.workspace_id
WHERE c.user_id IS NOT NULL
  AND c.status != 'pending_deletion'
  AND c.deleted_at IS NULL
ON CONFLICT (client_user_id, workspace_id) DO NOTHING;

-- 3. ROW-LEVEL SECURITY POLICIES FOR CLIENT CONNECTIONS
ALTER TABLE public.client_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_connections_select" ON public.client_connections;
CREATE POLICY "client_connections_select" ON public.client_connections
  FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid() OR
    freelancer_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "client_connections_insert" ON public.client_connections;
CREATE POLICY "client_connections_insert" ON public.client_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    client_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "client_connections_update" ON public.client_connections;
CREATE POLICY "client_connections_update" ON public.client_connections
  FOR UPDATE TO authenticated
  USING (
    client_user_id = auth.uid() OR
    freelancer_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  )
  WITH CHECK (
    client_user_id = auth.uid() OR
    freelancer_user_id = auth.uid() OR
    public.is_workspace_owner(workspace_id)
  );

DROP POLICY IF EXISTS "client_connections_delete" ON public.client_connections;
CREATE POLICY "client_connections_delete" ON public.client_connections
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- 4. UPDATE AUTHORIZATION FUNCTIONS TO RECOGNIZE CLIENT CONNECTIONS
CREATE OR REPLACE FUNCTION public.get_auth_client_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.clients
  WHERE user_id = auth.uid()
    AND status != 'pending_deletion'
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
      AND (c.user_id = auth.uid() OR (cc.client_user_id = auth.uid() AND cc.status = 'active'))
      AND c.status != 'pending_deletion'
  );
$$;

-- 5. PUBLIC RPC: RESOLVE FREELANCER PORTAL LINK (SAFE PUBLIC METADATA ONLY)
--    Never exposes database UUIDs, emails, private client details or credentials.
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

  SELECT w.id, w.owner_id, w.name, w.logo_url, w.currency, w.is_accepting_connections
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
    'freelancer_name', COALESCE(v_prof.full_name, 'FlowDesk Freelancer'),
    'studio_name', COALESCE(v_ws.name, v_prof.business_name, 'Studio Workspace'),
    'profession', COALESCE(v_prof.profession, 'Independent Professional'),
    'avatar_url', COALESCE(v_prof.avatar_url, ''),
    'logo_url', COALESCE(v_ws.logo_url, v_prof.logo_url, ''),
    'currency', COALESCE(v_ws.currency, 'USD')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_freelancer_portal(TEXT) TO anon, authenticated, service_role;

-- 6. ATOMIC & IDEMPOTENT CLIENT CONNECTION RPC
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
  v_client_id UUID;
  v_existing_conn RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to connect workspace');
  END IF;

  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_caller_email, v_caller_name
  FROM auth.users
  WHERE id = v_caller_id;

  SELECT w.id, w.owner_id, w.name, w.is_accepting_connections
  INTO v_ws
  FROM public.workspaces w
  WHERE lower(w.portal_slug) = lower(trim(p_slug));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freelancer portal link does not exist');
  END IF;

  IF NOT v_ws.is_accepting_connections THEN
    RETURN jsonb_build_object('success', false, 'error', 'This freelancer is not currently accepting new connections');
  END IF;

  IF v_ws.owner_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot connect to your own workspace as a client');
  END IF;

  -- Check if an active connection already exists
  SELECT cc.id, cc.client_id, cc.status
  INTO v_existing_conn
  FROM public.client_connections cc
  WHERE cc.client_user_id = v_caller_id
    AND cc.workspace_id = v_ws.id;

  IF FOUND THEN
    IF v_existing_conn.status = 'active' THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_connected', true,
        'client_id', v_existing_conn.client_id,
        'workspace_id', v_ws.id,
        'studio_name', v_ws.name
      );
    ELSE
      -- Reactivate disconnected connection
      UPDATE public.client_connections
      SET status = 'active', disconnected_at = NULL, updated_at = now()
      WHERE id = v_existing_conn.id;

      RETURN jsonb_build_object(
        'success', true,
        'reconnected', true,
        'client_id', v_existing_conn.client_id,
        'workspace_id', v_ws.id,
        'studio_name', v_ws.name
      );
    END IF;
  END IF;

  -- Resolve or create client row for this workspace
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE workspace_id = v_ws.id
    AND user_id = v_caller_id
    AND status != 'pending_deletion'
  LIMIT 1;

  IF v_client_id IS NULL AND v_caller_email IS NOT NULL THEN
    -- Check for an unbound client matching confirmed email
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE workspace_id = v_ws.id
      AND user_id IS NULL
      AND lower(email) = lower(v_caller_email)
      AND status != 'pending_deletion'
    LIMIT 1;

    IF v_client_id IS NOT NULL THEN
      UPDATE public.clients
      SET user_id = v_caller_id, updated_at = now()
      WHERE id = v_client_id;
    END IF;
  END IF;

  -- Create a new client record if none existed
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

  -- Create durable connection relationship
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
