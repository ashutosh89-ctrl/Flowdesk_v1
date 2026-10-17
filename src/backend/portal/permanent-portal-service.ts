import { supabase, isDemoModeActive, supabaseAdmin } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import {
  PermanentPortalDetails,
  PermanentPortalConnectResult,
  ConnectedFreelancerWorkspace,
} from '@/shared/types';
import { getCurrentWorkspace, updateWorkspacePortalSettings } from '@/backend/utilities/workspace';

const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

export const PermanentPortalService = {
  /**
   * Resolves public freelancer portal details from permanent identifier.
   * Never exposes internal UUIDs, client data, or secrets.
   */
  resolvePermanentPortal: async (slug: string): Promise<PermanentPortalDetails> => {
    if (!slug || typeof slug !== 'string' || !SLUG_REGEX.test(slug.trim())) {
      return {
        valid: false,
        error: 'Invalid portal identifier format.',
      };
    }

    const cleanSlug = slug.trim().toLowerCase();

    // Demo Mode Handling
    if (isDemoModeActive()) {
      return {
        valid: true,
        slug: cleanSlug,
        isAcceptingConnections: true,
        freelancerName: 'Alex Rivera',
        studioName: 'FlowDesk Studio',
        profession: 'Brand & Product Designer',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        logoUrl: '',
        currency: 'USD',
      };
    }

    try {
      // 1. Try public PostgreSQL RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('resolve_freelancer_portal', {
        p_slug: cleanSlug,
      });

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const res = rpcData as any;
        if (!res.valid) {
          return { valid: false, error: res.error || 'Freelancer portal not found.' };
        }
        return {
          valid: true,
          slug: cleanSlug,
          isAcceptingConnections: res.is_accepting_connections !== false,
          freelancerName: res.freelancer_name || 'FlowDesk Freelancer',
          studioName: res.studio_name || 'Studio Workspace',
          profession: res.profession || 'Independent Professional',
          avatarUrl: res.avatar_url || '',
          logoUrl: res.logo_url || '',
          currency: res.currency || 'USD',
        };
      }

      // 2. Direct fallback query via Supabase
      const { data: wsData, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, owner_id, name, logo_url, currency, is_accepting_connections, portal_slug')
        .ilike('portal_slug', cleanSlug)
        .maybeSingle();

      if (wsErr || !wsData) {
        return {
          valid: false,
          error: 'This connection link does not exist or has been disabled.',
        };
      }

      const { data: profData } = await supabase
        .from('profiles')
        .select('full_name, business_name, profession, avatar_url, logo_url')
        .eq('id', wsData.owner_id)
        .maybeSingle();

      return {
        valid: true,
        slug: cleanSlug,
        isAcceptingConnections: wsData.is_accepting_connections !== false,
        freelancerName: profData?.full_name || 'FlowDesk Freelancer',
        studioName: wsData.name || profData?.business_name || 'Studio Workspace',
        profession: profData?.profession || 'Independent Professional',
        avatarUrl: profData?.avatar_url || '',
        logoUrl: wsData.logo_url || profData?.logo_url || '',
        currency: wsData.currency || 'USD',
      };
    } catch (err: any) {
      logger.error('Failed to resolve permanent portal link', { error: err.message, slug });
      return {
        valid: false,
        error: 'Unable to verify connection link at this time.',
      };
    }
  },

  /**
   * Checks if an authenticated user is already connected or owns this workspace.
   */
  checkConnectionStatus: async (
    slug: string,
    userId: string
  ): Promise<{ isConnected: boolean; isOwner: boolean; clientId?: string; studioName?: string; error?: string }> => {
    if (!slug || !userId) {
      return { isConnected: false, isOwner: false };
    }

    if (isDemoModeActive()) {
      return {
        isConnected: userId === 'usr-demo-client',
        isOwner: userId === 'usr-demo' || userId === 'usr-demo-alex',
        clientId: 'cli-demo-001',
        studioName: 'FlowDesk Studio',
      };
    }

    try {
      const cleanSlug = slug.trim().toLowerCase();
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('id, owner_id, name')
        .ilike('portal_slug', cleanSlug)
        .maybeSingle();

      if (!wsData) {
        return { isConnected: false, isOwner: false, error: 'Workspace not found' };
      }

      if (wsData.owner_id === userId) {
        return { isConnected: false, isOwner: true, studioName: wsData.name };
      }

      // Check client_connections table
      const { data: conn } = await supabase
        .from('client_connections')
        .select('client_id, status')
        .eq('client_user_id', userId)
        .eq('workspace_id', wsData.id)
        .maybeSingle();

      if (conn && conn.status === 'active') {
        return { isConnected: true, isOwner: false, clientId: conn.client_id, studioName: wsData.name };
      }

      // Check clients table direct user_id match
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, status')
        .eq('workspace_id', wsData.id)
        .eq('user_id', userId)
        .neq('status', 'pending_deletion')
        .maybeSingle();

      if (clientRow) {
        return { isConnected: true, isOwner: false, clientId: clientRow.id, studioName: wsData.name };
      }

      return { isConnected: false, isOwner: false, studioName: wsData.name };
    } catch (err: any) {
      return { isConnected: false, isOwner: false, error: err.message };
    }
  },

  /**
   * Connects an authenticated client to a freelancer workspace via permanent portal link.
   * Idempotent: repeated connections succeed without duplicating records.
   */
  connectClient: async (slug: string, userId: string): Promise<PermanentPortalConnectResult> => {
    if (!slug || !SLUG_REGEX.test(slug.trim())) {
      return { success: false, error: 'Invalid portal identifier.' };
    }
    if (!userId) {
      return { success: false, error: 'Authentication required to connect.' };
    }

    const cleanSlug = slug.trim().toLowerCase();

    // Demo Mode handling
    if (isDemoModeActive()) {
      return {
        success: true,
        clientId: 'cli-demo-001',
        workspaceId: 'ws-demo-001',
        studioName: 'FlowDesk Studio',
        alreadyConnected: false,
      };
    }

    try {
      // 1. Try atomic database RPC
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('connect_client_to_workspace', {
        p_slug: cleanSlug,
      });

      if (!rpcErr && rpcResult && typeof rpcResult === 'object') {
        const res = rpcResult as any;
        if (!res.success) {
          return { success: false, error: res.error || 'Connection failed.' };
        }
        return {
          success: true,
          clientId: res.client_id,
          workspaceId: res.workspace_id,
          studioName: res.studio_name,
          alreadyConnected: Boolean(res.already_connected),
          reconnected: Boolean(res.reconnected),
        };
      }

      // 2. Direct server fallback if RPC not installed yet
      const client = supabaseAdmin || supabase;
      const { data: ws, error: wsError } = await client
        .from('workspaces')
        .select('id, owner_id, name, is_accepting_connections')
        .ilike('portal_slug', cleanSlug)
        .maybeSingle();

      if (wsError || !ws) {
        return { success: false, error: 'Freelancer portal link does not exist.' };
      }

      if (ws.is_accepting_connections === false) {
        return { success: false, error: 'This freelancer is not currently accepting new connections.' };
      }

      if (ws.owner_id === userId) {
        return { success: false, error: 'You cannot connect to your own workspace as a client.' };
      }

      // Check existing connection in client_connections
      const { data: existingConn } = await client
        .from('client_connections')
        .select('*')
        .eq('workspace_id', ws.id)
        .eq('client_user_id', userId)
        .maybeSingle();

      if (existingConn && existingConn.status === 'active') {
        return {
          success: true,
          clientId: existingConn.client_id,
          workspaceId: ws.id,
          studioName: ws.name,
          alreadyConnected: true,
        };
      }

      // Check or create client record
      let resolvedClientId: string = existingConn?.client_id || '';

      if (!resolvedClientId) {
        const { data: existingClient } = await client
          .from('clients')
          .select('id')
          .eq('workspace_id', ws.id)
          .eq('user_id', userId)
          .neq('status', 'pending_deletion')
          .maybeSingle();

        if (existingClient) {
          resolvedClientId = existingClient.id;
        } else {
          // Resolve user info from auth
          const { data: userData } = await client.auth.admin?.getUserById(userId) || { data: { user: null } };
          const userMeta = userData?.user?.user_metadata || {};
          const userEmail = userData?.user?.email || 'client@flowdesk.app';
          const userName = userMeta.full_name || userEmail.split('@')[0];

          const { data: newClient, error: clientCreateErr } = await client
            .from('clients')
            .insert({
              workspace_id: ws.id,
              user_id: userId,
              name: userName,
              company: `${userName} Workspace`,
              email: userEmail,
              status: 'active',
              currency: 'USD',
            })
            .select('id')
            .single();

          if (clientCreateErr || !newClient) {
            return { success: false, error: clientCreateErr?.message || 'Failed to initialize client profile.' };
          }
          resolvedClientId = newClient.id;
        }
      }

      // Upsert client_connections
      await client.from('client_connections').upsert(
        {
          workspace_id: ws.id,
          freelancer_user_id: ws.owner_id,
          client_user_id: userId,
          client_id: resolvedClientId,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_user_id,workspace_id' }
      );

      logger.info('CLIENT_PORTAL_CONNECTED', {
        userId,
        workspaceId: ws.id,
        clientId: resolvedClientId,
        slug: cleanSlug,
      });

      return {
        success: true,
        clientId: resolvedClientId,
        workspaceId: ws.id,
        studioName: ws.name,
        alreadyConnected: false,
      };
    } catch (err: any) {
      logger.error('Failed to connect client to workspace', { error: err.message, slug, userId });
      return { success: false, error: err.message || 'Unable to connect to workspace.' };
    }
  },

  /**
   * Retrieves all authorized freelancer workspaces connected to the current client.
   * Powers the Client Portal Workspace Switcher.
   */
  getClientConnectedWorkspaces: async (userId: string): Promise<ConnectedFreelancerWorkspace[]> => {
    if (!userId) return [];

    if (isDemoModeActive()) {
      return [
        {
          id: 'conn-demo-1',
          clientId: 'cli-demo-001',
          workspaceId: 'ws-demo-001',
          freelancerUserId: 'usr-demo-alex',
          freelancerName: 'Alex Rivera',
          studioName: 'Apex Digital Studio',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          currency: 'USD',
          status: 'active',
          connectedAt: '2026-01-15T10:00:00Z',
        },
        {
          id: 'conn-demo-2',
          clientId: 'cli-demo-002',
          workspaceId: 'ws-demo-002',
          freelancerUserId: 'usr-demo-sarah',
          freelancerName: 'Sarah Chen',
          studioName: 'Hyperion Creative Lab',
          avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
          currency: 'USD',
          status: 'active',
          connectedAt: '2026-02-01T12:00:00Z',
        },
      ];
    }

    try {
      const results: ConnectedFreelancerWorkspace[] = [];
      const seenWorkspaceIds = new Set<string>();

      // 1. Query client_connections table
      const { data: conns } = await supabase
        .from('client_connections')
        .select(`
          id,
          client_id,
          workspace_id,
          freelancer_user_id,
          status,
          connected_at
        `)
        .eq('client_user_id', userId)
        .eq('status', 'active');

      if (conns && conns.length > 0) {
        for (const conn of conns) {
          if (seenWorkspaceIds.has(conn.workspace_id)) continue;
          seenWorkspaceIds.add(conn.workspace_id);

          // Get workspace metadata
          const { data: ws } = await supabase
            .from('workspaces')
            .select('id, name, logo_url, currency')
            .eq('id', conn.workspace_id)
            .maybeSingle();

          // Get freelancer profile
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, business_name, avatar_url, logo_url')
            .eq('id', conn.freelancer_user_id)
            .maybeSingle();

          results.push({
            id: conn.id,
            clientId: conn.client_id,
            workspaceId: conn.workspace_id,
            freelancerUserId: conn.freelancer_user_id,
            freelancerName: prof?.full_name || 'Freelancer',
            studioName: ws?.name || prof?.business_name || 'Studio Workspace',
            logoUrl: ws?.logo_url || prof?.logo_url || '',
            avatarUrl: prof?.avatar_url || '',
            currency: ws?.currency || 'USD',
            status: 'active',
            connectedAt: conn.connected_at,
          });
        }
      }

      // 2. Direct clients fallback (backwards compatibility for unbound connections)
      const { data: directClients } = await supabase
        .from('clients')
        .select('id, workspace_id, created_at')
        .eq('user_id', userId)
        .neq('status', 'pending_deletion');

      if (directClients && directClients.length > 0) {
        for (const dc of directClients) {
          if (seenWorkspaceIds.has(dc.workspace_id)) continue;
          seenWorkspaceIds.add(dc.workspace_id);

          const { data: ws } = await supabase
            .from('workspaces')
            .select('id, owner_id, name, logo_url, currency')
            .eq('id', dc.workspace_id)
            .maybeSingle();

          const { data: prof } = ws
            ? await supabase
                .from('profiles')
                .select('full_name, business_name, avatar_url, logo_url')
                .eq('id', ws.owner_id)
                .maybeSingle()
            : { data: null };

          results.push({
            id: dc.id,
            clientId: dc.id,
            workspaceId: dc.workspace_id,
            freelancerUserId: ws?.owner_id,
            freelancerName: prof?.full_name || 'Freelancer',
            studioName: ws?.name || prof?.business_name || 'Studio Workspace',
            logoUrl: ws?.logo_url || prof?.logo_url || '',
            avatarUrl: prof?.avatar_url || '',
            currency: ws?.currency || 'USD',
            status: 'active',
            connectedAt: dc.created_at,
          });
        }
      }

      return results;
    } catch (err: any) {
      logger.warn('Failed to retrieve connected client workspaces', { error: err.message, userId });
      return [];
    }
  },

  /**
   * Retrieves permanent portal settings for the freelancer's active workspace.
   */
  getFreelancerPortalSettings: async (
    customOrigin?: string
  ): Promise<{ portalSlug: string; isAcceptingConnections: boolean; portalUrl: string; connectedClientsCount: number }> => {
    const ws = await getCurrentWorkspace();
    const origin = customOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://flowdesk.app');

    if (!ws) {
      return {
        portalSlug: 'fd_demo_studio',
        isAcceptingConnections: true,
        portalUrl: `${origin}/portal/join/fd_demo_studio`,
        connectedClientsCount: 1,
      };
    }

    const slug = ws.portalSlug || `fd_${ws.id.replace(/-/g, '').slice(0, 16)}`;
    const isAccepting = ws.isAcceptingConnections !== false;
    const portalUrl = `${origin}/portal/join/${slug}`;

    let clientCount = 0;
    try {
      if (!isDemoModeActive()) {
        const { count } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', ws.id)
          .neq('status', 'pending_deletion');
        clientCount = count || 0;
      } else {
        clientCount = 2;
      }
    } catch {
      clientCount = 0;
    }

    return {
      portalSlug: slug,
      isAcceptingConnections: isAccepting,
      portalUrl,
      connectedClientsCount: clientCount,
    };
  },

  /**
   * Updates permanent portal settings (toggle accepting connections or slug customization).
   */
  updateFreelancerPortalSettings: async (settings: {
    isAcceptingConnections?: boolean;
    portalSlug?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const ws = await getCurrentWorkspace();
    if (!ws) {
      return { success: false, error: 'Workspace not found.' };
    }

    if (settings.portalSlug && !SLUG_REGEX.test(settings.portalSlug.trim())) {
      return { success: false, error: 'Portal slug must be 3-64 alphanumeric characters (letters, numbers, hyphens, underscores).' };
    }

    const updated = await updateWorkspacePortalSettings(ws.id, settings);
    return { success: updated, error: updated ? undefined : 'Failed to update portal settings.' };
  },
};
