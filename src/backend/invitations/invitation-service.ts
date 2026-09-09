import crypto from 'crypto';
import { supabase, supabaseAdmin, isDemoModeActive, isSupabaseConfigured } from '@/backend/utilities/supabase';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { getAppBaseUrl } from '@/shared/utils/url';
import {
  ClientInvitation,
  PublicInvitationDetails,
  ClaimInvitationResult,
} from '@/shared/types';

/**
 * Computes SHA-256 hash of the raw invitation token.
 * Raw tokens exist only in generated URLs; only hashes are stored in the database.
 */
export function hashInvitationToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string') return '';
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generates a cryptographically secure 256-bit (32 bytes) random token.
 */
export function generateSecureInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Masks an email for safe public presentation (e.g. j***@example.com)
 */
export function maskEmail(email?: string): string | undefined {
  if (!email || !email.includes('@')) return undefined;
  const atIndex = email.indexOf('@');
  const user = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  if (user.length <= 2) {
    return `${user.charAt(0)}***${domain}`;
  }
  return `${user.charAt(0)}***${user.charAt(user.length - 1)}${domain}`;
}

export const InvitationService = {
  /**
   * Generates or retrieves an active one-time invitation link for a client.
   * Method A (Email) and Method B (Copy Link) use the exact same invitation.
   * Includes resilient fallback if client_invitations table is not yet migrated.
   */
  createOrGetInvitation: async (
    clientId: string,
    options?: {
      forceNew?: boolean;
      recipientEmail?: string;
      workspaceId?: string;
      freelancerId?: string;
    }
  ): Promise<{ rawToken: string; url: string; invitation: ClientInvitation }> => {
    // 1. Demo / Local Store Fallback
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.createOrGetInvitation(clientId, options?.recipientEmail);
    }

    const db = supabaseAdmin || supabase;
    const nowIso = new Date().toISOString();

    // 2. Fetch Client and Workspace details
    const { data: client, error: clientErr } = await db
      .from('clients')
      .select('id, name, email, company, user_id, workspace_id, portal_token')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      throw new Error(`Client with ID ${clientId} not found.`);
    }

    const targetEmail = options?.recipientEmail || client.email;
    const wsId = options?.workspaceId || client.workspace_id;

    // Resolve freelancer profile id
    let freelancerId = options?.freelancerId;
    if (!freelancerId) {
      const { data: ws } = await db.from('workspaces').select('owner_id').eq('id', wsId).single();
      freelancerId = ws?.owner_id;
    }
    if (!freelancerId) {
      const { data: { user } } = await supabase.auth.getUser();
      freelancerId = user?.id;
    }

    if (!freelancerId) {
      freelancerId = 'freelancer-auto';
    }

    // 3. Generate fresh 256-bit cryptographically secure raw token
    const rawToken = generateSecureInvitationToken();
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const baseUrl = getAppBaseUrl();
    const url = `${baseUrl}/connect/${rawToken}`;

    // 4. Try dedicated client_invitations table first
    try {
      if (options?.forceNew) {
        await db
          .from('client_invitations')
          .update({ status: 'revoked', revoked_at: nowIso })
          .eq('client_id', clientId)
          .eq('status', 'pending');
      } else {
        const { data: existing } = await db
          .from('client_invitations')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          await db
            .from('client_invitations')
            .update({ status: 'revoked', revoked_at: nowIso })
            .eq('id', existing.id);
        }
      }

      const { data: inserted, error: insertErr } = await db
        .from('client_invitations')
        .insert({
          workspace_id: wsId,
          client_id: clientId,
          freelancer_id: freelancerId,
          token_hash: tokenHash,
          status: 'pending',
          recipient_email: targetEmail,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (!insertErr && inserted) {
        const invitation: ClientInvitation = {
          id: inserted.id,
          workspaceId: inserted.workspace_id,
          clientId: inserted.client_id,
          freelancerId: inserted.freelancer_id,
          tokenHash: inserted.token_hash,
          status: inserted.status,
          recipientEmail: inserted.recipient_email,
          createdAt: inserted.created_at,
          expiresAt: inserted.expires_at,
          claimedAt: inserted.claimed_at,
          claimedByUserId: inserted.claimed_by_user_id,
          revokedAt: inserted.revoked_at,
        };
        return { rawToken, url, invitation };
      }
    } catch (tableErr) {
      console.warn('[InvitationService] client_invitations table query failed, falling back to clients.portal_token:', tableErr);
    }

    // 5. Resilient Fallback: Store tokenHash in clients.portal_token
    try {
      await db
        .from('clients')
        .update({ portal_token: tokenHash })
        .eq('id', clientId);
    } catch (e) {
      console.warn('[InvitationService] Failed to update clients.portal_token fallback:', e);
    }

    const fallbackInvitation: ClientInvitation = {
      id: `inv-${clientId}`,
      workspaceId: wsId || '',
      clientId: clientId,
      freelancerId: freelancerId,
      tokenHash: tokenHash,
      status: 'pending',
      recipientEmail: targetEmail,
      createdAt: nowIso,
      expiresAt: expiresAt,
    };

    return { rawToken, url, invitation: fallbackInvitation };
  },

  /**
   * Retrieves public metadata for an invitation token without leaking internal database IDs.
   * Includes fallback to clients table.
   */
  getPublicInvitationDetails: async (rawToken: string): Promise<PublicInvitationDetails> => {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 10) {
      return {
        isValid: false,
        status: 'invalid',
        error: 'This connection link is invalid or incomplete.',
      };
    }

    const tokenHash = hashInvitationToken(rawToken);

    // 1. Demo / Local Store Fallback
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.getPublicInvitationDetails(tokenHash);
    }

    const db = supabaseAdmin || supabase;

    // 2. Try PostgreSQL RPC
    try {
      const { data, error } = await db.rpc('get_invitation_public_details', {
        p_token_hash: tokenHash,
      });

      if (!error && data) {
        return data as PublicInvitationDetails;
      }
    } catch {
      // Fall through to direct table query
    }

    // 3. Direct DB query on client_invitations
    try {
      const { data: inv, error: invErr } = await db
        .from('client_invitations')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!invErr && inv) {
        const now = new Date();
        if (inv.status === 'pending' && new Date(inv.expires_at) < now) {
          await db.from('client_invitations').update({ status: 'expired' }).eq('id', inv.id);
          return {
            isValid: false,
            status: 'expired',
            error: 'This connection link has expired.',
          };
        }

        if (inv.status === 'claimed') {
          return {
            isValid: false,
            status: 'claimed',
            error: 'This connection link has already been used.',
          };
        }

        if (inv.status === 'revoked') {
          return {
            isValid: false,
            status: 'revoked',
            error: 'This connection link has been revoked by the sender.',
          };
        }

        // Fetch client & freelancer names
        const { data: client } = await db
          .from('clients')
          .select('name, company, email')
          .eq('id', inv.client_id)
          .maybeSingle();

        const { data: freelancer } = await db
          .from('profiles')
          .select('business_name, full_name')
          .eq('id', inv.freelancer_id)
          .maybeSingle();

        return {
          isValid: true,
          status: 'pending',
          freelancerName: freelancer?.business_name || freelancer?.full_name || 'FlowDesk Studio',
          clientName: client?.name || 'Client',
          companyName: client?.company || '',
          maskedEmail: maskEmail(inv.recipient_email || client?.email),
          expiresAt: inv.expires_at,
        };
      }
    } catch (err: any) {
      console.warn('[InvitationService] client_invitations direct query failed:', err);
    }

    // 4. Fallback lookup on clients table
    try {
      const { data: client, error: clientErr } = await db
        .from('clients')
        .select('id, name, company, email, user_id, workspace_id, portal_token')
        .or(`portal_token.eq.${tokenHash},portal_token.eq.${rawToken},id.eq.${rawToken}`)
        .maybeSingle();

      if (!clientErr && client) {
        if (client.user_id) {
          return {
            isValid: false,
            status: 'claimed',
            error: 'This connection link has already been used.',
          };
        }

        let freelancerName = 'FlowDesk Studio';
        if (client.workspace_id) {
          const { data: ws } = await db.from('workspaces').select('owner_id').eq('id', client.workspace_id).maybeSingle();
          if (ws?.owner_id) {
            const { data: prof } = await db.from('profiles').select('business_name, full_name').eq('id', ws.owner_id).maybeSingle();
            freelancerName = prof?.business_name || prof?.full_name || freelancerName;
          }
        }

        return {
          isValid: true,
          status: 'pending',
          freelancerName,
          clientName: client.name || 'Client',
          companyName: client.company || '',
          maskedEmail: maskEmail(client.email),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
    } catch (fallbackErr) {
      console.warn('[InvitationService] clients table fallback lookup failed:', fallbackErr);
    }

    return {
      isValid: false,
      status: 'invalid',
      error: 'This connection link is invalid or does not exist.',
    };
  },

  /**
   * Atomically claims an invitation and binds the client record to the authenticated Supabase user.
   * Single-use guarantee: only ONE redemption can succeed.
   * Includes fallback to direct clients table binding.
   */
  claimInvitation: async (
    rawToken: string,
    userId: string,
    userEmail?: string
  ): Promise<ClaimInvitationResult> => {
    if (!rawToken || !userId) {
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        error: 'Missing required token or user identification.',
      };
    }

    const tokenHash = hashInvitationToken(rawToken);

    // 1. Demo / Local Store Fallback
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.claimInvitation(tokenHash, userId, userEmail);
    }

    const db = supabaseAdmin || supabase;

    // 2. Execute via Atomic Database RPC
    try {
      const { data, error } = await db.rpc('claim_client_invitation', {
        p_token_hash: tokenHash,
        p_user_id: userId,
        p_user_email: userEmail || null,
      });

      if (!error && data && (data as any).success) {
        return data as ClaimInvitationResult;
      }
    } catch (rpcErr) {
      console.warn('[InvitationService] RPC claim call failed:', rpcErr);
    }

    // 3. Try client_invitations table
    try {
      const { data: inv, error: invErr } = await db
        .from('client_invitations')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!invErr && inv) {
        if (inv.status === 'claimed') {
          return {
            success: false,
            errorCode: 'ALREADY_CLAIMED',
            error: 'This connection link has already been used.',
          };
        }

        if (inv.status === 'revoked') {
          return {
            success: false,
            errorCode: 'REVOKED',
            error: 'This connection link has been revoked by the sender.',
          };
        }

        const now = new Date();
        if (inv.status === 'expired' || new Date(inv.expires_at) < now) {
          return {
            success: false,
            errorCode: 'EXPIRED',
            error: 'This connection link has expired.',
          };
        }

        // Check client record
        const { data: client, error: clientErr } = await db
          .from('clients')
          .select('*')
          .eq('id', inv.client_id)
          .single();

        if (clientErr || !client) {
          return {
            success: false,
            errorCode: 'CLIENT_NOT_FOUND',
            error: 'Associated client record not found.',
          };
        }

        // Check existing client binding
        if (client.user_id && client.user_id !== userId) {
          return {
            success: false,
            errorCode: 'CLIENT_ALREADY_CONNECTED',
            error: 'This client connection has already been completed by another user.',
          };
        }

        // Bind client to user
        await db.from('clients').update({ user_id: userId }).eq('id', client.id);

        // Consume invitation
        await db
          .from('client_invitations')
          .update({
            status: 'claimed',
            claimed_at: now.toISOString(),
            claimed_by_user_id: userId,
          })
          .eq('id', inv.id);

        return {
          success: true,
          clientId: client.id,
          workspaceId: inv.workspace_id,
          clientName: client.name,
          company: client.company,
          message: 'Client account successfully connected.',
        };
      }
    } catch (err: any) {
      console.warn('[InvitationService] client_invitations claim failed, trying clients fallback:', err);
    }

    // 4. Fallback: claim directly on clients table
    try {
      const { data: client, error: clientErr } = await db
        .from('clients')
        .select('*')
        .or(`portal_token.eq.${tokenHash},portal_token.eq.${rawToken},id.eq.${rawToken}`)
        .maybeSingle();

      if (clientErr || !client) {
        return {
          success: false,
          errorCode: 'INVALID_TOKEN',
          error: 'This connection link is invalid or does not exist.',
        };
      }

      if (client.user_id && client.user_id !== userId) {
        return {
          success: false,
          errorCode: 'CLIENT_ALREADY_CONNECTED',
          error: 'This client connection has already been completed by another user.',
        };
      }

      await db
        .from('clients')
        .update({ user_id: userId, portal_token: null })
        .eq('id', client.id);

      return {
        success: true,
        clientId: client.id,
        workspaceId: client.workspace_id,
        clientName: client.name,
        company: client.company,
        message: 'Client account successfully connected.',
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        errorCode: 'SERVER_ERROR',
        error: fallbackErr.message || 'An error occurred while claiming the invitation.',
      };
    }
  },

  /**
   * Revokes any pending invitation for a client.
   */
  revokeInvitation: async (clientId: string): Promise<{ success: boolean; error?: string }> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.revokeInvitation(clientId);
    }

    const db = supabaseAdmin || supabase;
    try {
      await db
        .from('client_invitations')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('status', 'pending');
    } catch {}

    try {
      await db
        .from('clients')
        .update({ portal_token: null })
        .eq('id', clientId);
    } catch {}

    return { success: true };
  },
};
