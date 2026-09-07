-- ============================================================
-- Phase 27: Client Connection Invitations & One-Time Hardening
-- Cryptographic Token Hashing, Atomic Transactional Claim,
-- Anti-Tamper Isolation, and Supabase User Identity Binding
-- ============================================================

-- 1. Create client_invitations table
CREATE TABLE IF NOT EXISTS public.client_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'revoked')),
  recipient_email TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '7 days') NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ
);

-- 2. Indexes for high-performance lookups & isolation
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_invitations_token_hash 
  ON public.client_invitations (token_hash);

CREATE INDEX IF NOT EXISTS idx_client_invitations_client_status 
  ON public.client_invitations (client_id, status);

CREATE INDEX IF NOT EXISTS idx_client_invitations_workspace 
  ON public.client_invitations (workspace_id);

CREATE INDEX IF NOT EXISTS idx_client_invitations_expires_at 
  ON public.client_invitations (expires_at) 
  WHERE status = 'pending';

-- 3. Row Level Security (RLS)
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freelancer_manage_own_invitations" ON public.client_invitations;
CREATE POLICY "freelancer_manage_own_invitations"
  ON public.client_invitations FOR ALL
  TO authenticated
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "clients_view_own_claimed_invitation" ON public.client_invitations;
CREATE POLICY "clients_view_own_claimed_invitation"
  ON public.client_invitations FOR SELECT
  TO authenticated
  USING (
    claimed_by_user_id = auth.uid()
  );

-- 4. Secure Public Invitation Details Lookup (No Database ID Leakage)
CREATE OR REPLACE FUNCTION public.get_invitation_public_details(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_client RECORD;
  v_freelancer RECORD;
  v_masked_email TEXT;
  v_at_idx INT;
  v_user_part TEXT;
  v_domain_part TEXT;
BEGIN
  IF p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'invalid', 'error', 'Invalid invitation token.');
  END IF;

  SELECT * INTO v_invitation
  FROM public.client_invitations
  WHERE token_hash = p_token_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'invalid', 'error', 'This connection link is invalid or does not exist.');
  END IF;

  -- Check expiration
  IF v_invitation.status = 'pending' AND v_invitation.expires_at < timezone('utc'::text, now()) THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('isValid', false, 'status', 'expired', 'error', 'This connection link has expired.');
  END IF;

  IF v_invitation.status = 'claimed' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'claimed', 'error', 'This connection link has already been used.');
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object('isValid', false, 'status', 'revoked', 'error', 'This connection link has been revoked by the sender.');
  END IF;

  -- Resolve client & freelancer context
  SELECT name, company, email INTO v_client FROM public.clients WHERE id = v_invitation.client_id;
  SELECT full_name, business_name INTO v_freelancer FROM public.profiles WHERE id = v_invitation.freelancer_id;

  -- Mask recipient email (e.g., j***@example.com)
  v_masked_email := NULL;
  IF v_invitation.recipient_email IS NOT NULL AND v_invitation.recipient_email LIKE '%@%' THEN
    v_at_idx := position('@' in v_invitation.recipient_email);
    v_user_part := substring(v_invitation.recipient_email from 1 for v_at_idx - 1);
    v_domain_part := substring(v_invitation.recipient_email from v_at_idx);
    IF length(v_user_part) > 2 THEN
      v_masked_email := substring(v_user_part from 1 for 1) || '***' || substring(v_user_part from length(v_user_part) for 1) || v_domain_part;
    ELSE
      v_masked_email := substring(v_user_part from 1 for 1) || '***' || v_domain_part;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'isValid', true,
    'status', 'pending',
    'freelancerName', COALESCE(v_freelancer.business_name, v_freelancer.full_name, 'FlowDesk Studio'),
    'clientName', COALESCE(v_client.name, 'Client'),
    'companyName', COALESCE(v_client.company, ''),
    'maskedEmail', v_masked_email,
    'expiresAt', v_invitation.expires_at
  );
END;
$$;

-- 5. Atomic Transactional Invitation Claim RPC: claim_client_invitation
CREATE OR REPLACE FUNCTION public.claim_client_invitation(
  p_token_hash TEXT,
  p_user_id UUID,
  p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_client RECORD;
  v_existing_client RECORD;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  -- 1. Validate inputs
  IF p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVALID_TOKEN',
      'error', 'Invitation token hash is required.'
    );
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'UNAUTHORIZED',
      'error', 'Authenticated user identity is required to claim an invitation.'
    );
  END IF;

  -- 2. Row-Level Lock on Invitation: SELECT ... FOR UPDATE (prevents concurrent race conditions)
  SELECT * INTO v_invitation
  FROM public.client_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'INVALID_TOKEN',
      'error', 'This connection link is invalid or does not exist.'
    );
  END IF;

  -- 3. Validate Status
  IF v_invitation.status = 'claimed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'ALREADY_CLAIMED',
      'error', 'This connection link has already been used.'
    );
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'REVOKED',
      'error', 'This connection link has been revoked by the sender.'
    );
  END IF;

  IF v_invitation.status = 'expired' OR v_invitation.expires_at < v_now THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'EXPIRED',
      'error', 'This connection link has expired.'
    );
  END IF;

  -- 4. Row-Level Lock on Target Client Record: SELECT ... FOR UPDATE
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = v_invitation.client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'CLIENT_NOT_FOUND',
      'error', 'The target client record could not be found.'
    );
  END IF;

  -- 5. Existing Client Protection: Do not overwrite existing user binding
  IF v_client.user_id IS NOT NULL AND v_client.user_id <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'CLIENT_ALREADY_CONNECTED',
      'error', 'This client connection has already been completed by another user.'
    );
  END IF;

  -- 6. Atomically bind client record to authenticated user
  UPDATE public.clients
  SET 
    user_id = p_user_id,
    updated_at = v_now
  WHERE id = v_invitation.client_id;

  -- 7. Atomically consume invitation (mark claimed)
  UPDATE public.client_invitations
  SET 
    status = 'claimed',
    claimed_at = v_now,
    claimed_by_user_id = p_user_id
  WHERE id = v_invitation.id;

  -- 8. Revoke any other pending invitations for this client
  UPDATE public.client_invitations
  SET 
    status = 'revoked',
    revoked_at = v_now
  WHERE client_id = v_invitation.client_id
    AND id <> v_invitation.id
    AND status = 'pending';

  -- 9. Log activity
  INSERT INTO public.activities (
    workspace_id,
    user_id,
    client_id,
    action,
    title,
    description,
    user_name,
    resource_type,
    resource_id
  ) VALUES (
    v_invitation.workspace_id,
    p_user_id,
    v_invitation.client_id,
    'claimed_invitation',
    'Client Connected',
    'Client account was successfully connected via one-time connection link.',
    COALESCE(p_user_email, v_client.email, 'Client'),
    'client_invitation',
    v_invitation.id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'clientId', v_invitation.client_id,
    'workspaceId', v_invitation.workspace_id,
    'clientName', v_client.name,
    'company', v_client.company,
    'message', 'Client account successfully connected.'
  );
END;
$$;
