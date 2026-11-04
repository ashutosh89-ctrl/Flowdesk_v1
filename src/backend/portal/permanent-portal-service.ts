import { supabase, isDemoModeActive, supabaseAdmin } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import {
  PermanentPortalDetails,
  PermanentPortalConnectResult,
  ConnectedFreelancerWorkspace,
  ClientConnectionRequest,
  ConnectedClientItem,
} from '@/shared/types';
import { getCurrentWorkspace, updateWorkspacePortalSettings, workspacePortalModeFallback } from '@/backend/utilities/workspace';
import { getAppBaseUrl } from '@/shared/utils/url';

const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

let demoRequestsState: ClientConnectionRequest[] = [
  {
    id: 'req-demo-001',
    clientId: 'cli-demo-pending-1',
    clientUserId: 'usr-client-pending-1',
    workspaceId: 'ws-demo-001',
    clientName: 'Sarah Jenkins',
    company: 'Vanguard Media Group',
    email: 'sarah.jenkins@vanguardmedia.io',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    status: 'pending',
    requestedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
];

let demoConnectedClientsState: ConnectedClientItem[] = [
  {
    id: 'conn-demo-001',
    clientId: 'cli-demo-001',
    clientUserId: 'usr-demo-client',
    workspaceId: 'ws-demo-001',
    clientName: 'Eleanor Vance',
    company: 'Apex Digital Systems',
    email: 'eleanor@apexdigital.io',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    status: 'active',
    connectedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'conn-demo-002',
    clientId: 'cli-demo-002',
    clientUserId: 'usr-demo-client-2',
    workspaceId: 'ws-demo-001',
    clientName: 'Marcus Thorne',
    company: 'Starlight Labs',
    email: 'marcus@starlightlabs.co',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    status: 'active',
    connectedAt: '2026-02-01T12:00:00Z',
  },
];

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
      const demoWs = await getCurrentWorkspace();
      return {
        valid: true,
        slug: cleanSlug,
        isAcceptingConnections: true,
        portalMode: demoWs?.portalMode || 'public',
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
          portalMode: res.portal_mode === 'private' ? 'private' : 'public',
          freelancerName: res.freelancer_name || 'FlowDesk Freelancer',
          studioName: res.studio_name || 'Studio Workspace',
          profession: res.profession || 'Independent Professional',
          avatarUrl: res.avatar_url || '',
          logoUrl: res.logo_url || '',
          currency: res.currency || 'INR',
        };
      }

      // 2. Direct query via Supabase
      let wsData: any = null;
      const { data: wsRaw, error: wsErr } = await supabase
        .from('workspaces')
        .select('*')
        .ilike('portal_slug', cleanSlug)
        .maybeSingle();

      if (!wsErr && wsRaw) {
        wsData = wsRaw;
      } else {
        const { data: fallbackWs } = await supabase
          .from('workspaces')
          .select('id, owner_id, name, logo_url, currency, is_accepting_connections, portal_slug')
          .ilike('portal_slug', cleanSlug)
          .maybeSingle();
        wsData = fallbackWs;
      }

      if (!wsData) {
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

      const resolvedMode = (wsData.portal_mode === 'private' || workspacePortalModeFallback.get(wsData.id) === 'private') ? 'private' : 'public';

      return {
        valid: true,
        slug: cleanSlug,
        isAcceptingConnections: wsData.is_accepting_connections !== false,
        portalMode: resolvedMode,
        freelancerName: profData?.full_name || 'FlowDesk Freelancer',
        studioName: wsData.name || profData?.business_name || 'Studio Workspace',
        profession: profData?.profession || 'Independent Professional',
        avatarUrl: profData?.avatar_url || '',
        logoUrl: wsData.logo_url || profData?.logo_url || '',
        currency: wsData.currency || 'INR',
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
  ): Promise<{ isConnected: boolean; isPending?: boolean; isOwner: boolean; clientId?: string; studioName?: string; error?: string }> => {
    if (!slug || !userId) {
      return { isConnected: false, isOwner: false };
    }

    if (isDemoModeActive()) {
      const demoWs = await getCurrentWorkspace();
      const isPrivate = demoWs?.portalMode === 'private';
      const isOwner = userId === 'usr-demo' || userId === 'usr-demo-alex';
      if (userId === 'usr-client-pending' || (userId === 'usr-demo-client' && isPrivate && (demoWs as any)._demoPendingApproval)) {
        return {
          isConnected: false,
          isPending: true,
          isOwner: false,
          clientId: 'cli-demo-pending',
          studioName: 'FlowDesk Studio',
        };
      }
      return {
        isConnected: userId === 'usr-demo-client',
        isPending: false,
        isOwner,
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

      if (conn) {
        if (conn.status === 'active') {
          return { isConnected: true, isPending: false, isOwner: false, clientId: conn.client_id, studioName: wsData.name };
        }
        if (conn.status === 'pending') {
          return { isConnected: false, isPending: true, isOwner: false, clientId: conn.client_id, studioName: wsData.name };
        }
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
        if (clientRow.status === 'pending') {
          return { isConnected: false, isPending: true, isOwner: false, clientId: clientRow.id, studioName: wsData.name };
        }
        if (clientRow.status === 'active') {
          return { isConnected: true, isPending: false, isOwner: false, clientId: clientRow.id, studioName: wsData.name };
        }
      }

      return { isConnected: false, isPending: false, isOwner: false, studioName: wsData.name };
    } catch (err: any) {
      return { isConnected: false, isOwner: false, error: err.message };
    }
  },

  /**
   * Connects an authenticated client to a freelancer workspace via permanent portal link.
   * Respects Public vs. Private Mode:
   * - Public: Automatic instant connection.
   * - Private: Clients not pre-added by freelancer are placed in 'pending' status awaiting review.
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
      const demoWs = await getCurrentWorkspace();
      const isPrivate = demoWs?.portalMode === 'private';
      if (isPrivate && userId !== 'usr-demo-preadded') {
        return {
          success: true,
          clientId: 'cli-demo-pending',
          workspaceId: 'ws-demo-001',
          studioName: 'FlowDesk Studio',
          status: 'pending',
          requiresApproval: true,
          alreadyConnected: false,
        };
      }
      return {
        success: true,
        clientId: 'cli-demo-001',
        workspaceId: 'ws-demo-001',
        studioName: 'FlowDesk Studio',
        status: 'active',
        requiresApproval: false,
        alreadyConnected: false,
      };
    }

    try {
      const client = supabaseAdmin || supabase;

      // 1. Resolve workspace by portal_slug
      let ws: any = null;
      const { data: wsRaw, error: wsError } = await client
        .from('workspaces')
        .select('*')
        .ilike('portal_slug', cleanSlug)
        .maybeSingle();

      if (!wsError && wsRaw) {
        ws = wsRaw;
      } else {
        const { data: fallbackWs } = await client
          .from('workspaces')
          .select('id, owner_id, name, is_accepting_connections, currency')
          .ilike('portal_slug', cleanSlug)
          .maybeSingle();
        ws = fallbackWs;
      }

      if (!ws) {
        return { success: false, error: 'Freelancer portal link does not exist.' };
      }

      if (ws.is_accepting_connections === false) {
        return { success: false, error: 'This freelancer is not currently accepting new connections.' };
      }

      if (ws.owner_id === userId) {
        return { success: false, error: 'You cannot connect to your own workspace as a client.' };
      }

      // Resolve user email and full name from auth (or profiles)
      let userEmail = '';
      let userName = 'Client';

      if (client.auth?.admin?.getUserById) {
        try {
          const { data: userData } = await client.auth.admin.getUserById(userId);
          if (userData?.user) {
            userEmail = userData.user.email?.trim().toLowerCase() || '';
            const meta = userData.user.user_metadata || {};
            userName = meta.full_name || userEmail.split('@')[0] || 'Client';
          }
        } catch {
          // ignore
        }
      }

      if (!userEmail) {
        try {
          const { data: prof } = await client
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .maybeSingle();
          if (prof?.email) {
            userEmail = prof.email.trim().toLowerCase();
            userName = prof.full_name || userName;
          }
        } catch {
          // ignore
        }
      }

      // 2. Fetch all existing clients in this workspace to link canonically
      const { data: wsClients } = await client
        .from('clients')
        .select('id, user_id, email, name, company, status')
        .eq('workspace_id', ws.id)
        .neq('status', 'pending_deletion');

      const allClients = wsClients || [];

      // Match by email first: This is the client record created by the freelancer
      // which already holds projects, deliverables, invoices, and documents!
      const emailMatchedClient = userEmail
        ? allClients.find((c) => c.email && c.email.trim().toLowerCase() === userEmail)
        : null;

      let resolvedClientId: string = '';
      const isPrivate = (ws.portal_mode === 'private' || workspacePortalModeFallback.get(ws.id) === 'private');
      let targetStatus: 'active' | 'pending' = 'active';
      let requiresApproval = false;

      if (emailMatchedClient) {
        // Freelancer pre-added this client explicitly before connection!
        resolvedClientId = emailMatchedClient.id;
        targetStatus = 'active';
        requiresApproval = false;

        // Ensure this client record is bound to userId and active
        await client
          .from('clients')
          .update({
            user_id: userId,
            status: 'active',
            ...(userName && (!emailMatchedClient.name || emailMatchedClient.name === 'Client') ? { name: userName } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', emailMatchedClient.id);

        // Reconcile and clean up any empty duplicate client rows previously created for this user in this workspace
        const duplicateClients = allClients.filter(
          (c) => c.user_id === userId && c.id !== emailMatchedClient.id
        );
        for (const dup of duplicateClients) {
          try {
            await Promise.all([
              client.from('projects').update({ client_id: emailMatchedClient.id }).eq('client_id', dup.id),
              client.from('deliverables').update({ client_id: emailMatchedClient.id }).eq('client_id', dup.id),
              client.from('documents').update({ client_id: emailMatchedClient.id }).eq('client_id', dup.id),
              client.from('invoices').update({ client_id: emailMatchedClient.id }).eq('client_id', dup.id),
              client.from('activities').update({ client_id: emailMatchedClient.id }).eq('client_id', dup.id),
            ]);
            await client.from('clients').delete().eq('id', dup.id);
          } catch (dupCleanupErr) {
            console.warn('[connectClient] Duplicate reconciliation notice:', dupCleanupErr);
          }
        }
      } else {
        // Fallback: check if a client record in this workspace already has user_id = userId
        const userMatchedClient = allClients.find((c) => c.user_id === userId);
        if (userMatchedClient) {
          resolvedClientId = userMatchedClient.id;
          // If already active, remain active; if pending in private mode, stay pending
          const isAlreadyActive = userMatchedClient.status === 'active';
          targetStatus = isAlreadyActive ? 'active' : isPrivate ? 'pending' : 'active';
          requiresApproval = targetStatus === 'pending';

          // In Public Mode, promote client row from 'invited' to 'active'
          if (!isPrivate && userMatchedClient.status !== 'active') {
            await client.from('clients').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', userMatchedClient.id);
          }

          if (!userMatchedClient.email && userEmail) {
            await client.from('clients').update({ email: userEmail, updated_at: new Date().toISOString() }).eq('id', userMatchedClient.id);
          }
        } else {
          // If neither email nor user_id matched, client joined cold via link!
          // In Private Mode, place them into 'pending' verification state
          if (isPrivate) {
            targetStatus = 'pending';
            requiresApproval = true;
          } else {
            targetStatus = 'active';
            requiresApproval = false;
          }

          // Production Database Constraint Compliance:
          // Table 'clients' has check constraint chk_clients_status:
          // CHECK (status IN ('active', 'inactive', 'lead', 'archived', 'pending_deletion', 'invited'))
          // Using 'invited' on the clients table for pending verification in Private Mode satisfies
          // the database check constraint while client_connections tracks the 'pending' status.
          const clientRowStatus = isPrivate ? 'invited' : 'active';

          const { data: newClient, error: clientCreateErr } = await client
            .from('clients')
            .insert({
              workspace_id: ws.id,
              user_id: userId,
              name: userName,
              company: `${userName} Workspace`,
              email: userEmail || 'client@flowdesk.app',
              status: clientRowStatus,
              currency: ws.currency || 'INR',
            })
            .select('id')
            .single();

          if (clientCreateErr || !newClient) {
            return { success: false, error: clientCreateErr?.message || 'Failed to initialize client profile.' };
          }
          resolvedClientId = newClient.id;
        }
      }

      // Check if client_connections was already pointing to this resolved client
      const { data: existingConn } = await client
        .from('client_connections')
        .select('id, client_id, status')
        .eq('workspace_id', ws.id)
        .eq('client_user_id', userId)
        .maybeSingle();

      const alreadyConnected = Boolean(
        existingConn && existingConn.status === 'active' && existingConn.client_id === resolvedClientId
      );

      // Upsert client_connections with canonical client_id & appropriate status
      const { error: upsertErr } = await client.from('client_connections').upsert(
        {
          workspace_id: ws.id,
          freelancer_user_id: ws.owner_id,
          client_user_id: userId,
          client_id: resolvedClientId,
          status: targetStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_user_id,workspace_id' }
      );

      if (upsertErr) {
        console.warn('[connectClient] client_connections upsert error:', upsertErr);
        // Fallback for strict database check constraints if 'pending' was not supported
        if (targetStatus === 'pending') {
          await client.from('client_connections').upsert(
            {
              workspace_id: ws.id,
              freelancer_user_id: ws.owner_id,
              client_user_id: userId,
              client_id: resolvedClientId,
              status: 'disconnected',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'client_user_id,workspace_id' }
          );
        }
      }

      // Invalidate caches
      try {
        const { invalidatePortalCache } = await import('@/backend/client');
        invalidatePortalCache(resolvedClientId);
        invalidatePortalCache(ws.id);
      } catch {
        // ignore
      }

      logger.info('CLIENT_PORTAL_CONNECTED', {
        userId,
        workspaceId: ws.id,
        clientId: resolvedClientId,
        slug: cleanSlug,
        status: targetStatus,
        requiresApproval,
      });

      return {
        success: true,
        clientId: resolvedClientId,
        workspaceId: ws.id,
        studioName: ws.name,
        status: targetStatus,
        requiresApproval,
        alreadyConnected,
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
      const client = supabaseAdmin || supabase;
      const results: ConnectedFreelancerWorkspace[] = [];
      const seenWorkspaceIds = new Set<string>();

      // Resolve user email to ensure any freelancer-created client records with matching email are auto-bound
      let userEmail = '';
      if (client.auth?.admin?.getUserById) {
        try {
          const { data: userData } = await client.auth.admin.getUserById(userId);
          userEmail = userData?.user?.email?.trim().toLowerCase() || '';
        } catch {
          // ignore
        }
      }

      if (userEmail) {
        try {
          const { data: unboundEmailMatches } = await client
            .from('clients')
            .select('id, workspace_id, user_id, email')
            .ilike('email', userEmail)
            .neq('status', 'pending_deletion');

          for (const match of (unboundEmailMatches || [])) {
            if (!match.user_id) {
              await client
                .from('clients')
                .update({ user_id: userId, status: 'active', updated_at: new Date().toISOString() })
                .eq('id', match.id);

              const { data: wsData } = await client
                .from('workspaces')
                .select('owner_id')
                .eq('id', match.workspace_id)
                .maybeSingle();

              await client.from('client_connections').upsert(
                {
                  workspace_id: match.workspace_id,
                  freelancer_user_id: wsData?.owner_id || null,
                  client_user_id: userId,
                  client_id: match.id,
                  status: 'active',
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'client_user_id,workspace_id' }
              );
            }
          }
        } catch (autoBindErr) {
          console.warn('[getClientConnectedWorkspaces] email auto-bind notice:', autoBindErr);
        }
      }

      // 1. Query client_connections table and direct clients in parallel
      const [connsRes, directClientsRes] = await Promise.all([
        client
          .from('client_connections')
          .select('id, client_id, workspace_id, freelancer_user_id, status, connected_at')
          .eq('client_user_id', userId)
          .eq('status', 'active'),
        client
          .from('clients')
          .select('id, workspace_id, created_at')
          .eq('user_id', userId)
          .neq('status', 'pending_deletion'),
      ]);

      const conns = connsRes.data || [];
      const directClients = directClientsRes.data || [];

      // Collect all unique workspace IDs and freelancer IDs
      const allWsIds = new Set<string>();
      const allFreelancerIds = new Set<string>();

      conns.forEach((c) => {
        allWsIds.add(c.workspace_id);
        if (c.freelancer_user_id) allFreelancerIds.add(c.freelancer_user_id);
      });
      directClients.forEach((dc) => {
        allWsIds.add(dc.workspace_id);
      });

      if (allWsIds.size === 0) return [];

      // 2. Fetch all workspaces in a single batch query
      const { data: workspacesList } = await client
        .from('workspaces')
        .select('id, owner_id, name, logo_url, currency')
        .in('id', Array.from(allWsIds));

      const wsMap = new Map<string, any>();
      workspacesList?.forEach((w) => {
        wsMap.set(w.id, w);
        if (w.owner_id) allFreelancerIds.add(w.owner_id);
      });

      // 3. Fetch all freelancer profiles in a single batch query
      const { data: profilesList } = allFreelancerIds.size > 0
        ? await client
            .from('profiles')
            .select('id, full_name, business_name, avatar_url, logo_url')
            .in('id', Array.from(allFreelancerIds))
        : { data: [] };

      const profMap = new Map<string, any>();
      profilesList?.forEach((p) => {
        profMap.set(p.id, p);
      });

      // 4. Assemble connections in-memory
      for (const conn of conns) {
        if (seenWorkspaceIds.has(conn.workspace_id)) continue;
        seenWorkspaceIds.add(conn.workspace_id);

        const ws = wsMap.get(conn.workspace_id);
        const prof = profMap.get(conn.freelancer_user_id) || (ws?.owner_id ? profMap.get(ws.owner_id) : null);

        results.push({
          id: conn.id,
          clientId: conn.client_id,
          workspaceId: conn.workspace_id,
          freelancerUserId: conn.freelancer_user_id,
          freelancerName: prof?.full_name || 'Freelancer',
          studioName: ws?.name || prof?.business_name || 'Studio Workspace',
          logoUrl: ws?.logo_url || prof?.logo_url || '',
          avatarUrl: prof?.avatar_url || '',
          currency: ws?.currency || 'INR',
          status: 'active',
          connectedAt: conn.connected_at,
        });
      }

      // 5. Assemble direct clients fallback
      for (const dc of directClients) {
        if (seenWorkspaceIds.has(dc.workspace_id)) continue;
        seenWorkspaceIds.add(dc.workspace_id);

        const ws = wsMap.get(dc.workspace_id);
        const prof = ws?.owner_id ? profMap.get(ws.owner_id) : null;

        results.push({
          id: dc.id,
          clientId: dc.id,
          workspaceId: dc.workspace_id,
          freelancerUserId: ws?.owner_id || '',
          freelancerName: prof?.full_name || 'Freelancer',
          studioName: ws?.name || prof?.business_name || 'Studio Workspace',
          logoUrl: ws?.logo_url || prof?.logo_url || '',
          avatarUrl: prof?.avatar_url || '',
          currency: ws?.currency || 'INR',
          status: 'active',
          connectedAt: dc.created_at,
        });
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
    customOrigin?: string,
    callerUserId?: string,
    callerWorkspaceId?: string
  ): Promise<{
    portalSlug: string;
    isAcceptingConnections: boolean;
    portalMode: 'public' | 'private';
    portalUrl: string;
    connectedClientsCount: number;
    pendingRequestsCount: number;
  }> => {
    const origin = customOrigin || (typeof window !== 'undefined' ? window.location.origin : getAppBaseUrl());
    let ws: any = null;

    if (isDemoModeActive()) {
      ws = await getCurrentWorkspace();
    } else {
      const db = supabaseAdmin || supabase;
      if (callerWorkspaceId) {
        const { data } = await db
          .from('workspaces')
          .select('*')
          .eq('id', callerWorkspaceId)
          .maybeSingle();
        ws = data;
      }
      if (!ws && callerUserId) {
        const { data } = await db
          .from('workspaces')
          .select('*')
          .eq('owner_id', callerUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        ws = data;
      }
      if (!ws) {
        ws = await getCurrentWorkspace();
      }
    }

    if (!ws) {
      return {
        portalSlug: 'fd_demo_studio',
        isAcceptingConnections: true,
        portalMode: 'public',
        portalUrl: `${origin}/portal/join/fd_demo_studio`,
        connectedClientsCount: 0,
        pendingRequestsCount: 0,
      };
    }

    const slug = ws.portal_slug || ws.portalSlug || `fd_${(ws.id || 'studio').replace(/-/g, '').slice(0, 16)}`;
    const isAccepting = ws.is_accepting_connections !== false && ws.isAcceptingConnections !== false;
    const portalMode: 'public' | 'private' = (ws.portal_mode === 'private' || ws.portalMode === 'private' || workspacePortalModeFallback.get(ws.id) === 'private') ? 'private' : 'public';
    const portalUrl = `${origin}/portal/join/${slug}`;

    let clientCount = 0;
    let pendingCount = 0;

    try {
      if (!isDemoModeActive() && ws.id) {
        const db = supabaseAdmin || supabase;
        const [activeConnsRes, activeClientsRes, pendingConnsRes] = await Promise.all([
          db
            .from('client_connections')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', ws.id)
            .eq('status', 'active'),
          db
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', ws.id)
            .eq('status', 'active'),
          db
            .from('client_connections')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', ws.id)
            .eq('status', 'pending'),
        ]);
        clientCount = Math.max(activeConnsRes.count || 0, activeClientsRes.count || 0);
        pendingCount = pendingConnsRes.count || 0;
      } else {
        clientCount = demoConnectedClientsState.length;
        pendingCount = demoRequestsState.length;
      }
    } catch {
      clientCount = 0;
      pendingCount = 0;
    }

    return {
      portalSlug: slug,
      isAcceptingConnections: isAccepting,
      portalMode,
      portalUrl,
      connectedClientsCount: clientCount,
      pendingRequestsCount: pendingCount,
    };
  },

  /**
   * Updates permanent portal settings (toggle accepting connections, portal mode, or slug customization).
   */
  updateFreelancerPortalSettings: async (
    settings: {
      isAcceptingConnections?: boolean;
      portalSlug?: string;
      portalMode?: 'public' | 'private';
    },
    callerUserId?: string,
    callerWorkspaceId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (settings.portalSlug && !SLUG_REGEX.test(settings.portalSlug.trim())) {
      return { success: false, error: 'Portal slug must be 3-64 alphanumeric characters (letters, numbers, hyphens, underscores).' };
    }

    if (isDemoModeActive()) {
      const ws = await getCurrentWorkspace();
      if (!ws) return { success: false, error: 'Workspace not found.' };
      const updated = await updateWorkspacePortalSettings(ws.id, settings);
      return { success: updated, error: updated ? undefined : 'Failed to update portal settings.' };
    }

    try {
      const db = supabaseAdmin || supabase;
      let targetWsId = callerWorkspaceId;

      if (!targetWsId && callerUserId) {
        const { data: ws } = await db
          .from('workspaces')
          .select('id')
          .eq('owner_id', callerUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        targetWsId = ws?.id;
      }

      if (!targetWsId) {
        const ws = await getCurrentWorkspace();
        targetWsId = ws?.id;
      }

      if (!targetWsId) {
        return { success: false, error: 'Workspace not found.' };
      }

      if (settings.portalMode !== undefined) {
        workspacePortalModeFallback.set(targetWsId, settings.portalMode);
      }

      const payload: any = { updated_at: new Date().toISOString() };
      if (settings.isAcceptingConnections !== undefined) {
        payload.is_accepting_connections = settings.isAcceptingConnections;
      }
      if (settings.portalSlug !== undefined) {
        payload.portal_slug = settings.portalSlug.trim().toLowerCase();
      }
      if (settings.portalMode !== undefined) {
        payload.portal_mode = settings.portalMode;
      }

      let { error } = await db.from('workspaces').update(payload).eq('id', targetWsId);
      if (error && error.message && error.message.includes('portal_mode')) {
        logger.warn('portal_mode column not in PostgREST schema cache, retrying without it and using fallback', {
          error: error.message,
          workspaceId: targetWsId,
        });
        delete payload.portal_mode;
        const retryRes = await db.from('workspaces').update(payload).eq('id', targetWsId);
        error = retryRes.error;
      }

      if (error) {
        return { success: false, error: error.message };
      }

      await updateWorkspacePortalSettings(targetWsId, settings);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update portal settings.' };
    }
  },

  /**
   * Retrieves pending verification requests and active connected clients for the freelancer's workspace.
   */
  getWorkspaceClientRequests: async (
    workspaceId?: string,
    callerUserId?: string
  ): Promise<{ requests: ClientConnectionRequest[]; connectedClients: ConnectedClientItem[] }> => {
    // Demo Mode handling
    if (isDemoModeActive()) {
      return { requests: [...demoRequestsState], connectedClients: [...demoConnectedClientsState] };
    }

    try {
      const db = supabaseAdmin || supabase;
      let targetWsId = workspaceId;

      if (!targetWsId && callerUserId) {
        const { data: ws } = await db
          .from('workspaces')
          .select('id')
          .eq('owner_id', callerUserId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        targetWsId = ws?.id;
      }

      if (!targetWsId) {
        const ws = await getCurrentWorkspace();
        targetWsId = ws?.id;
      }

      if (!targetWsId) {
        return { requests: [], connectedClients: [] };
      }

      // Query all client_connections and associated clients for this workspace
      const [connsRes, clientsRes] = await Promise.all([
        db
          .from('client_connections')
          .select('id, client_id, client_user_id, workspace_id, status, connected_at, created_at')
          .eq('workspace_id', targetWsId)
          .order('created_at', { ascending: false }),
        db
          .from('clients')
          .select('id, user_id, name, company, email, avatar_url, status, created_at')
          .eq('workspace_id', targetWsId)
          .neq('status', 'pending_deletion'),
      ]);

      const conns = connsRes.data || [];
      const clientsList = clientsRes.data || [];
      const clientMap = new Map<string, any>();
      clientsList.forEach((c) => clientMap.set(c.id, c));

      const requests: ClientConnectionRequest[] = [];
      const connectedClients: ConnectedClientItem[] = [];
      const seenClientIds = new Set<string>();

      for (const conn of conns) {
        const c = clientMap.get(conn.client_id);
        const name = c?.name || 'Client Partner';
        const company = c?.company || 'Client Organization';
        const email = c?.email || 'client@flowdesk.app';
        const avatarUrl = c?.avatar_url || '';

        const isPending = conn.status === 'pending' || c?.status === 'invited';
        const isActive = conn.status === 'active' && c?.status === 'active';

        if (isPending) {
          seenClientIds.add(conn.client_id);
          requests.push({
            id: conn.id,
            clientId: conn.client_id,
            clientUserId: conn.client_user_id,
            workspaceId: conn.workspace_id,
            clientName: name,
            company,
            email,
            avatarUrl,
            status: 'pending',
            requestedAt: conn.created_at,
          });
        } else if (isActive) {
          seenClientIds.add(conn.client_id);
          connectedClients.push({
            id: conn.id,
            clientId: conn.client_id,
            clientUserId: conn.client_user_id,
            workspaceId: conn.workspace_id,
            clientName: name,
            company,
            email,
            avatarUrl,
            status: 'active',
            connectedAt: conn.connected_at || conn.created_at,
          });
        }
      }

      // Also include any clients with status 'invited' that don't have a matching connection row yet
      for (const c of clientsList) {
        if (c.status === 'invited' && !seenClientIds.has(c.id)) {
          requests.push({
            id: c.id,
            clientId: c.id,
            clientUserId: c.user_id || '',
            workspaceId: targetWsId,
            clientName: c.name || 'Client Partner',
            company: c.company || 'Client Organization',
            email: c.email || 'client@flowdesk.app',
            avatarUrl: c.avatar_url || '',
            status: 'pending',
            requestedAt: c.created_at || new Date().toISOString(),
          });
        }
      }

      return { requests, connectedClients };
    } catch (err: any) {
      logger.error('Failed to get workspace client requests', { error: err.message, workspaceId });
      return { requests: [], connectedClients: [] };
    }
  },

  /**
   * Approves a pending client connection request.
   * Promotes client and connection status to 'active', granting access.
   */
  approveClientConnection: async (
    connectionIdOrClientId: string,
    workspaceId?: string,
    callerUserId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!connectionIdOrClientId) {
      return { success: false, error: 'Connection ID or Client ID required' };
    }

    if (isDemoModeActive()) {
      const reqIdx = demoRequestsState.findIndex(
        (r) => r.id === connectionIdOrClientId || r.clientId === connectionIdOrClientId
      );
      if (reqIdx !== -1) {
        const req = demoRequestsState[reqIdx];
        demoRequestsState.splice(reqIdx, 1);
        demoConnectedClientsState.unshift({
          id: req.id,
          clientId: req.clientId,
          clientUserId: req.clientUserId,
          workspaceId: req.workspaceId,
          clientName: req.clientName,
          company: req.company,
          email: req.email,
          avatarUrl: req.avatarUrl,
          status: 'active',
          connectedAt: new Date().toISOString(),
        });
      }
      return { success: true };
    }

    try {
      const db = supabaseAdmin || supabase;
      const now = new Date().toISOString();

      // Find the connection record
      const { data: conn } = await db
        .from('client_connections')
        .select('id, client_id, workspace_id')
        .or(`id.eq.${connectionIdOrClientId},client_id.eq.${connectionIdOrClientId}`)
        .limit(1)
        .maybeSingle();

      if (!conn) {
        return { success: false, error: 'Connection request not found.' };
      }

      // Security check: If callerUserId provided, verify caller owns the workspace
      if (callerUserId && conn.workspace_id) {
        const { data: wsCheck } = await db
          .from('workspaces')
          .select('id')
          .eq('id', conn.workspace_id)
          .eq('owner_id', callerUserId)
          .maybeSingle();
        if (!wsCheck) {
          return { success: false, error: 'Unauthorized: You do not own this workspace' };
        }
      }

      const targetClientId = conn?.client_id || connectionIdOrClientId;
      const targetConnId = conn?.id;

      // Update client_connections to active
      if (targetConnId) {
        await db
          .from('client_connections')
          .update({
            status: 'active',
            connected_at: now,
            updated_at: now,
          })
          .eq('id', targetConnId);
      } else {
        await db
          .from('client_connections')
          .update({
            status: 'active',
            connected_at: now,
            updated_at: now,
          })
          .eq('client_id', targetClientId);
      }

      // Update clients to active
      await db
        .from('clients')
        .update({
          status: 'active',
          updated_at: now,
        })
        .eq('id', targetClientId);

      // Invalidate caches
      try {
        const { invalidatePortalCache } = await import('@/backend/client');
        invalidatePortalCache(targetClientId);
        if (conn?.workspace_id) invalidatePortalCache(conn.workspace_id);
      } catch {
        // ignore
      }

      logger.info('CLIENT_CONNECTION_APPROVED', {
        targetClientId,
        targetConnId,
        approvedBy: callerUserId,
      });

      return { success: true };
    } catch (err: any) {
      logger.error('Failed to approve client connection', { error: err.message, connectionIdOrClientId });
      return { success: false, error: err.message || 'Unable to approve client.' };
    }
  },

  /**
   * Rejects a pending client connection request.
   */
  rejectClientConnection: async (
    connectionIdOrClientId: string,
    workspaceId?: string,
    callerUserId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!connectionIdOrClientId) {
      return { success: false, error: 'Connection ID or Client ID required' };
    }

    if (isDemoModeActive()) {
      demoRequestsState = demoRequestsState.filter(
        (r) => r.id !== connectionIdOrClientId && r.clientId !== connectionIdOrClientId
      );
      return { success: true };
    }

    try {
      const db = supabaseAdmin || supabase;
      const now = new Date().toISOString();

      const { data: conn } = await db
        .from('client_connections')
        .select('id, client_id, workspace_id')
        .or(`id.eq.${connectionIdOrClientId},client_id.eq.${connectionIdOrClientId}`)
        .limit(1)
        .maybeSingle();

      if (!conn) {
        return { success: false, error: 'Connection request not found.' };
      }

      // Security check: If callerUserId provided, verify caller owns the workspace
      if (callerUserId && conn.workspace_id) {
        const { data: wsCheck } = await db
          .from('workspaces')
          .select('id')
          .eq('id', conn.workspace_id)
          .eq('owner_id', callerUserId)
          .maybeSingle();
        if (!wsCheck) {
          return { success: false, error: 'Unauthorized: You do not own this workspace' };
        }
      }

      const targetClientId = conn?.client_id || connectionIdOrClientId;
      const targetConnId = conn?.id;

      if (targetConnId) {
        const { error: rejConnErr } = await db
          .from('client_connections')
          .update({
            status: 'rejected',
            updated_at: now,
          })
          .eq('id', targetConnId);
        if (rejConnErr) {
          await db
            .from('client_connections')
            .update({
              status: 'disconnected',
              updated_at: now,
            })
            .eq('id', targetConnId);
        }
      } else {
        const { error: rejConnErr } = await db
          .from('client_connections')
          .update({
            status: 'rejected',
            updated_at: now,
          })
          .eq('client_id', targetClientId);
        if (rejConnErr) {
          await db
            .from('client_connections')
            .update({
              status: 'disconnected',
              updated_at: now,
            })
            .eq('client_id', targetClientId);
        }
      }

      const { error: rejClientErr } = await db
        .from('clients')
        .update({
          status: 'rejected',
          updated_at: now,
        })
        .eq('id', targetClientId);

      if (rejClientErr) {
        // Fallback to 'inactive' which satisfies existing chk_clients_status constraint
        await db
          .from('clients')
          .update({
            status: 'inactive',
            updated_at: now,
          })
          .eq('id', targetClientId);
      }

      try {
        const { invalidatePortalCache } = await import('@/backend/client');
        invalidatePortalCache(targetClientId);
        if (conn?.workspace_id) invalidatePortalCache(conn.workspace_id);
      } catch {
        // ignore
      }

      logger.info('CLIENT_CONNECTION_REJECTED', {
        targetClientId,
        targetConnId,
        rejectedBy: callerUserId,
      });

      return { success: true };
    } catch (err: any) {
      logger.error('Failed to reject client connection', { error: err.message, connectionIdOrClientId });
      return { success: false, error: err.message || 'Unable to reject connection request.' };
    }
  },
};
