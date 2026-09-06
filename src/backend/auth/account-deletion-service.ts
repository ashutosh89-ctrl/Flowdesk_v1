import { supabase, isDemoModeActive, isSupabaseConfigured } from '@/backend/utilities/supabase';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { AccountDeletionRecord, Client } from '@/shared/types';
import { getCurrentWorkspace } from '@/backend/utilities/workspace';

const CLIENT_SESSION_KEY = 'flowdesk_client_session';
const DEMO_DELETED_CLIENTS_KEY = 'flowdesk_demo_deleted_clients';
const DEMO_FREELANCER_DELETION_KEY = 'flowdesk_demo_freelancer_deletion';

export const AccountDeletionService = {
  /**
   * Client deletes their own account.
   * Enters a 30-day recovery window where ONLY their freelancer can restore it.
   */
  async deleteClientAccount(
    clientId: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!clientId) {
      return { success: false, error: 'Client ID is required.' };
    }

    const now = new Date();
    const restoreUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    // 1. Demo Mode
    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        const existing = JSON.parse(localStorage.getItem(DEMO_DELETED_CLIENTS_KEY) || '[]');
        existing.push({
          id: `del-${Date.now()}`,
          accountType: 'client',
          clientId,
          userId: userId || 'demo-user',
          deletedBy: clientId,
          deletedAt: now.toISOString(),
          restoreUntil: restoreUntil.toISOString(),
          daysRemaining: 30,
          status: 'pending_deletion',
        });
        localStorage.setItem(DEMO_DELETED_CLIENTS_KEY, JSON.stringify(existing));
        localStorage.removeItem(CLIENT_SESSION_KEY);
      }
      if (typeof document !== 'undefined') {
        document.cookie = 'flowdesk_client_demo=; path=/; max-age=0';
      }
      return { success: true };
    }

    // 2. Production Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const resolvedUserId = user?.id || userId;

      // Verify client record & workspace
      const { data: clientData, error: fetchErr } = await supabase
        .from('clients')
        .select('id, workspace_id, user_id, name, company')
        .eq('id', clientId)
        .maybeSingle();

      if (fetchErr || !clientData) {
        return { success: false, error: 'Client record not found.' };
      }

      // Mark client as pending_deletion
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          status: 'pending_deletion',
          deleted_at: now.toISOString(),
        })
        .eq('id', clientId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      // Record in account_deletions table
      await supabase.from('account_deletions').insert({
        account_type: 'client',
        user_id: resolvedUserId || clientData.user_id || null,
        workspace_id: clientData.workspace_id,
        client_id: clientId,
        deleted_by: resolvedUserId || clientId,
        deleted_at: now.toISOString(),
        restore_until: restoreUntil.toISOString(),
        status: 'pending_deletion',
        metadata: {
          client_name: clientData.name,
          client_company: clientData.company,
        },
      });

      // Log activity in workspace
      try {
        await supabase.from('activities').insert({
          workspace_id: clientData.workspace_id,
          client_id: clientId,
          action: 'client_account_deleted',
          title: 'Client Account Deletion Initiated',
          description: `${clientData.name} (${clientData.company}) scheduled account deletion. 30-day recovery window active.`,
          user_name: clientData.name,
          resource_type: 'client',
        });
      } catch { /* non-critical */ }

      // Invalidate client session
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CLIENT_SESSION_KEY);
      }
      if (typeof document !== 'undefined') {
        document.cookie = 'flowdesk_client_demo=; path=/; max-age=0';
      }
      await supabase.auth.signOut();

      return { success: true };
    } catch (err: any) {
      console.warn('Error deleting client account:', err);
      return { success: false, error: err.message || 'Failed to delete client account.' };
    }
  },

  /**
   * Freelancer restores a deleted client within the 30-day window.
   * Strictly authorized: current user MUST own the workspace.
   */
  async restoreClientAccount(clientId: string): Promise<{ success: boolean; client?: Client; error?: string }> {
    if (!clientId) {
      return { success: false, error: 'Client ID is required.' };
    }

    // 1. Demo Mode
    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        const existing: any[] = JSON.parse(localStorage.getItem(DEMO_DELETED_CLIENTS_KEY) || '[]');
        const updated = existing.filter((d) => d.clientId !== clientId);
        localStorage.setItem(DEMO_DELETED_CLIENTS_KEY, JSON.stringify(updated));
      }
      return { success: true };
    }

    // 2. Production Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Authentication required.' };
      }

      // Check client record and workspace ownership
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('id, workspace_id, name, company, user_id')
        .eq('id', clientId)
        .maybeSingle();

      if (clientErr || !clientData) {
        return { success: false, error: 'Client not found.' };
      }

      // Verify authenticated user owns this workspace
      const { data: wsData, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, owner_id')
        .eq('id', clientData.workspace_id)
        .maybeSingle();

      if (wsErr || !wsData || wsData.owner_id !== user.id) {
        return { success: false, error: 'Unauthorized: You do not own the workspace for this client.' };
      }

      // Check deletion record window
      const { data: deletionRecord } = await supabase
        .from('account_deletions')
        .select('id, restore_until, status')
        .eq('client_id', clientId)
        .eq('status', 'pending_deletion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deletionRecord) {
        const deadline = new Date(deletionRecord.restore_until);
        if (deadline.getTime() < Date.now()) {
          return { success: false, error: 'The 30-day recovery period has expired. This account cannot be restored.' };
        }

        // Update deletion record to restored
        await supabase
          .from('account_deletions')
          .update({
            status: 'restored',
            updated_at: new Date().toISOString(),
          })
          .eq('id', deletionRecord.id);
      }

      // Restore client status to active
      const { data: restored, error: restoreErr } = await supabase
        .from('clients')
        .update({
          status: 'active',
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .select()
        .single();

      if (restoreErr || !restored) {
        return { success: false, error: restoreErr?.message || 'Failed to restore client.' };
      }

      // Log restoration activity
      try {
        await supabase.from('activities').insert({
          workspace_id: clientData.workspace_id,
          client_id: clientId,
          action: 'client_account_restored',
          title: 'Client Account Restored',
          description: `Freelancer restored access for ${clientData.name} (${clientData.company}).`,
          user_name: user.email?.split('@')[0] || 'Freelancer',
          resource_type: 'client',
        });
      } catch { /* non-critical */ }

      return {
        success: true,
        client: {
          id: restored.id,
          userId: restored.user_id,
          portalToken: restored.portal_token,
          name: restored.name,
          company: restored.company,
          email: restored.email,
          phone: restored.phone || '',
          status: restored.status,
          totalBilled: Number(restored.total_billed) || 0,
          activeProjectsCount: restored.active_projects_count || 0,
          country: restored.country || 'United States',
          currency: restored.currency || 'USD',
          createdAt: restored.created_at?.split('T')[0] || '',
        },
      };
    } catch (err: any) {
      console.warn('Error restoring client account:', err);
      return { success: false, error: err.message || 'Failed to restore client.' };
    }
  },

  /**
   * Get all deleted clients for the current freelancer workspace (within 30-day window).
   */
  async getDeletedClients(workspaceId?: string): Promise<AccountDeletionRecord[]> {
    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        const stored = JSON.parse(localStorage.getItem(DEMO_DELETED_CLIENTS_KEY) || '[]');
        return stored.map((d: any) => {
          const deadline = new Date(d.restoreUntil).getTime();
          const days = Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24)));
          return { ...d, daysRemaining: days };
        });
      }
      return [];
    }

    try {
      const ws = workspaceId ? { id: workspaceId } : await getCurrentWorkspace();
      if (!ws?.id) return [];

      const { data, error } = await supabase
        .from('account_deletions')
        .select('*, clients(id, name, company, email)')
        .eq('workspace_id', ws.id)
        .eq('account_type', 'client')
        .eq('status', 'pending_deletion')
        .order('deleted_at', { ascending: false });

      if (error || !data) return [];

      return data.map((d: any) => {
        const deadline = new Date(d.restore_until).getTime();
        const days = Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24)));
        return {
          id: d.id,
          accountType: 'client',
          userId: d.user_id,
          workspaceId: d.workspace_id,
          clientId: d.client_id,
          clientName: d.clients?.name || d.metadata?.client_name || 'Client',
          clientCompany: d.clients?.company || d.metadata?.client_company || 'Company',
          deletedBy: d.deleted_by,
          deletedAt: d.deleted_at?.split('T')[0] || '',
          restoreUntil: d.restore_until?.split('T')[0] || '',
          daysRemaining: days,
          status: d.status,
          metadata: d.metadata,
        };
      });
    } catch (err) {
      console.warn('Error fetching deleted clients:', err);
      return [];
    }
  },

  /**
   * Freelancer deletes their own account.
   * Enters a 5-day recovery window.
   */
  async deleteFreelancerAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
      return { success: false, error: 'User ID is required.' };
    }

    const now = new Date();
    const restoreUntil = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days

    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DEMO_FREELANCER_DELETION_KEY, JSON.stringify({
          userId,
          deletedAt: now.toISOString(),
          restoreUntil: restoreUntil.toISOString(),
          daysRemaining: 5,
        }));
        localStorage.removeItem('flowdesk_demo_active');
      }
      return { success: true };
    }

    try {
      const ws = await getCurrentWorkspace();
      const wsId = ws?.id;

      // Update workspace & profile status to pending_deletion
      if (wsId) {
        await supabase.from('workspaces').update({
          status: 'pending_deletion',
          deleted_at: now.toISOString(),
        }).eq('id', wsId);
      }

      await supabase.from('profiles').update({
        status: 'pending_deletion',
        deleted_at: now.toISOString(),
      }).eq('id', userId);

      // Record in account_deletions
      await supabase.from('account_deletions').insert({
        account_type: 'freelancer',
        user_id: userId,
        workspace_id: wsId || null,
        deleted_by: userId,
        deleted_at: now.toISOString(),
        restore_until: restoreUntil.toISOString(),
        status: 'pending_deletion',
      });

      // Dispatch account deletion scheduled email with grace period info
      try {
        const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', userId).single();
        if (profile?.email) {
          const { EmailService } = await import('@/backend/email/email-service');
          const { getAppBaseUrl } = await import('@/shared/utils/url');
          await EmailService.sendAccountDeleted(profile.email, {
            name: profile.full_name || 'User',
            action: 'scheduled_deletion',
            gracePeriodDays: 5,
            restoreUntil: restoreUntil.toISOString().split('T')[0],
            restoreUrl: `${getAppBaseUrl()}/recover`,
          }, { workspaceId: wsId || undefined, userId });
        }
      } catch (emailErr) {
        console.warn('[AccountDeletionService] Email dispatch notice (deletion):', emailErr);
      }

      // Sign out
      await supabase.auth.signOut();

      return { success: true };
    } catch (err: any) {
      console.warn('Error deleting freelancer account:', err);
      return { success: false, error: err.message || 'Failed to delete freelancer account.' };
    }
  },

  /**
   * Freelancer restores their account during the 5-day window.
   */
  async restoreFreelancerAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
      return { success: false, error: 'User ID is required.' };
    }

    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DEMO_FREELANCER_DELETION_KEY);
        localStorage.setItem('flowdesk_demo_active', 'true');
      }
      return { success: true };
    }

    try {
      // Find pending deletion record
      const { data: record } = await supabase
        .from('account_deletions')
        .select('*')
        .eq('user_id', userId)
        .eq('account_type', 'freelancer')
        .eq('status', 'pending_deletion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (record) {
        const deadline = new Date(record.restore_until).getTime();
        if (deadline < Date.now()) {
          return { success: false, error: 'The 5-day restoration window has expired. Account cannot be recovered.' };
        }

        await supabase
          .from('account_deletions')
          .update({
            status: 'restored',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      }

      // Restore profile and workspace
      await supabase.from('profiles').update({
        status: 'active',
        deleted_at: null,
      }).eq('id', userId);

      if (record?.workspace_id) {
        await supabase.from('workspaces').update({
          status: 'active',
          deleted_at: null,
        }).eq('id', record.workspace_id);
      }

      // Dispatch account restored email confirmation
      try {
        const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', userId).single();
        if (profile?.email) {
          const { EmailService } = await import('@/backend/email/email-service');
          await EmailService.sendAccountRestored(profile.email, {
            name: profile.full_name || 'User',
            action: 'restored',
          }, { workspaceId: record?.workspace_id || undefined, userId });
        }
      } catch (emailErr) {
        console.warn('[AccountDeletionService] Email dispatch notice (restoration):', emailErr);
      }

      return { success: true };
    } catch (err: any) {
      console.warn('Error restoring freelancer account:', err);
      return { success: false, error: err.message || 'Failed to restore freelancer account.' };
    }
  },

  /**
   * Check if a user is currently in pending_deletion status.
   */
  async getFreelancerDeletionStatus(userId: string): Promise<{ isPendingDeletion: boolean; restoreUntil?: string; daysRemaining?: number }> {
    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(DEMO_FREELANCER_DELETION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const deadline = new Date(parsed.restoreUntil).getTime();
          const days = Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24)));
          return { isPendingDeletion: true, restoreUntil: parsed.restoreUntil, daysRemaining: days };
        }
      }
      return { isPendingDeletion: false };
    }

    try {
      const { data } = await supabase
        .from('account_deletions')
        .select('*')
        .eq('user_id', userId)
        .eq('account_type', 'freelancer')
        .eq('status', 'pending_deletion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const deadline = new Date(data.restore_until).getTime();
        const days = Math.max(0, Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24)));
        return { isPendingDeletion: true, restoreUntil: data.restore_until, daysRemaining: days };
      }
    } catch { /* ignore */ }

    return { isPendingDeletion: false };
  },

  /**
   * Permanent Hard Deletion of expired accounts.
   * Runs server-side or via routine sweep.
   */
  async hardDeleteExpiredClient(clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Get client details & workspace
      const { data: client } = await supabase
        .from('clients')
        .select('id, workspace_id')
        .eq('id', clientId)
        .single();

      if (!client) return { success: true };

      // 2. Delete storage files belonging to this client
      try {
        const { data: docs } = await supabase
          .from('documents')
          .select('file_url')
          .eq('client_id', clientId);

        if (docs && docs.length > 0) {
          for (const doc of docs) {
            if (doc.file_url) {
              await StorageHelper.deleteFile('documents', doc.file_url);
            }
          }
        }
      } catch { /* non-critical storage cleanup */ }

      // 3. Delete database records (Preserving financial ledger history)
      // For invoices with payment records or receipts, preserve the financial ledger by detaching client
      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('id, paid_amount')
        .eq('client_id', clientId);

      const paidInvoiceIds = (paidInvoices || [])
        .filter((inv) => Number(inv.paid_amount) > 0)
        .map((inv) => inv.id);

      if (paidInvoiceIds.length > 0) {
        // Anonymize/detach client association to preserve tax & ledger audit trail
        await supabase
          .from('invoices')
          .update({
            client_id: null,
            client_name: 'Archived Client',
            client_email: 'deleted@archived.local',
          })
          .in('id', paidInvoiceIds);
      }

      // Delete unpaid/draft invoices and non-financial records
      await Promise.all([
        supabase.from('deliverables').delete().eq('client_id', clientId),
        supabase.from('documents').delete().eq('client_id', clientId),
        supabase.from('invoices').delete().eq('client_id', clientId), // Deletes remaining unpaid invoices
        supabase.from('workspace_comments').delete().eq('client_id', clientId),
        supabase.from('notifications').delete().eq('client_id', clientId),
        supabase.from('activities').delete().eq('client_id', clientId),
        supabase.from('projects').delete().eq('client_id', clientId),
      ]);

      // 4. Delete client record
      await supabase.from('clients').delete().eq('id', clientId);

      // 5. Update deletion record status
      await supabase
        .from('account_deletions')
        .update({ status: 'permanently_deleted', updated_at: new Date().toISOString() })
        .eq('client_id', clientId);

      return { success: true };
    } catch (err: any) {
      console.warn('Hard delete expired client error:', err);
      return { success: false, error: err.message };
    }
  },
};
