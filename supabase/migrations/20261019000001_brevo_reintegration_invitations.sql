-- ==============================================================================
-- FLOWDESK DATABASE ARCHITECTURE: BREVO REINTEGRATION, VERIFIED INVITATIONS & NOTIFICATION PREFERENCES
-- Migration: 20261019000001_brevo_reintegration_invitations.sql
-- Description:
--   1. Adds email_invitations (BOOLEAN DEFAULT true) to public.user_settings.
--   2. Updates public.claim_client_invitation RPC to:
--      - Ensure idempotent claim: if invitation was already claimed by the same user, return success.
--      - Synchronously upsert public.client_connections to ensure seamless parity with permanent portal link.
--      - Set client status to 'active' on claim.
--   3. Adds index on email_events (recipient, event_type, status) for suppression checks.
--   4. Adds index on client_invitations (workspace_id, recipient_email, status) for rate-limiting & duplicate prevention.
-- ==============================================================================

-- 1. ADD EMAIL INVITATIONS PREFERENCE TO USER SETTINGS
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_invitations BOOLEAN NOT NULL DEFAULT true;

-- 2. INDEXES FOR DELIVERABILITY & INVITATION DEDUPLICATION
CREATE INDEX IF NOT EXISTS idx_email_events_suppression 
  ON public.email_events(recipient, status);

CREATE INDEX IF NOT EXISTS idx_client_invitations_lookup
  ON public.client_invitations(workspace_id, recipient_email, status);

-- 3. ENHANCED IDEMPOTENT INVITATION CLAIM RPC WITH CLIENT_CONNECTIONS INTEGRATION
CREATE OR REPLACE FUNCTION public.claim_client_invitation(
  p_token_hash TEXT,
  p_user_id UUID,
  p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.client_invitations%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_bound_id UUID;
BEGIN
  IF p_token_hash IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_TOKEN',
      'error', 'Missing required token or user identification.');
  END IF;

  SELECT * INTO v_inv
    FROM public.client_invitations
   WHERE token_hash = p_token_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'INVALID_TOKEN',
      'error', 'This connection link is invalid or does not exist.');
  END IF;

  -- Idempotency check: If this invitation was already claimed by the exact same user, return success
  IF v_inv.status = 'claimed' THEN
    IF v_inv.claimed_by_user_id = p_user_id THEN
      SELECT * INTO v_client FROM public.clients WHERE id = v_inv.client_id;
      RETURN jsonb_build_object(
        'success', true,
        'clientId', v_client.id,
        'workspaceId', v_client.workspace_id,
        'clientName', v_client.name,
        'company', v_client.company,
        'message', 'Connection already established.'
      );
    END IF;

    RETURN jsonb_build_object('success', false, 'errorCode', 'ALREADY_CLAIMED',
      'error', 'This connection link has already been used.');
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'REVOKED',
      'error', 'This connection link has been revoked by the sender.');
  END IF;

  IF v_inv.status = 'expired' OR (v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now()) THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('success', false, 'errorCode', 'EXPIRED',
      'error', 'This connection link has expired.');
  END IF;

  -- Normalized recipient email comparison
  IF v_inv.recipient_email IS NOT NULL AND p_user_email IS NOT NULL
     AND lower(trim(p_user_email)) <> lower(trim(v_inv.recipient_email)) THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'EMAIL_MISMATCH',
      'error', 'The email address of your account does not match the invitation.');
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_inv.client_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'CLIENT_NOT_FOUND',
      'error', 'Associated client record not found.');
  END IF;

  IF v_client.user_id IS NOT NULL AND v_client.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'CLIENT_ALREADY_CONNECTED',
      'error', 'This client connection has already been completed by another user.');
  END IF;

  -- Bind client record to authenticated user and set status to active
  UPDATE public.clients
     SET user_id = p_user_id,
         status = 'active',
         updated_at = now()
   WHERE id = v_client.id
     AND (user_id IS NULL OR user_id = p_user_id)
  RETURNING id INTO v_bound_id;

  IF v_bound_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errorCode', 'CLIENT_ALREADY_CONNECTED',
      'error', 'This client connection has already been completed by another user.');
  END IF;

  -- Mark invitation claimed
  UPDATE public.client_invitations
     SET status = 'claimed', claimed_at = now(), claimed_by_user_id = p_user_id
   WHERE id = v_inv.id;

  -- Synchronously upsert client_connections to reconcile with permanent portal link
  INSERT INTO public.client_connections (
    workspace_id,
    freelancer_user_id,
    client_user_id,
    client_id,
    status,
    connected_at
  ) VALUES (
    v_client.workspace_id,
    v_inv.freelancer_id,
    p_user_id,
    v_client.id,
    'active',
    now()
  )
  ON CONFLICT (client_user_id, workspace_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    status = 'active',
    disconnected_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'clientId', v_client.id,
    'workspaceId', v_client.workspace_id,
    'clientName', v_client.name,
    'company', v_client.company,
    'message', 'Connection established successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_client_invitation(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_client_invitation(TEXT, UUID, TEXT) TO service_role;
