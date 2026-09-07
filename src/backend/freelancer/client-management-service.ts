import { ClientRepository } from '@/backend/repositories/clients/client-service';
import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { Client, ClientPortalConfig, AccountDeletionRecord } from '@/shared/types';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { AccountDeletionService } from '@/backend/auth/account-deletion-service';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { InvitationService } from '@/backend/invitations/invitation-service';

/**
 * Freelancer-side Client Relationship & Management Service.
 * Exclusively used by the workspace owner to manage client accounts,
 * health scores, rates, and provision portal credentials.
 */
export const FreelancerClientManagementService = {
  getClients: async (): Promise<Client[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getClients();
    return ClientRepository.getClients();
  },

  getClientById: async (id: string): Promise<Client | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getClientById(id);
    return ClientRepository.getClientById(id);
  },

  createClient: async (clientData: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>): Promise<Client> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.createClient(clientData);
    }
    const client = await ClientRepository.createClient(clientData);
    // Log activity (non-critical)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ws } = await supabase.from('workspaces').select('id').limit(1).single();
      if (ws) {
        await supabase.from('activities').insert({
          workspace_id: ws.id,
          action: 'created_client',
          title: client.name,
          description: `Created client ${client.company}`,
          user_name: user?.email?.split('@')[0] || 'User',
          resource_type: 'client',
        });
      }
    } catch { /* non-critical */ }

    // Automatically trigger invitation email dispatch if client has email
    if (client.email && client.email.includes('@')) {
      FreelancerClientManagementService.sendClientInvitationEmail(client.id).catch((emailErr) => {
        console.warn('[FreelancerClientManagementService] Auto-invitation notice:', emailErr);
      });
    }

    return client;
  },

  updateClient: async (id: string, updates: Partial<Client>): Promise<Client | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.updateClient(id, updates);
    return ClientRepository.updateClient(id, updates);
  },

  archiveClient: async (id: string): Promise<Client | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.archiveClient(id);
    return ClientRepository.updateClient(id, { status: 'archived' });
  },

  restoreClient: async (id: string): Promise<Client | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.restoreClient(id);
    const res = await AccountDeletionService.restoreClientAccount(id);
    if (res.success && res.client) {
      return res.client;
    }
    return ClientRepository.updateClient(id, { status: 'active' });
  },

  getDeletedClients: async (workspaceId?: string): Promise<AccountDeletionRecord[]> => {
    return AccountDeletionService.getDeletedClients(workspaceId);
  },

  deleteClient: async (id: string): Promise<boolean> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.deleteClient(id);
    return ClientRepository.deleteClient(id);
  },

  togglePortalAccess: async (clientId: string, enabled: boolean): Promise<ClientPortalConfig> => {
    try {
      const { data, error } = await supabase.from('clients').update({ portal_access_enabled: enabled }).eq('id', clientId).select().single();
      if (error || !data) throw error || new Error('Failed');
      return { clientId, enabled, magicKey: data.portal_token || '', portalUrl: `/portal/${data.id}` };
    } catch { throw new Error('Failed to toggle portal access'); }
  },

  /**
   * Retrieves or creates a secure one-time connection link for copying to clipboard.
   * Method B — Copy Connection Link uses the exact same invitation as Method A (Email).
   */
  getOrCreateConnectionLink: async (clientId: string): Promise<{ success: boolean; url: string; rawToken?: string; error?: string }> => {
    try {
      const result = await InvitationService.createOrGetInvitation(clientId);
      return {
        success: true,
        url: result.url,
        rawToken: result.rawToken,
      };
    } catch (err: any) {
      console.warn('[FreelancerClientManagementService] Error getting connection link:', err);
      return {
        success: false,
        url: '',
        error: err.message || 'Failed to generate connection link',
      };
    }
  },

  regeneratePortalLink: async (clientId: string): Promise<ClientPortalConfig> => {
    try {
      const result = await InvitationService.createOrGetInvitation(clientId, { forceNew: true });
      return {
        clientId,
        enabled: true,
        magicKey: result.rawToken,
        portalUrl: result.url,
        inviteLink: result.url,
      };
    } catch (err: any) {
      console.warn('Failed to regenerate portal link:', err);
      throw new Error(err.message || 'Failed to regenerate portal link');
    }
  },

  /**
   * Method A — Default Email Invitation.
   * Dispatches the one-time connection link via Brevo.
   */
  sendClientInvitationEmail: async (
    clientId: string
  ): Promise<{ success: boolean; message?: string; inviteUrl?: string; error?: string }> => {
    try {
      // 1. Generate or retrieve the one-time connection invitation
      const inviteResult = await InvitationService.createOrGetInvitation(clientId);

      // 2. Fetch client details
      let client: { id: string; name?: string; email: string; company?: string; workspace_id?: string } | undefined;
      let studioName = 'FlowDesk Studio';

      if (DemoDataProvider.isDemo() || isDemoModeActive()) {
        const storeClient = FlowDeskStore.getClientById(clientId);
        if (!storeClient || !storeClient.email) {
          return { success: false, error: 'Client does not have a registered email address.' };
        }
        client = {
          id: storeClient.id,
          name: storeClient.name,
          email: storeClient.email,
          company: storeClient.company,
          workspace_id: 'ws-demo-workspace',
        };
      } else {
        const { data: dbClient } = await supabase
          .from('clients')
          .select('id, name, email, company, workspace_id')
          .eq('id', clientId)
          .single();

        if (!dbClient || !dbClient.email) {
          return { success: false, error: 'Client does not have a registered email address.' };
        }
        client = dbClient;

        let ownerId: string | undefined;
        if (client.workspace_id) {
          const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', client.workspace_id).single();
          ownerId = ws?.owner_id;
        }
        if (ownerId) {
          const { data: profile } = await supabase.from('profiles').select('business_name, full_name').eq('id', ownerId).single();
          if (profile?.business_name) studioName = profile.business_name;
          else if (profile?.full_name) studioName = profile.full_name;
        }
      }

      // 3. Dispatch through Brevo with the one-time connection link
      const { EmailService } = await import('@/backend/email/email-service');
      const res = await EmailService.sendClientInvitation(client.email.trim(), {
        clientName: client.name || client.company || 'Client',
        freelancerName: studioName,
        portalUrl: inviteResult.url,
      }, { workspaceId: client.workspace_id, clientId: client.id });

      return {
        success: res.success,
        message: res.success ? `Invitation email successfully dispatched to ${client.email}` : res.error,
        inviteUrl: inviteResult.url,
        error: res.error,
      };
    } catch (err: any) {
      console.warn('Error sending client invitation email:', err);
      return { success: false, error: err.message || 'Failed to dispatch invitation email' };
    }
  },
};
