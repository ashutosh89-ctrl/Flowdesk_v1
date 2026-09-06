import { ClientRepository } from '@/backend/repositories/clients/client-service';
import { supabase } from '@/backend/utilities/supabase';
import { Client, ClientPortalConfig, AccountDeletionRecord } from '@/shared/types';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { AccountDeletionService } from '@/backend/auth/account-deletion-service';

/**
 * Freelancer-side Client Relationship & Management Service.
 * Exclusively used by the workspace owner to manage client accounts,
 * health scores, rates, and provision portal credentials.
 */
export const FreelancerClientManagementService = {
  getClients: async (): Promise<Client[]> => {
    if (DemoDataProvider.isDemo()) return DemoDataProvider.getClients();
    return ClientRepository.getClients();
  },
  getClientById: async (id: string): Promise<Client | undefined> => {
    if (DemoDataProvider.isDemo()) return DemoDataProvider.getClientById(id);
    return ClientRepository.getClientById(id);
  },
  createClient: async (clientData: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>): Promise<Client> => {
    const client = await ClientRepository.createClient(clientData);
    // Log activity (non-critical)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ws } = await supabase.from('workspaces').select('id').limit(1).single();
      if (ws) {
        await supabase.from('activities').insert({ workspace_id: ws.id, action: 'created_client', title: client.name, description: `Created client ${client.company}`, user_name: user?.email?.split('@')[0] || 'User', resource_type: 'client' });
      }
    } catch { /* non-critical */ }
    return client;
  },
  updateClient: async (id: string, updates: Partial<Client>): Promise<Client | undefined> => {
    return ClientRepository.updateClient(id, updates);
  },
  archiveClient: async (id: string): Promise<Client | undefined> => {
    return ClientRepository.updateClient(id, { status: 'archived' });
  },
  restoreClient: async (id: string): Promise<Client | undefined> => {
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
    return ClientRepository.deleteClient(id);
  },
  togglePortalAccess: async (clientId: string, enabled: boolean): Promise<ClientPortalConfig> => {
    try {
      const { data, error } = await supabase.from('clients').update({ portal_access_enabled: enabled }).eq('id', clientId).select().single();
      if (error || !data) throw error || new Error('Failed');
      return { clientId, enabled, magicKey: data.portal_token || '', portalUrl: `/portal/${data.id}` };
    } catch { throw new Error('Failed to toggle portal access'); }
  },
  regeneratePortalLink: async (clientId: string): Promise<ClientPortalConfig> => {
    try {
      const token = `pt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const { data, error } = await supabase.from('clients').update({ portal_token: token }).eq('id', clientId).select().single();
      if (error || !data) throw error || new Error('Failed');
      return { clientId, enabled: true, magicKey: token, portalUrl: `/portal/${data.id}` };
    } catch { throw new Error('Failed to regenerate portal link'); }
  },
  sendClientInvitationEmail: async (clientId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const { data: client } = await supabase.from('clients').select('id, name, email, company, portal_token, workspace_id').eq('id', clientId).single();
      if (!client || !client.email) {
        return { success: false, error: 'Client does not have a registered email address.' };
      }
      const { data: ws } = await supabase.from('workspaces').select('name, owner_id').eq('id', client.workspace_id).single();
      let studioName = ws?.name || 'FlowDesk Studio';
      if (ws?.owner_id) {
        const { data: profile } = await supabase.from('profiles').select('business_name, full_name').eq('id', ws.owner_id).single();
        if (profile?.business_name) studioName = profile.business_name;
      }
      // Canonical portal route is /portal/{clientId}; the portal token is
      // resolved server-side during auth, never used as the route identity.
      const { getAppBaseUrl, EmailService } = await import('@/backend/email');
      const portalUrl = `${getAppBaseUrl()}/portal/${client.id}`;
      const res = await EmailService.sendClientInvitation(client.email, {
        clientName: client.name || client.company || 'Client',
        freelancerName: studioName,
        portalUrl,
      }, { workspaceId: client.workspace_id, clientId: client.id });

      return {
        success: res.success,
        message: res.success ? `Invitation email successfully dispatched to ${client.email}` : res.error,
        error: res.error,
      };
    } catch (err: any) {
      console.warn('Error sending client invitation email:', err);
      return { success: false, error: err.message || 'Failed to dispatch invitation email' };
    }
  },
};

