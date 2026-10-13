-- ============================================================================
-- Phase 38: Tighten Client & Invitation RLS (Batch 3 Server Mutation Migration)
--
-- IMPORTANT: DO NOT APPLY THIS MIGRATION BEFORE SERVER ROUTES ARE FULLY DEPLOYED
-- AND NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_3 IS ENABLED IN PRODUCTION.
--
-- PURPOSE:
-- Restricts direct client-side INSERT/UPDATE/DELETE operations on public.clients
-- and public.client_invitations.
-- All client provisioning, editing, archiving, deletion, and invitation token
-- generation/revocation are now exclusively orchestrated via authenticated server
-- routes (/api/clients, /api/clients/[id], /api/clients/[id]/invitation).
-- Direct SELECT permissions remain intact for responsive client/freelancer UI reads.
-- ============================================================================

-- 1. Remove direct client-side mutation policy on public.clients
DROP POLICY IF EXISTS "Freelancer manage own workspace clients" ON public.clients;

-- Replace with SELECT-only policy for authenticated workspace owners
CREATE POLICY "Freelancer view own workspace clients" ON public.clients
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_owner(workspace_id));

-- Note: "Clients can view own client profile" (SELECT) remains unchanged.

-- 2. Remove direct client-side mutation policy on public.client_invitations
DROP POLICY IF EXISTS "freelancer_manage_own_invitations" ON public.client_invitations;

-- Replace with SELECT-only policy for authenticated workspace owners
CREATE POLICY "freelancer_view_own_invitations" ON public.client_invitations
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

-- Note: "clients_view_own_claimed_invitation" (SELECT) remains unchanged.

COMMENT ON TABLE public.clients IS 'Workspace clients table. Direct browser writes disabled; all mutations route through /api/clients endpoints.';
COMMENT ON TABLE public.client_invitations IS 'One-time client invitation tokens. Direct browser writes disabled; all tokens created/revoked via /api/clients/[id]/invitation.';
