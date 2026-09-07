export * from './client-management-service';

import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { getCurrentWorkspace } from '@/backend/utilities/workspace';
import { NotificationHelper } from '@/backend/utilities/notification-helper';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { UserSettingsService } from '@/backend/auth/user-settings-service';
import { FlowDeskStore } from '@/backend/store/storage-store';

/** Helper: format bytes to human-readable string */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/** Helper: get current user display name from profile or session */
const getCurrentUserName = async (): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'User';
    // Try to get profile name
    const { data: profile } = await supabase.from('profiles').select('full_name, business_name').eq('id', user.id).single();
    if (profile?.full_name) return profile.full_name;
    if (profile?.business_name) return profile.business_name;
    return user.email?.split('@')[0] || 'User';
  } catch {
    return 'User';
  }
};

/** Helper: non-critical activity logging after successful mutations */
const logActivitySafe = async (action: string, target: string, category: string = 'client') => {
  try {
    const wsId = await getCurrentWorkspace();
    if (!wsId?.id) return;
    const userName = await getCurrentUserName();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('activities').insert({
      workspace_id: wsId.id,
      user_id: user?.id || null,
      action,
      title: target,
      description: action,
      user_name: userName,
      resource_type: category,
    });
  } catch { /* non-critical, silently skip */ }
};
import { ClientRepository } from '@/backend/repositories/clients/client-service';
import { FreelancerClientManagementService } from './client-management-service';
import {
  Client,
  Project,
  Deliverable,
  DocumentItem,
  Invoice,
  ActivityLog,
  NotificationItem,
  UserProfile,
  DashboardMetrics,
  WorkspaceSummary,
  WorkspaceComment,
  ClientPortalConfig,
  WorkspaceProgressBreakdown,
  WorkspaceHealthDetails,
  FinancialDashboardMetrics,
} from '@/shared/types';

export const FreelancerClientService = FreelancerClientManagementService;

export const FreelancerWorkspaceService = {
  getActiveWorkspaceId: async (): Promise<string | null> => {
    const ws = await getCurrentWorkspace();
    return ws ? ws.id : null;
  },
  getWorkspaceSummary: async (clientId: string): Promise<WorkspaceSummary | null> => {
    try {
      const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
      if (!wsId) return null;
      const [clients, projects, deliverables, documents, invoices] = await Promise.all([
        FreelancerClientService.getClients(),
        FreelancerProjectService.getProjectsByClientId(clientId),
        FreelancerDeliverableService.getDeliverables(clientId),
        FreelancerDocumentService.getDocuments(clientId),
        FreelancerInvoiceService.getInvoices(clientId),
      ]);
      const client = clients.find(c => c.id === clientId);
      if (!client) return null;
      return {
        clientId,
        client,
        projects,
        deliverables,
        documents,
        invoices,
        comments: [],
        activities: [],
        portalConfig: { clientId, enabled: false, magicKey: '' },
        healthScore: 0,
        health: { score: 0, status: 'Healthy' as const, reasons: [] },
      };
    } catch { return null; }
  },
  addComment: async (clientId: string, text: string, author?: string, avatar?: string): Promise<WorkspaceComment> => {
    return CommentService.addComment(clientId, { text, author, avatar, isOwner: true });
  },
  deleteComment: async (commentId: string): Promise<boolean> => {
    return CommentService.deleteComment(commentId);
  },
  requestDocument: async (clientId: string, title: string, type: DocumentItem['type']): Promise<DocumentItem> => {
    return FreelancerDocumentService.requestDocument(clientId, { title, type });
  },
  uploadDocumentPlaceholder: async (clientId: string, title: string, type: DocumentItem['type'], size?: string): Promise<DocumentItem> => {
    return FreelancerDocumentService.requestDocument(clientId, { title, type });
  },
  updateDocumentStatus: async (id: string, status: DocumentItem['status']): Promise<DocumentItem | undefined> => {
    if (status === 'verified') return FreelancerDocumentService.verifyDocument(id);
    if (status === 'rejected') return FreelancerDocumentService.rejectDocument(id, 'Document does not meet requirements');
    return FreelancerDocumentService.getDocuments().then(docs => docs.find(d => d.id === id));
  },
  addDeliverable: async (del: Omit<Deliverable, 'id'>): Promise<Deliverable> => {
    return FreelancerDeliverableService.addDeliverable(del);
  },
  updateDeliverableStatus: async (id: string, status: Deliverable['status'], note?: string): Promise<Deliverable | undefined> => {
    if (status === 'approved') return FreelancerDeliverableService.approveDeliverable(id, note);
    if (status === 'revision_requested') return FreelancerDeliverableService.requestDeliverableRevision(id, note || 'Revision requested');
    return FreelancerDeliverableService.updateDeliverable(id, { status });
  },
  togglePortalAccess: async (clientId: string, enabled: boolean): Promise<ClientPortalConfig> => {
    return FreelancerClientManagementService.togglePortalAccess(clientId, enabled);
  },
  getOrCreateConnectionLink: async (clientId: string): Promise<{ success: boolean; url: string; rawToken?: string; error?: string }> => {
    return FreelancerClientManagementService.getOrCreateConnectionLink(clientId);
  },
  regeneratePortalLink: async (clientId: string): Promise<ClientPortalConfig> => {
    return FreelancerClientManagementService.regeneratePortalLink(clientId);
  },
};

export const FreelancerDashboardService = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    if (DemoDataProvider.isDemo()) return DemoDataProvider.getDashboardMetrics();
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return { totalRevenue: 0, monthlyRevenue: 0, activeClientsCount: 0, pendingInvoicesAmount: 0, completedProjectsCount: 0, upcomingDeliverablesCount: 0, activeProjectsCount: 0, revenueHistory: [] };

    try {
      const { data: clients } = await supabase.from('clients').select('id, total_billed').eq('workspace_id', wsId);
      const { data: projects } = await supabase.from('projects').select('id, status').eq('workspace_id', wsId);
      const { data: deliverables } = await supabase.from('deliverables').select('id, status').eq('workspace_id', wsId);
      const { data: invoices } = await supabase.from('invoices').select('id, status, total_amount, paid_amount, updated_at, created_at').eq('workspace_id', wsId);

      const activeClients = clients?.length || 0;
      const activeProjs = projects?.filter((p) => p.status === 'in_progress').length || 0;
      const completedProjs = projects?.filter((p) => p.status === 'completed').length || 0;
      const upcomingDelivs = deliverables?.filter((d) => d.status !== 'approved' && d.status !== 'completed').length || 0;

      const totalRev = clients?.reduce((acc, c) => acc + (Number(c.total_billed) || 0), 0) || 0;
      const pendingInvAmount = invoices
        ?.filter((i) => i.status === 'pending' || i.status === 'sent' || i.status === 'draft')
        .reduce((acc, i) => acc + (Number(i.total_amount) - Number(i.paid_amount) || 0), 0) || 0;

      // Build real revenue history from actual invoice payment dates
      const revenueHistory: { month: string; amount: number }[] = [];
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = monthNames[targetDate.getMonth()];
        const year = targetDate.getFullYear();
        const monthRevenue = invoices
          ?.filter((inv) => {
            if (inv.status !== 'paid') return false;
            const invDate = new Date(inv.updated_at || inv.created_at || '');
            return invDate.getMonth() === targetDate.getMonth() && invDate.getFullYear() === year;
          })
          .reduce((acc, inv) => acc + (Number(inv.paid_amount) || Number(inv.total_amount) || 0), 0) || 0;
        revenueHistory.push({ month, amount: monthRevenue });
      }

      return {
        totalRevenue: totalRev,
        monthlyRevenue: Math.round(totalRev / 12) || 0,
        activeClientsCount: activeClients,
        pendingInvoicesAmount: pendingInvAmount,
        completedProjectsCount: completedProjs,
        upcomingDeliverablesCount: upcomingDelivs,
        activeProjectsCount: activeProjs,
        revenueHistory,
      };
    } catch {
      return { totalRevenue: 0, monthlyRevenue: 0, activeClientsCount: 0, pendingInvoicesAmount: 0, completedProjectsCount: 0, upcomingDeliverablesCount: 0, activeProjectsCount: 0, revenueHistory: [] };
    }
  },
};

export const FreelancerProjectService = {
  getProjects: async (): Promise<Project[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getProjects();
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((p) => ({
        id: p.id,
        clientId: p.client_id,
        clientName: p.client_name || 'Client Workspace',
        title: p.title,
        description: p.description || '',
        status: p.status || 'in_progress',
        budget: Number(p.budget) || 0,
        spent: Number(p.spent) || 0,
        startDate: p.start_date || new Date().toISOString().split('T')[0],
        dueDate: p.due_date || new Date().toISOString().split('T')[0],
        completionPercentage: p.completion_percentage || 0,
        tags: p.tags || ['Design System'],
        milestones: p.milestones || [],
      }));
    } catch {
      return [];
    }
  },
  getProjectsByClientId: async (clientId: string): Promise<Project[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getProjectsByClientId(clientId);
    const projs = await FreelancerProjectService.getProjects();
    return projs.filter((p) => p.clientId === clientId);
  },
  getProjectById: async (id: string): Promise<Project | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getProjectById(id);
    const projs = await FreelancerProjectService.getProjects();
    return projs.find((p) => p.id === id);
  },
  createProject: async (project: Omit<Project, 'id' | 'completionPercentage' | 'spent'>): Promise<Project> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.createProject(project as any);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) throw new Error('No active workspace');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        workspace_id: wsId,
        client_id: project.clientId,
        user_id: user?.id || null,
        client_name: project.clientName,
        title: project.title,
        description: project.description,
        status: project.status || 'in_progress',
        budget: project.budget || 0,
        spent: 0,
        completion_percentage: 0,
        start_date: project.startDate,
        due_date: project.dueDate,
        tags: project.tags || [],
        milestones: JSON.stringify(project.milestones || []),
      };

      const { data, error } = await supabase.from('projects').insert(payload).select().single();
      if (error || !data) throw new Error('Failed to create project');

      // Log activity
      logActivitySafe('created_project', data.title, 'project');

      return {
        id: data.id,
        clientId: data.client_id,
        clientName: data.client_name,
        title: data.title,
        description: data.description,
        status: data.status,
        budget: Number(data.budget),
        spent: Number(data.spent),
        startDate: data.start_date,
        dueDate: data.due_date,
        completionPercentage: data.completion_percentage,
        tags: data.tags || [],
        milestones: data.milestones || [],
      };
    } catch (err) {
      throw err;
    }
  },
  addProject: async (project: Omit<Project, 'id' | 'completionPercentage' | 'spent'>): Promise<Project> => {
    return FreelancerProjectService.createProject(project);
  },
  updateProject: async (id: string, updates: Partial<Project>): Promise<Project | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.updateProject(id, updates);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.budget !== undefined) payload.budget = updates.budget;
      if (updates.completionPercentage !== undefined) payload.completion_percentage = updates.completionPercentage;
      if (updates.milestones !== undefined) payload.milestones = JSON.stringify(updates.milestones);
      const { error } = await supabase.from('projects').update(payload).eq('id', id).eq('workspace_id', wsId);
      if (error) { console.warn('Supabase project update error:', error.message); return undefined; }
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      if (!data) return undefined;
      return { id: data.id, clientId: data.client_id, clientName: data.client_name || 'Client Workspace', title: data.title, description: data.description || '', status: data.status || 'in_progress', budget: Number(data.budget) || 0, spent: Number(data.spent) || 0, startDate: data.start_date || new Date().toISOString().split('T')[0], dueDate: data.due_date || new Date().toISOString().split('T')[0], completionPercentage: data.completion_percentage || 0, tags: data.tags || [], milestones: data.milestones || [] };
    } catch { return undefined; }
  },
  toggleMilestone: async (projectId: string, milestoneId: string): Promise<Project | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.toggleMilestone(projectId, milestoneId);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { data: proj } = await supabase.from('projects').select('milestones').eq('id', projectId).eq('workspace_id', wsId).single();
      if (!proj) return undefined;
      const milestones = Array.isArray(proj.milestones) ? proj.milestones : [];
      const updated = milestones.map((m: any) => (m.id === milestoneId ? { ...m, completed: !m.completed } : m));
      await supabase.from('projects').update({ milestones: JSON.stringify(updated), updated_at: new Date().toISOString() }).eq('id', projectId).eq('workspace_id', wsId);
      const { data: refreshed } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (!refreshed) return undefined;
      return { id: refreshed.id, clientId: refreshed.client_id, clientName: refreshed.client_name || 'Client Workspace', title: refreshed.title, description: refreshed.description || '', status: refreshed.status || 'in_progress', budget: Number(refreshed.budget) || 0, spent: Number(refreshed.spent) || 0, startDate: refreshed.start_date || '', dueDate: refreshed.due_date || '', completionPercentage: refreshed.completion_percentage || 0, tags: refreshed.tags || [], milestones: refreshed.milestones || [] };
    } catch { return undefined; }
  },
  addMilestone: async (projectId: string, title: string, dueDate: string): Promise<Project | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.addMilestone(projectId, title, dueDate);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { data: proj } = await supabase.from('projects').select('milestones').eq('id', projectId).eq('workspace_id', wsId).single();
      if (!proj) return undefined;
      const milestones = Array.isArray(proj.milestones) ? proj.milestones : [];
      const newMilestone = { id: `ms-${Date.now()}`, title, dueDate, completed: false };
      milestones.push(newMilestone);
      await supabase.from('projects').update({ milestones: JSON.stringify(milestones), updated_at: new Date().toISOString() }).eq('id', projectId).eq('workspace_id', wsId);
      const { data: refreshed } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (!refreshed) return undefined;
      return { id: refreshed.id, clientId: refreshed.client_id, clientName: refreshed.client_name || 'Client Workspace', title: refreshed.title, description: refreshed.description || '', status: refreshed.status || 'in_progress', budget: Number(refreshed.budget) || 0, spent: Number(refreshed.spent) || 0, startDate: refreshed.start_date || '', dueDate: refreshed.due_date || '', completionPercentage: refreshed.completion_percentage || 0, tags: refreshed.tags || [], milestones: refreshed.milestones || [] };
    } catch { return undefined; }
  },
  markProjectComplete: async (id: string): Promise<Project | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.markProjectComplete(id);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      await supabase.from('projects').update({ status: 'completed', completion_percentage: 100, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', wsId);
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      if (!data) return undefined;
      return { id: data.id, clientId: data.client_id, clientName: data.client_name || 'Client Workspace', title: data.title, description: data.description || '', status: data.status || 'completed', budget: Number(data.budget) || 0, spent: Number(data.spent) || 0, startDate: data.start_date || '', dueDate: data.due_date || '', completionPercentage: data.completion_percentage || 100, tags: data.tags || [], milestones: data.milestones || [] };
    } catch { return undefined; }
  },
};

export const FreelancerDocumentService = {
  getDocuments: async (clientId?: string): Promise<DocumentItem[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getDocuments(clientId);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      let query = supabase.from('documents').select('*').eq('workspace_id', wsId);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) return [];

      return Promise.all(data.map(async (d) => ({
        id: d.id,
        clientId: d.client_id,
        title: d.title,
        description: d.description || '',
        type: d.type || 'other',
        status: d.status || 'pending',
        isRequired: Boolean(d.is_required),
        dueDate: d.due_date || '',
        updatedAt: d.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        size: d.size || '1.2 MB',
        fileName: d.file_name || d.title,
        downloadUrl: await StorageHelper.getDownloadUrl('documents', d.file_url || ''),
      })));
    } catch {
      return [];
    }
  },
  requestDocument: async (
    clientId: string,
    data: { title: string; type: DocumentItem['type']; isRequired?: boolean; dueDate?: string; description?: string }
  ): Promise<DocumentItem> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.requestDocument(clientId, data);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) throw new Error('No active workspace');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        workspace_id: wsId,
        client_id: clientId,
        user_id: user?.id || null,
        title: data.title,
        type: data.type,
        status: 'pending',
        is_required: data.isRequired ?? true,
        due_date: data.dueDate || new Date().toISOString().split('T')[0],
        description: data.description || '',
      };

      const { data: res, error } = await supabase.from('documents').insert(payload).select().single();
      if (error || !res) throw new Error('Failed to request document');

      // Notify client about document request
      NotificationHelper.documentRequested(data.title, clientId);

      return {
        id: res.id,
        clientId: res.client_id,
        title: res.title,
        description: res.description,
        type: res.type,
        status: res.status,
        isRequired: res.is_required,
        dueDate: res.due_date,
        updatedAt: res.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        size: '1.2 MB',
      };
    } catch (err) {
      throw err;
    }
  },
  createDocument: async (docData: any): Promise<DocumentItem> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.uploadDirectDocument(docData.clientId, docData);
    }
    return FreelancerDocumentService.requestDocument(docData.clientId, docData);
  },
  uploadDocument: async (docData: any): Promise<DocumentItem> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.uploadDirectDocument(docData.clientId, docData);
    }
    return FreelancerDocumentService.requestDocument(docData.clientId, docData);
  },
  reorderDocuments: async (clientId: string, docIds: string[]): Promise<DocumentItem[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.reorderDocuments(clientId, docIds);
    // Reorder is not supported via Supabase; return current order
    return FreelancerDocumentService.getDocuments(clientId);
  },
  uploadDocumentFile: async (
    docId: string,
    fileData: { fileName?: string; size?: string; downloadUrl?: string; file?: File }
  ): Promise<DocumentItem | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.uploadDocumentFile(docId, fileData);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const payload: any = { status: 'uploaded', updated_at: new Date().toISOString() };
      if (fileData.fileName) payload.file_name = fileData.fileName;
      if (fileData.size) payload.size = fileData.size;

      // Upload to Supabase Storage if File object provided
      if (fileData.file) {
        const result = await StorageHelper.uploadFile('documents', wsId, `documents/${docId}`, fileData.file);
        if (!result.error && result.path) { payload.file_url = result.path; }
      }

      const { error } = await supabase.from('documents').update(payload).eq('id', docId).eq('workspace_id', wsId);
      if (error) { console.warn('Supabase document upload error:', error.message); return undefined; }
      const { data } = await supabase.from('documents').select('*').eq('id', docId).single();
      if (!data) return undefined;
      return { id: data.id, clientId: data.client_id, title: data.title, description: data.description || '', type: data.type || 'other', status: data.status || 'uploaded', isRequired: Boolean(data.is_required), dueDate: data.due_date || '', updatedAt: data.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0], size: data.size || '1.2 MB', fileName: data.file_name || data.title, downloadUrl: await StorageHelper.getDownloadUrl('documents', data.file_url || '') };
    } catch { return undefined; }
  },
  verifyDocument: async (docId: string, notes?: string): Promise<DocumentItem | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.verifyDocument(docId, notes);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { error } = await supabase.from('documents').update({ status: 'verified', updated_at: new Date().toISOString() }).eq('id', docId).eq('workspace_id', wsId);
      if (error) return undefined;
      const { data } = await supabase.from('documents').select('*').eq('id', docId).single();
      if (!data) return undefined;

      logActivitySafe('verified_document', data.title, 'document');
      NotificationHelper.documentVerified(data.title, data.client_id);

      return { id: data.id, clientId: data.client_id, title: data.title, description: data.description || '', type: data.type || 'other', status: data.status || 'verified', isRequired: Boolean(data.is_required), dueDate: data.due_date || '', updatedAt: data.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0], size: data.size || '1.2 MB', fileName: data.file_name || data.title, downloadUrl: await StorageHelper.getDownloadUrl('documents', data.file_url || '') };
    } catch { return undefined; }
  },
  rejectDocument: async (docId: string, reason: string): Promise<DocumentItem | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.rejectDocument(docId, reason);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { error } = await supabase.from('documents').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', docId).eq('workspace_id', wsId);
      if (error) return undefined;
      const { data } = await supabase.from('documents').select('*').eq('id', docId).single();
      if (!data) return undefined;

      logActivitySafe('rejected_document', data.title, 'document');
      NotificationHelper.documentRejected(data.title, data.client_id);

      return { id: data.id, clientId: data.client_id, title: data.title, description: data.description || '', type: data.type || 'other', status: data.status || 'rejected', isRequired: Boolean(data.is_required), dueDate: data.due_date || '', updatedAt: data.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0], size: data.size || '1.2 MB', fileName: data.file_name || data.title, downloadUrl: await StorageHelper.getDownloadUrl('documents', data.file_url || '') };
    } catch { return undefined; }
  },
  requestReupload: async (docId: string, reason: string): Promise<DocumentItem | undefined> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      await supabase.from('documents').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', docId).eq('workspace_id', wsId);
      const { data } = await supabase.from('documents').select('*').eq('id', docId).single();
      if (!data) return undefined;
      return { id: data.id, clientId: data.client_id, title: data.title, description: data.description || '', type: data.type || 'other', status: data.status || 'pending', isRequired: Boolean(data.is_required), dueDate: data.due_date || '', updatedAt: data.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0], size: data.size || '1.2 MB', fileName: data.file_name || data.title, downloadUrl: await StorageHelper.getDownloadUrl('documents', data.file_url || '') };
    } catch { return undefined; }
  },
  deleteDocument: async (docId: string): Promise<boolean> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.deleteDocument(docId);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return false;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', docId).eq('workspace_id', wsId);
      return !error;
    } catch { return false; }
  },
};

export const FreelancerDeliverableService = {
  getDeliverables: async (clientId?: string, includeArchived?: boolean): Promise<Deliverable[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getDeliverables(clientId, includeArchived);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      let query = supabase.from('deliverables').select('*').eq('workspace_id', wsId);
      if (clientId) query = query.eq('client_id', clientId);
      if (!includeArchived) query = query.neq('status', 'archived');

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) return [];

      return data.map((d) => ({
        id: d.id,
        projectId: d.project_id || '',
        clientId: d.client_id,
        clientName: d.client_name || 'Client Workspace',
        title: d.title,
        description: d.description || '',
        status: d.status || 'draft',
        approvalStatus: d.approval_status || 'pending',
        priority: d.priority || 'medium',
        dueDate: d.due_date || new Date().toISOString().split('T')[0],
        reviewDeadline: d.review_deadline || undefined,
        version: d.current_version || 'v1.0',
        internalNotes: d.internal_notes || '',
        submissionMessage: d.submission_message || '',
        commentsCount: d.comments_count || 0,
        filesCount: d.files_count || 0,
        isArchived: d.status === 'archived',
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch (err) {
      console.warn('Error fetching deliverables:', err);
      return [];
    }
  },
  getDeliverableById: async (id: string): Promise<Deliverable | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.getDeliverableById(id);
    try {
      const { data, error } = await supabase.from('deliverables').select('*').eq('id', id).single();
      if (error || !data) return undefined;

      // Fetch related data in parallel
      const [versionsResult, filesResult, commentsResult] = await Promise.all([
        supabase.from('deliverable_versions').select('*').eq('deliverable_id', id).order('created_at', { ascending: false }),
        supabase.from('deliverable_files').select('*').eq('deliverable_id', id),
        supabase.from('deliverable_comments').select('*').eq('deliverable_id', id).order('created_at', { ascending: true }),
      ]);

      const versions = (versionsResult.data || []).map((v: any) => ({
        id: v.id,
        deliverableId: v.deliverable_id,
        version: v.version_number,
        versionNumber: v.version_number,
        date: v.created_at?.split('T')[0] || '',
        note: v.note || '',
        fileUrl: v.file_url || '',
        fileName: v.file_name || '',
        fileSize: v.file_size || '',
        uploadedBy: v.uploaded_by || '',
        isArchived: Boolean(v.archived),
        isCurrentVersion: v.version_number === data.current_version,
        createdDate: v.created_at?.split('T')[0] || '',
      }));

      const files = await Promise.all((filesResult.data || []).map(async (f: any) => ({
        id: f.id,
        deliverableId: f.deliverable_id,
        fileName: f.file_name || '',
        fileSize: f.file_size || '',
        fileType: f.file_type || '',
        fileUrl: f.file_url ? await StorageHelper.getDownloadUrl('deliverables', f.file_url) : '',
        uploadedAt: f.uploaded_at?.split('T')[0] || f.created_at?.split('T')[0] || '',
        uploadedBy: f.uploaded_by || '',
        isPinned: Boolean(f.is_pinned),
        folder: f.folder || '',
      })));

      const comments = (commentsResult.data || []).filter((c: any) => !c.is_internal).map((c: any) => ({
        id: c.id,
        deliverableId: c.deliverable_id,
        author: c.author || 'User',
        authorRole: c.author_role || 'freelancer',
        isInternal: Boolean(c.is_internal),
        timestamp: c.created_at?.split('T')[0] || '',
        content: c.content || '',
        attachments: c.attachments || [],
        isResolved: Boolean(c.resolved),
      }));

      return {
        id: data.id,
        projectId: data.project_id || '',
        clientId: data.client_id,
        clientName: data.client_name || '',
        title: data.title,
        description: data.description || '',
        status: data.status || 'draft',
        approvalStatus: data.approval_status || 'pending',
        priority: data.priority || 'medium',
        dueDate: data.due_date || new Date().toISOString().split('T')[0],
        reviewDeadline: data.review_deadline || undefined,
        version: data.current_version || 'v1.0',
        internalNotes: data.internal_notes || '',
        submissionMessage: data.submission_message || '',
        rejectionReason: data.rejection_reason || undefined,
        commentsCount: data.comments_count || comments.length,
        filesCount: data.files_count || files.length,
        files,
        versionHistory: versions,
        comments,
        isArchived: data.status === 'archived',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.warn('Error fetching deliverable by ID:', err);
      return undefined;
    }
  },
  createDeliverable: async (delData: any): Promise<Deliverable> => {
    return FreelancerDeliverableService.addDeliverable(delData);
  },
  addDeliverable: async (delData: Omit<Deliverable, 'id'> & { file?: File; fileUrl?: string; fileName?: string; fileSize?: string }): Promise<Deliverable> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.addDeliverable(delData as any);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) throw new Error('No active workspace');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        workspace_id: wsId,
        client_id: delData.clientId,
        project_id: delData.projectId || null,
        user_id: user?.id || null,
        client_name: delData.clientName,
        title: delData.title,
        description: delData.description,
        status: delData.status || 'draft',
        priority: delData.priority || 'medium',
        due_date: delData.dueDate,
        review_deadline: delData.reviewDeadline || null,
        current_version: delData.version || 'v1.0',
        internal_notes: delData.internalNotes || '',
        submission_message: delData.submissionMessage || '',
        approval_status: delData.approvalStatus || 'pending',
      };

      const { data, error } = await supabase.from('deliverables').insert(payload).select().single();
      if (error || !data) throw new Error('Failed to create deliverable');

      logActivitySafe('created_deliverable', data.title, 'deliverable');

      // Handle file upload if a file was provided
      const fileToUpload = (delData as any).file as File | undefined;
      if (fileToUpload && typeof StorageHelper !== 'undefined') {
        try {
          // Validate file size (50MB limit)
          if (fileToUpload.size > 50 * 1024 * 1024) {
            console.warn('File exceeds 50MB limit:', fileToUpload.name);
          } else {
            const fileResult = await StorageHelper.uploadFile(
              'deliverables',
              wsId,
              `deliverables/${data.id}`,
              fileToUpload
            );
            if (fileResult.error) {
              console.warn('Storage upload error during deliverable creation:', fileResult.error);
            } else {
              const fileName = delData.fileName || fileToUpload.name;
              const fileSize = delData.fileSize || formatFileSize(fileToUpload.size);
              const fileType = fileToUpload.type || 'application/octet-stream';

              await supabase.from('deliverable_files').insert({
                deliverable_id: data.id,
                file_name: fileName,
                file_size: fileSize,
                file_type: fileType,
                file_url: fileResult.path || '',
                is_pinned: false,
                uploaded_by: user?.id,
                uploaded_at: new Date().toISOString(),
              });

              // Update files count
              await supabase.from('deliverables').update({ files_count: 1, updated_at: new Date().toISOString() }).eq('id', data.id);
            }
          }
        } catch (fileErr) {
          console.warn('File upload exception during deliverable creation:', fileErr);
        }
      } else if (delData.fileUrl) {
        // Handle URL-based file reference
        const fileName = delData.fileName || 'Deliverable File';
        const fileSize = delData.fileSize || '';
        await supabase.from('deliverable_files').insert({
          deliverable_id: data.id,
          file_name: fileName,
          file_size: fileSize,
          file_type: 'link',
          file_url: delData.fileUrl,
          is_pinned: false,
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
        });
        await supabase.from('deliverables').update({ files_count: 1, updated_at: new Date().toISOString() }).eq('id', data.id);
      }

      // Create initial version record
      await supabase.from('deliverable_versions').insert({
        deliverable_id: data.id,
        version_number: data.current_version || 'v1.0',
        file_url: delData.fileUrl || '',
        file_name: delData.fileName || '',
        file_size: delData.fileSize || '',
        note: 'Initial version',
        uploaded_by: user?.email?.split('@')[0] || 'User',
      });

      return {
        id: data.id,
        projectId: data.project_id || '',
        clientId: data.client_id,
        clientName: data.client_name || '',
        title: data.title,
        description: data.description || '',
        status: data.status || 'draft',
        approvalStatus: data.approval_status || 'pending',
        priority: data.priority || 'medium',
        dueDate: data.due_date || '',
        reviewDeadline: data.review_deadline || undefined,
        version: data.current_version || 'v1.0',
        internalNotes: data.internal_notes || '',
        submissionMessage: data.submission_message || '',
      };
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create deliverable');
    }
  },
  updateDeliverable: async (id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.updateDeliverable(id, updates);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
      if (updates.version !== undefined) payload.current_version = updates.version;
      if (updates.internalNotes !== undefined) payload.internal_notes = updates.internalNotes;
      if (updates.revisionNote !== undefined) payload.rejection_reason = updates.revisionNote;
      if ((updates as any).revisionNotes !== undefined) payload.rejection_reason = (updates as any).revisionNotes;
      if (updates.approvalStatus !== undefined) payload.approval_status = updates.approvalStatus;
      const { error } = await supabase.from('deliverables').update(payload).eq('id', id).eq('workspace_id', wsId);
      if (error) { console.warn('Supabase deliverable update error:', error.message); return undefined; }
      const { data } = await supabase.from('deliverables').select('*').eq('id', id).single();
      if (!data) return undefined;
      return { id: data.id, projectId: data.project_id || '', clientId: data.client_id, clientName: data.client_name || '', title: data.title, description: data.description || '', status: data.status || 'draft', dueDate: data.due_date || '', version: data.current_version || 'v1.0', internalNotes: data.internal_notes || '' };
    } catch { return undefined; }
  },
  duplicateDeliverable: async (id: string): Promise<Deliverable | undefined> => {
    const original = await FreelancerDeliverableService.getDeliverableById(id);
    if (!original) return undefined;
    return FreelancerDeliverableService.addDeliverable({ ...original, title: `${original.title} (Copy)` });
  },
  archiveDeliverable: async (id: string): Promise<Deliverable | undefined> => {
    return FreelancerDeliverableService.updateDeliverable(id, { status: 'archived' as any });
  },
  deleteDeliverable: async (id: string): Promise<boolean> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.deleteDeliverableDraft(id);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return false;
    try {
      // Clean up storage files
      const { data: files } = await supabase.from('deliverable_files').select('file_url').eq('deliverable_id', id);
      if (files) {
        for (const f of files) {
          if (f.file_url) {
            try { await StorageHelper.deleteFile('deliverables', f.file_url); } catch { /* best effort */ }
          }
        }
      }

      const { data: deliverable } = await supabase.from('deliverables').select('title').eq('id', id).single();
      const { error } = await supabase.from('deliverables').delete().eq('id', id).eq('workspace_id', wsId);
      if (!error) {
        logActivitySafe('deleted_deliverable', deliverable?.title || id, 'deliverable');
      }
      return !error;
    } catch (err) {
      console.warn('Error deleting deliverable:', err);
      return false;
    }
  },
  uploadNewVersion: async (id: string, versionData: any): Promise<Deliverable | undefined> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Upload file to Supabase Storage if a File object is provided
      let fileUrl = versionData.fileUrl || '';
      let fileUrlPath = '';
      if (versionData.file && typeof StorageHelper !== 'undefined') {
        const result = await StorageHelper.uploadFile('deliverables', wsId, `deliverables/${id}/versions`, versionData.file);
        if (result.error) console.warn('Storage upload error:', result.error);
        if (!result.error && result.path) { fileUrlPath = result.path; }
      }

      await supabase.from('deliverable_versions').insert({ deliverable_id: id, version_number: versionData.version || 'v1.0', file_url: fileUrlPath || fileUrl, file_name: versionData.fileName || '', file_size: versionData.fileSize || '', note: versionData.note || '', uploaded_by: versionData.uploadedBy || user?.email?.split('@')[0] || 'User' });
      await supabase.from('deliverables').update({ current_version: versionData.version || 'v1.0', updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', wsId);
      logActivitySafe('uploaded_version', `Version ${versionData.version || 'v1.0'} for deliverable ${id}`, 'deliverable');

      // Notify client about new version
      try {
        const { data: delInfo } = await supabase.from('deliverables').select('title, client_id').eq('id', id).single();
        if (delInfo?.client_id) {
          NotificationHelper.versionUploaded(delInfo.title || 'Deliverable', versionData.version || 'v1.0', delInfo.client_id);
        }
      } catch { /* non-critical */ }

      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  replaceDeliverableVersion: async (id: string, versionData: any): Promise<Deliverable | undefined> => {
    return FreelancerDeliverableService.uploadNewVersion(id, versionData);
  },
  restoreDeliverableVersion: async (id: string, versionId: string): Promise<Deliverable | undefined> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { data: version } = await supabase.from('deliverable_versions').select('*').eq('id', versionId).eq('deliverable_id', id).single();
      if (!version) return undefined;
      await supabase.from('deliverables').update({ current_version: version.version_number, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', wsId);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  addDeliverableFile: async (id: string, fileData: any): Promise<Deliverable | undefined> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Upload file to Supabase Storage if a File object is provided
      let fileUrl = fileData.fileUrl || '';
      let fileUrlPath = '';
      if (fileData.file && typeof StorageHelper !== 'undefined') {
        const result = await StorageHelper.uploadFile('deliverables', wsId, `deliverables/${id}/files`, fileData.file);
        if (result.error) console.warn('Storage upload error:', result.error);
        if (!result.error && result.path) { fileUrlPath = result.path; }
      }

      await supabase.from('deliverable_files').insert({
        deliverable_id: id,
        file_name: fileData.fileName || 'Untitled',
        file_url: fileUrlPath || fileUrl,
        file_size: fileData.fileSize || '',
        file_type: fileData.fileType || '',
        is_pinned: fileData.isPinned || false,
        uploaded_by: user?.id || null,
        uploaded_at: new Date().toISOString(),
      });

      // Update files count
      const { count } = await supabase.from('deliverable_files').select('*', { count: 'exact', head: true }).eq('deliverable_id', id);
      await supabase.from('deliverables').update({ files_count: count || 0, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', wsId);

      logActivitySafe('uploaded_file', `File ${fileData.fileName || 'Untitled'} uploaded to deliverable ${id}`, 'deliverable');
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch (err) {
      console.warn('Error adding deliverable file:', err);
      return undefined;
    }
  },
  renameDeliverableFile: async (id: string, fileId: string, newName: string): Promise<Deliverable | undefined> => {
    try {
      await supabase.from('deliverable_files').update({ file_name: newName }).eq('id', fileId).eq('deliverable_id', id);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  deleteDeliverableFile: async (id: string, fileId: string): Promise<Deliverable | undefined> => {
    try {
      await supabase.from('deliverable_files').delete().eq('id', fileId).eq('deliverable_id', id);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  togglePinDeliverableFile: async (id: string, fileId: string): Promise<Deliverable | undefined> => {
    try {
      const { data: existing } = await supabase.from('deliverable_files').select('is_pinned').eq('id', fileId).single();
      await supabase.from('deliverable_files').update({ is_pinned: !existing?.is_pinned }).eq('id', fileId);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch (err) {
      console.warn('Error toggling file pin:', err);
      return undefined;
    }
  },
  addDeliverableComment: async (id: string, commentData: any): Promise<Deliverable | undefined> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const authorName = commentData.author || user?.email?.split('@')[0] || 'User';
      await supabase.from('deliverable_comments').insert({
        deliverable_id: id,
        author: authorName,
        author_id: user?.id || null,
        author_role: commentData.authorRole || 'freelancer',
        is_internal: commentData.isInternal ?? false,
        content: commentData.content,
        attachments: commentData.attachments || [],
        reply_to_id: commentData.replyToId || null,
        resolved: false,
      });

      // Update comments count
      const { count } = await supabase.from('deliverable_comments').select('*', { count: 'exact', head: true }).eq('deliverable_id', id);
      await supabase.from('deliverables').update({ comments_count: count || 0, updated_at: new Date().toISOString() }).eq('id', id);

      logActivitySafe('posted_deliverable_comment', `Comment on deliverable ${id}`, 'deliverable');
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch (err) {
      console.warn('Error adding deliverable comment:', err);
      return undefined;
    }
  },
  toggleResolveDeliverableComment: async (id: string, commentId: string): Promise<Deliverable | undefined> => {
    try {
      const { data: existing } = await supabase.from('deliverable_comments').select('resolved').eq('id', commentId).single();
      await supabase.from('deliverable_comments').update({ resolved: !existing?.resolved }).eq('id', commentId);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  submitDeliverableClientReview: async (id: string, reviewData?: any): Promise<Deliverable | undefined> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      // Validate status transition
      const { data: current } = await supabase.from('deliverables').select('status').eq('id', id).single();
      if (!current) return undefined;
      const validPreStatuses = ['draft', 'preparing', 'ready_for_review', 'revision_requested'];
      if (!validPreStatuses.includes(current.status)) {
        console.warn(`Cannot submit deliverable: current status '${current.status}' is not submittable`);
        return undefined;
      }

      const submissionMessage = reviewData?.submissionMessage || reviewData?.message || '';

      await supabase.from('deliverables').update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        approval_status: 'pending',
        submission_message: submissionMessage,
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('workspace_id', wsId);

      logActivitySafe('submitted_deliverable', `Deliverable ${id} submitted`, 'deliverable');

      // Auto-generate notification and email for the client
      try {
        const { data: delInfo } = await supabase.from('deliverables').select('title, client_id, current_version').eq('id', id).single();
        if (delInfo?.client_id) {
          NotificationHelper.deliverableSubmitted(delInfo.title || 'Deliverable', delInfo.client_id);

          const { data: client } = await supabase.from('clients').select('name, email, portal_token').eq('id', delInfo.client_id).single();
          if (client?.email) {
            const { EmailService } = await import('@/backend/email/email-service');
            const { getAppBaseUrl } = await import('@/shared/utils/url');
            const { data: ws } = await supabase.from('workspaces').select('name, owner_id').eq('id', wsId).single();
            let studioName = ws?.name || 'FlowDesk Studio';
            if (ws?.owner_id) {
              const { data: profile } = await supabase.from('profiles').select('business_name, full_name').eq('id', ws.owner_id).single();
              if (profile?.business_name) studioName = profile.business_name;
            }
            // Canonical portal route is /portal/{clientId}; tokens are resolved server-side.
            const portalUrl = `${getAppBaseUrl()}/portal/${delInfo.client_id}`;
            await EmailService.sendDeliverableReady(client.email, {
              clientName: client.name || 'Client',
              freelancerName: studioName,
              projectTitle: delInfo.title || 'Project',
              deliverableTitle: delInfo.title || 'Deliverable',
              portalUrl,
              version: delInfo.current_version || 'v1.0',
            }, { workspaceId: wsId, deliverableId: id });
          }
        }
      } catch (emailErr) {
        console.warn('[FreelancerDeliverableService] Email dispatch notice (submission):', emailErr);
      }

      return FreelancerDeliverableService.getDeliverableById(id);
    } catch (err) {
      console.warn('Error submitting deliverable:', err);
      return undefined;
    }
  },
  approveDeliverable: async (id: string, note?: string): Promise<Deliverable | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.approveDeliverable(id, note);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      // Security: Freelancer cannot approve their own deliverable
      // This method should only be called via ClientDeliverableService which verifies client identity
      console.warn('approveDeliverable called from freelancer service - this should only be called via ClientDeliverableService');

      // Verify current status allows approval
      const { data: current } = await supabase.from('deliverables').select('status').eq('id', id).single();
      if (!current || current.status !== 'submitted') {
        console.warn('Cannot approve deliverable: status is not submitted');
        return undefined;
      }

      await supabase.from('deliverables').update({
        status: 'approved',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('workspace_id', wsId);

      logActivitySafe('approved_deliverable', `Deliverable ${id}`, 'deliverable');
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch (err) {
      console.warn('Error approving deliverable:', err);
      return undefined;
    }
  },
  requestDeliverableRevision: async (id: string, revisionComment: string): Promise<Deliverable | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) return FlowDeskStore.requestDeliverableRevision(id, revisionComment);
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      await supabase.from('deliverables').update({
        status: 'revision_requested',
        approval_status: 'revision_requested',
        rejection_reason: revisionComment,
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('workspace_id', wsId);

      logActivitySafe('revision_requested', `Revision requested for deliverable ${id}`, 'deliverable');

      // Auto-generate notification for freelancer
      const { data: delInfo } = await supabase.from('deliverables').select('title').eq('id', id).single();
      NotificationHelper.revisionRequested(delInfo?.title || 'Deliverable');

      return FreelancerDeliverableService.getDeliverableById(id);
    } catch (err) {
      console.warn('Error requesting revision:', err);
      return undefined;
    }
  },
  archiveDeliverableVersion: async (id: string, versionNumber: string): Promise<Deliverable | undefined> => {
    try {
      await supabase.from('deliverable_versions').update({ archived: true }).eq('deliverable_id', id).eq('version_number', versionNumber);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  deleteDeliverableDraft: async (id: string): Promise<boolean> => {
    return FreelancerDeliverableService.deleteDeliverable(id);
  },
  updateDeliverableInternalNotes: async (id: string, notes: string): Promise<Deliverable | undefined> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      await supabase.from('deliverables').update({ internal_notes: notes, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', wsId);
      return FreelancerDeliverableService.getDeliverableById(id);
    } catch { return undefined; }
  },
  bulkUpdateDeliverables: async (ids: string[], action: { type: string; status?: string; archive?: boolean; restore?: boolean; delete?: boolean }): Promise<{ success: boolean; failedIds: string[] }> => {
    const failedIds: string[] = [];
    try {
      const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
      if (!wsId) return { success: false, failedIds: [...ids] };

      if (action.type === 'status' && action.status) {
        const { error } = await supabase.from('deliverables').update({ status: action.status, updated_at: new Date().toISOString() }).in('id', ids).eq('workspace_id', wsId);
        if (error) { failedIds.push(...ids); }
      } else if (action.type === 'archive') {
        const { error } = await supabase.from('deliverables').update({ status: 'archived', updated_at: new Date().toISOString() }).in('id', ids).eq('workspace_id', wsId);
        if (error) { failedIds.push(...ids); }
      } else if (action.type === 'restore') {
        const { error } = await supabase.from('deliverables').update({ status: 'draft', updated_at: new Date().toISOString() }).in('id', ids).eq('workspace_id', wsId);
        if (error) { failedIds.push(...ids); }
      } else if (action.type === 'delete') {
        // Clean up storage files before deleting
        for (const deliverableId of ids) {
          try {
            const { data: files } = await supabase.from('deliverable_files').select('file_url').eq('deliverable_id', deliverableId);
            if (files) {
              for (const f of files) {
                if (f.file_url) await StorageHelper.deleteFile('deliverables', f.file_url);
              }
            }
          } catch { /* best effort cleanup */ }
        }
        const { error } = await supabase.from('deliverables').delete().in('id', ids).eq('workspace_id', wsId);
        if (error) { failedIds.push(...ids); }
      } else {
        failedIds.push(...ids);
      }

      if (failedIds.length === 0) {
        logActivitySafe('bulk_update', `Bulk ${action.type} on ${ids.length} deliverable(s)`, 'deliverable');
      }

      return { success: failedIds.length === 0, failedIds };
    } catch (err) {
      console.warn('Bulk update error:', err);
      return { success: false, failedIds: [...ids] };
    }
  },
};

import {
  calculateInvoiceTotals,
  derivePaymentStatus,
  isInvoiceOverdue,
  validateInvoice,
  calculateRemainingBalance,
  generateNextInvoiceNumber,
} from '@/shared/utils/invoice-calculations';

export const FreelancerInvoiceService = {
  getInvoices: async (clientId?: string): Promise<Invoice[]> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.getInvoices(clientId);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      let query = supabase.from('invoices').select('*, invoice_items(*), invoice_payments(*), receipts(*)').eq('workspace_id', wsId);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('[FreelancerInvoiceService] Error fetching invoices:', error);
        return [];
      }
      if (!data) return [];

      const mapped = data.map((i) => {
        const paidAmt = Number(i.paid_amount) || 0;
        const totalAmt = Number(i.total_amount) || 0;
        const paymentStatus = derivePaymentStatus(totalAmt, paidAmt);
        const isOverdue = isInvoiceOverdue(i.due_date, paymentStatus, i.status || 'draft');

        const persistedReceipts = (i.receipts || []).map((r: any) => ({
          id: r.id,
          receiptNumber: r.receipt_number,
          invoiceId: r.invoice_id,
          invoiceNumber: i.invoice_number,
          amount: Number(r.amount) || 0,
          currency: r.currency || i.currency || 'USD',
          paymentDate: r.payment_date || r.created_at || new Date().toISOString(),
          paymentMethod: r.payment_method || 'razorpay',
          clientName: i.client_name,
          notes: r.notes,
          razorpayPaymentId: r.razorpay_payment_id,
          razorpayOrderId: r.razorpay_order_id,
          gateway: 'razorpay',
          gatewayStatus: 'completed',
        }));

        const receipts = persistedReceipts.length > 0
          ? persistedReceipts
          : (i.invoice_payments || []).map((p: any) => ({
              id: p.id,
              receiptNumber: `RCP-${i.invoice_number || 'INV'}-${(p.id || '').slice(0, 4)}`,
              invoiceId: p.invoice_id,
              invoiceNumber: i.invoice_number,
              amount: Number(p.amount) || 0,
              currency: p.currency || i.currency || 'USD',
              paymentDate: p.payment_date || p.created_at || new Date().toISOString(),
              paymentMethod: p.payment_method || 'bank_transfer',
              clientName: i.client_name,
              notes: p.notes,
              razorpayPaymentId: p.razorpay_payment_id,
              razorpayOrderId: p.razorpay_order_id,
              gateway: p.gateway || 'manual',
              gatewayStatus: p.gateway_status || 'completed',
            }));

        return {
          id: i.id,
          invoiceNumber: i.invoice_number,
          clientId: i.client_id,
          clientName: i.client_name || 'Client Workspace',
          clientEmail: i.client_email || 'client@example.com',
          projectId: i.project_id || undefined,
          projectName: i.project_name || undefined,
          issueDate: i.issue_date,
          dueDate: i.due_date,
          workflowStatus: (i.status as any) || 'draft',
          paymentStatus,
          status: isOverdue ? 'overdue' : (i.status || 'draft'),
          items: (i.invoice_items || []).map((item: any) => ({
            id: item.id,
            description: item.description,
            quantity: Number(item.quantity) || 1,
            rate: Number(item.unit_price) || 0,
            amount: Number(item.amount) || 0,
          })),
          subtotal: Number(i.subtotal) || 0,
          discount: Number(i.discount) || 0,
          taxName: i.tax_name || 'Tax',
          taxPercentage: Number(i.tax_percentage) || 0,
          tax: Number(i.tax_amount) || 0,
          total: totalAmt,
          paidAmount: paidAmt,
          remainingBalance: calculateRemainingBalance(totalAmt, paidAmt),
          currency: i.currency || 'USD',
          notes: i.notes || '',
          paymentInstructions: i.payment_instructions || '',
          internalNotes: i.internal_notes || '',
          receipts,
        } as Invoice;
      });

      return mapped;
    } catch (err) {
      console.error('[FreelancerInvoiceService] Unexpected error in getInvoices:', err);
      return [];
    }
  },
  getInvoiceById: async (id: string): Promise<Invoice | undefined> => {
    const invs = await FreelancerInvoiceService.getInvoices();
    return invs.find((i) => i.id === id || i.invoiceNumber === id);
  },
  createInvoice: async (
    invoice: Partial<Invoice> & { clientId: string; items: any[] }
  ): Promise<Invoice> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      const created = FlowDeskStore.createInvoice(invoice as any);
      logActivitySafe('created_invoice', created.invoiceNumber, 'invoice');
      NotificationHelper.invoiceCreated(created.invoiceNumber, invoice.clientId);
      return created;
    }

    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) {
      // Production: fail closed — never persist invoices to local/demo storage.
      throw new Error('No active workspace. Please complete onboarding before creating invoices.');
    }

    // Fetch existing invoice numbers in this workspace and settings for collision-free sequential generation
    const existing = await FreelancerInvoiceService.getInvoices();
    const existingNumbers = existing.map((e) => e.invoiceNumber);

    const { data: { user } } = await supabase.auth.getUser();
    const settings = await UserSettingsService.getUserSettings(user?.id);

    let finalInvoiceNumber = invoice.invoiceNumber?.trim();
    if (!finalInvoiceNumber || existingNumbers.includes(finalInvoiceNumber)) {
      finalInvoiceNumber = generateNextInvoiceNumber(settings, existingNumbers);
    }

    // Validate invoice data
    const validationErrors = validateInvoice({
      invoiceNumber: finalInvoiceNumber,
      clientId: invoice.clientId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      items: invoice.items,
      taxPercentage: invoice.taxPercentage,
      discount: invoice.discount,
      currency: invoice.currency,
    });
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' '));
    }

    // Use canonical calculation utility (preserving 0% tax)
    const calc = calculateInvoiceTotals({
      items: invoice.items || [],
      taxPercentage: invoice.taxPercentage ?? 0,
      discount: invoice.discount ?? 0,
    });

    try {
      const fullPayload = {
        workspace_id: wsId,
        client_id: invoice.clientId,
        user_id: user?.id || null,
        client_name: invoice.clientName || 'Client Workspace',
        client_email: invoice.clientEmail || 'client@example.com',
        project_id: invoice.projectId || null,
        project_name: invoice.projectName || null,
        invoice_number: finalInvoiceNumber,
        status: invoice.workflowStatus || invoice.status || 'draft',
        issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
        due_date: invoice.dueDate || new Date().toISOString().split('T')[0],
        subtotal: calc.subtotal,
        tax_percentage: calc.taxPercentage,
        tax_name: invoice.taxName || 'Tax',
        tax_amount: calc.taxAmount,
        total_amount: calc.total,
        discount: calc.discount,
        paid_amount: 0,
        currency: invoice.currency || 'USD',
        notes: invoice.notes || '',
        payment_instructions: invoice.paymentInstructions || '',
        internal_notes: invoice.internalNotes || '',
      };

      // Insert with concurrency-safe numbering: on a unique violation (23505) the
      // invoice number is regenerated and the insert retried. Fail closed otherwise.
      let inv: any = null;
      let lastInsertError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: insertedData, error: insertError } = await supabase
          .from('invoices')
          .insert(fullPayload)
          .select()
          .single();

        if (!insertError && insertedData) {
          inv = insertedData;
          break;
        }

        lastInsertError = insertError;
        const isDuplicateNumber =
          insertError?.code === '23505' ||
          (insertError?.message || '').includes('duplicate key');
        if (!isDuplicateNumber) break;

        // Regenerate a fresh invoice number and retry
        const retryNumbers = [...existingNumbers, finalInvoiceNumber];
        finalInvoiceNumber = generateNextInvoiceNumber(settings, retryNumbers);
        fullPayload.invoice_number = finalInvoiceNumber;
      }

      if (!inv) {
        console.error('[FreelancerInvoiceService] Invoice persistence failed:', lastInsertError);
        throw new Error('Invoice could not be saved. Please try again.');
      }

      if (inv) {
        logActivitySafe('created_invoice', inv.invoice_number, 'invoice');
        NotificationHelper.invoiceCreated(inv.invoice_number, invoice.clientId);

        // Insert line items
        if (invoice.items && invoice.items.length > 0) {
          try {
            const itemPayloads = invoice.items.map((it) => ({
              invoice_id: inv.id,
              description: it.description || 'Deliverable Item',
              quantity: it.quantity || 1,
              unit_price: it.rate || 0,
              amount: (it.quantity || 1) * (it.rate || 0),
            }));
            await supabase.from('invoice_items').insert(itemPayloads);
          } catch (itemErr) {
            console.warn('Could not insert invoice line items to Supabase:', itemErr);
          }
        }

        // Auto-register invoice document in Supabase documents
        try {
          await supabase.from('documents').insert({
            workspace_id: wsId,
            client_id: invoice.clientId,
            user_id: user?.id || null,
            title: `Invoice #${inv.invoice_number} — ${invoice.clientName || 'Client'}`,
            type: 'invoice',
            status: 'verified',
            is_required: false,
            due_date: invoice.dueDate || '',
            description: `Official billing document for ${invoice.clientName || 'Client'}.`,
            file_name: `Invoice_${inv.invoice_number}.pdf`,
            size: '245 KB',
          });
        } catch (docErr) {
          console.warn('Could not insert invoice document to Supabase documents:', docErr);
        }

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          clientId: inv.client_id,
          clientName: inv.client_name,
          clientEmail: inv.client_email,
          issueDate: inv.issue_date,
          dueDate: inv.due_date,
          workflowStatus: (inv.status as any) || 'draft',
          paymentStatus: 'pending',
          status: (inv.status === 'draft' ? 'draft' : 'pending'),
          items: invoice.items || [],
          subtotal: calc.subtotal,
          discount: calc.discount,
          taxName: invoice.taxName || 'Tax',
          taxPercentage: calc.taxPercentage,
          tax: calc.taxAmount,
          total: calc.total,
          paidAmount: 0,
          remainingBalance: calc.total,
          currency: inv.currency,
          notes: inv.notes,
          paymentInstructions: invoice.paymentInstructions || inv.payment_instructions || '',
          internalNotes: invoice.internalNotes || inv.internal_notes || '',
          receipts: [],
        };
      }

      throw new Error('Failed to create invoice');
    } catch (err) {
      // Production: fail closed. Never persist invoices to local/demo storage.
      console.error('[FreelancerInvoiceService] createInvoice exception:', err);
      throw err instanceof Error ? err : new Error('Invoice could not be saved. Please try again.');
    }
  },
  duplicateInvoice: async (id: string): Promise<Invoice | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      const inv = FlowDeskStore.getInvoiceById(id);
      if (!inv) return undefined;
      return FlowDeskStore.createInvoice({
        ...inv,
        id: undefined,
        invoiceNumber: undefined,
        workflowStatus: 'draft',
        paymentStatus: 'pending',
        status: 'draft',
        issueDate: new Date().toISOString().split('T')[0],
      } as any);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const original = await FreelancerInvoiceService.getInvoiceById(id);
      if (!original) return undefined;

      const { data: { user } } = await supabase.auth.getUser();
      const [existing, settings] = await Promise.all([
        FreelancerInvoiceService.getInvoices(),
        UserSettingsService.getUserSettings(user?.id),
      ]);

      const nextNum = generateNextInvoiceNumber(settings, existing.map((e: Invoice) => e.invoiceNumber));
      const today = new Date().toISOString().split('T')[0];
      const paymentTerms = settings.default_payment_terms || 14;
      const dueDateMs = new Date(today).getTime() + paymentTerms * 86400000;
      const dueDateStr = new Date(dueDateMs).toISOString().split('T')[0];

      return FreelancerInvoiceService.createInvoice({
        clientId: original.clientId,
        clientName: original.clientName,
        clientEmail: original.clientEmail,
        projectId: original.projectId,
        projectName: original.projectName,
        invoiceNumber: nextNum,
        issueDate: today,
        dueDate: dueDateStr,
        currency: original.currency,
        taxName: original.taxName,
        taxPercentage: original.taxPercentage,
        discount: original.discount,
        notes: original.notes,
        paymentInstructions: original.paymentInstructions,
        internalNotes: `Duplicated from #${original.invoiceNumber}`,
        workflowStatus: 'draft',
        status: 'draft',
        items: (original.items || []).map((it) => ({
          description: it.description,
          quantity: it.quantity,
          rate: it.rate,
          amount: (it.quantity || 1) * (it.rate || 0),
        })),
      });
    } catch (err) {
      console.error('FreelancerInvoiceService.duplicateInvoice error:', err);
      return undefined;
    }
  },
  updateInvoice: async (id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.updateInvoice(id, updates);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) {
      // Production: fail closed — never persist invoices to local/demo storage.
      throw new Error('No active workspace. Please complete onboarding before updating invoices.');
    }
    try {
      const existing = await FreelancerInvoiceService.getInvoiceById(id);
      if (!existing) throw new Error('Invoice not found.');

      const payload: any = { updated_at: new Date().toISOString() };

      // Map simple fields — invoice_number is strictly immutable and cannot be updated
      if (updates.workflowStatus !== undefined) payload.status = updates.workflowStatus;
      if (updates.status !== undefined && updates.workflowStatus === undefined) payload.status = updates.status;
      if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
      if (updates.issueDate !== undefined) payload.issue_date = updates.issueDate;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.clientId !== undefined) payload.client_id = updates.clientId;
      if (updates.clientName !== undefined) payload.client_name = updates.clientName;
      if (updates.clientEmail !== undefined) payload.client_email = updates.clientEmail;
      if (updates.projectId !== undefined) payload.project_id = updates.projectId;
      if (updates.projectName !== undefined) payload.project_name = updates.projectName;
      if (updates.currency !== undefined) payload.currency = updates.currency;
      if (updates.paymentInstructions !== undefined) payload.payment_instructions = updates.paymentInstructions;
      if (updates.internalNotes !== undefined) payload.internal_notes = updates.internalNotes;
      if (updates.taxName !== undefined) payload.tax_name = updates.taxName;

      // Recalculate financials if items or tax/discount changed
      if (updates.items || updates.taxPercentage !== undefined || updates.discount !== undefined) {
        const items = updates.items || existing.items || [];
        const taxPct = updates.taxPercentage !== undefined ? updates.taxPercentage : existing.taxPercentage;
        const disc = updates.discount !== undefined ? updates.discount : existing.discount;

        const calc = calculateInvoiceTotals({
          items: items.map(it => ({ quantity: it.quantity, rate: it.rate })),
          taxPercentage: taxPct,
          discount: disc,
        });

        payload.subtotal = calc.subtotal;
        payload.tax_percentage = calc.taxPercentage;
        payload.tax_amount = calc.taxAmount;
        payload.discount = calc.discount;
        payload.total_amount = calc.total;

        // Sync line items: delete old, insert new
        try {
          await supabase.from('invoice_items').delete().eq('invoice_id', id);
          if (items.length > 0) {
            const itemPayloads = items.map((it) => ({
              invoice_id: id,
              description: it.description || 'Item',
              quantity: it.quantity || 1,
              unit_price: it.rate || 0,
              amount: (it.quantity || 1) * (it.rate || 0),
            }));
            await supabase.from('invoice_items').insert(itemPayloads);
          }
        } catch (itemErr) {
          console.warn('Could not sync line items to Supabase:', itemErr);
        }
      }

      const { error } = await supabase.from('invoices').update(payload).eq('id', id).eq('workspace_id', wsId);
      if (error) {
        console.warn('Supabase invoice update error on full payload, trying base schema fallback:', error.message);
        delete payload.discount;
        delete payload.tax_name;
        delete payload.payment_instructions;
        delete payload.internal_notes;

        const { error: fallbackErr } = await supabase.from('invoices').update(payload).eq('id', id).eq('workspace_id', wsId);
        if (fallbackErr) {
          // Production: fail closed — never persist invoices to local/demo storage.
          console.error('FreelancerInvoiceService.updateInvoice failed:', fallbackErr.message);
          throw new Error('Invoice could not be updated. Please try again.');
        }
      }

      logActivitySafe('updated_invoice', payload.invoice_number || id, 'invoice');

      return FreelancerInvoiceService.getInvoiceById(id);
    } catch (err) {
      console.error('FreelancerInvoiceService.updateInvoice exception:', err);
      throw err instanceof Error ? err : new Error('Invoice could not be updated. Please try again.');
    }
  },
  deleteInvoice: async (id: string): Promise<boolean> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.deleteInvoice(id);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) {
      // Production: fail closed — never persist invoices to local/demo storage.
      console.error('FreelancerInvoiceService.deleteInvoice: no active workspace');
      return false;
    }
    try {
      await supabase.from('invoice_items').delete().eq('invoice_id', id);
      await supabase.from('invoice_payments').delete().eq('invoice_id', id);
      const { error } = await supabase.from('invoices').delete().eq('id', id).eq('workspace_id', wsId);
      if (error) {
        console.error('FreelancerInvoiceService.deleteInvoice failed:', error.message);
        return false;
      }
      logActivitySafe('deleted_invoice', id, 'invoice');
      return true;
    } catch (err) {
      console.error('FreelancerInvoiceService.deleteInvoice exception:', err);
      return false;
    }
  },
  markAsPaid: async (id: string): Promise<Invoice | undefined> => {
    return FreelancerInvoiceService.markInvoicePaidOffline(id, 'bank_transfer', 'Payment marked as paid in full');
  },

  /**
   * Records an offline invoice settlement (bank transfer, cash, etc.)
   */
  markInvoicePaidOffline: async (
    id: string,
    paymentMethodOrOptions: string | { amountSettled?: number; amount?: number; paymentMethod?: string; notes?: string } = 'bank_transfer',
    notesParam?: string,
    amountParam?: number
  ): Promise<Invoice | undefined> => {
    let paymentMethod = 'bank_transfer';
    let notes = notesParam;
    let amount = amountParam;

    if (typeof paymentMethodOrOptions === 'object' && paymentMethodOrOptions !== null) {
      paymentMethod = paymentMethodOrOptions.paymentMethod || 'bank_transfer';
      notes = paymentMethodOrOptions.notes || notes;
      amount = paymentMethodOrOptions.amountSettled ?? paymentMethodOrOptions.amount ?? amount;
    } else if (typeof paymentMethodOrOptions === 'string') {
      paymentMethod = paymentMethodOrOptions;
    }

    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.markInvoicePaidOffline(id, paymentMethod, notes, amount);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) {
      // Production: fail closed — never persist payments to local/demo storage.
      throw new Error('No active workspace. Please complete onboarding before recording payments.');
    }
    try {
      // Atomic, durable settlement via the record_manual_payment RPC:
      // locks the invoice row, validates balance/overpayment, inserts the
      // payment + receipt, updates invoice financial state, and creates
      // activity + notification — all in one transaction.
      // NULL p_amount settles the full remaining balance (RPC semantics); an
      // explicit positive amount records a partial settlement.
      const settleAmount = amount !== undefined && amount > 0 ? amount : null;
      const { data, error } = await supabase.rpc('record_manual_payment', {
        p_invoice_id: id,
        p_amount: settleAmount,
        p_payment_method: paymentMethod || 'bank_transfer',
        p_notes: notes || (settleAmount !== null ? 'Partial offline settlement recorded' : 'Payment marked as paid in full'),
      });

      if (error) {
        console.error('[FreelancerInvoiceService] record_manual_payment failed:', error.message);
        throw new Error(error.message.includes('rpc') ? 'Payment could not be recorded. Please try again.' : error.message);
      }
      if (!data || data.success === false) {
        const errMsg = data?.error || 'Payment could not be recorded. Please try again.';
        throw new Error(errMsg);
      }

      const settledAmount = Number(data.amountSettled) || 0;
      const inv = await FreelancerInvoiceService.getInvoiceById(id);

      // Dispatch Payment Received / Receipt email to client (non-blocking; never rolls back the settlement)
      try {
        if (inv?.clientEmail) {
          const { EmailService } = await import('@/backend/email/email-service');
          const { getAppBaseUrl } = await import('@/shared/utils/url');
          const { data: ws } = await supabase.from('workspaces').select('name, owner_id').eq('id', wsId).single();
          let studioName = ws?.name || 'FlowDesk Studio';
          if (ws?.owner_id) {
            const { data: profile } = await supabase.from('profiles').select('business_name, full_name').eq('id', ws.owner_id).single();
            if (profile?.business_name) studioName = profile.business_name;
          }
          await EmailService.sendPaymentReceived(inv.clientEmail, {
            recipientName: inv.clientName || 'Client',
            freelancerName: studioName,
            invoiceNumber: inv.invoiceNumber,
            amount: `${inv.currency || '$'} ${settledAmount.toLocaleString()}`,
            paymentDate: new Date().toLocaleDateString(),
            paymentMethod: paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentMethod,
            receiptUrl: `${getAppBaseUrl()}/portal/${inv.clientId}`,
          }, { workspaceId: wsId, paymentId: id });
        }
      } catch (emailErr) {
        console.warn('[FreelancerInvoiceService] Email dispatch notice (payment):', emailErr);
      }

      return inv;
    } catch (err) {
      console.error('[FreelancerInvoiceService] markInvoicePaidOffline exception:', err);
      throw err instanceof Error ? err : new Error('Payment could not be recorded. Please try again.');
    }
  },
  sendReminder: async (id: string, notes?: string): Promise<{ success: boolean; message: string; invoice?: Invoice }> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      const inv = FlowDeskStore.getInvoiceById(id);
      if (!inv) return { success: false, message: 'Invoice not found' };
      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'sent reminder for invoice',
        target: inv.invoiceNumber,
        category: 'invoice',
        metadata: notes || `Payment reminder sent to ${inv.clientName}`,
      });
      return { success: true, message: `Payment reminder recorded for ${inv.invoiceNumber}.`, invoice: inv };
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return { success: false, message: "No active workspace" };
    try {
      const inv = await FreelancerInvoiceService.getInvoiceById(id);
      if (!inv) return { success: false, message: 'Invoice not found' };
      await supabase.from('activities').insert({
        workspace_id: wsId,
        action: 'sent_reminder',
        title: inv.invoiceNumber,
        description: `Payment reminder recorded for ${inv.invoiceNumber}`,
        resource_type: 'invoice',
        resource_id: id,
      });

      // Dispatch Invoice Due / Reminder email
      try {
        if (inv.clientEmail) {
          const { EmailService } = await import('@/backend/email/email-service');
          const { getAppBaseUrl } = await import('@/shared/utils/url');
          const { data: ws } = await supabase.from('workspaces').select('name, owner_id').eq('id', wsId).single();
          let studioName = ws?.name || 'FlowDesk Studio';
          if (ws?.owner_id) {
            const { data: profile } = await supabase.from('profiles').select('business_name, full_name').eq('id', ws.owner_id).single();
            if (profile?.business_name) studioName = profile.business_name;
          }
          await EmailService.sendInvoiceIssued(inv.clientEmail, {
            clientName: inv.clientName || 'Client',
            freelancerName: studioName,
            invoiceNumber: inv.invoiceNumber,
            amount: `${inv.currency || '$'} ${inv.total.toLocaleString()}`,
            dueDate: inv.dueDate,
            invoiceUrl: `${getAppBaseUrl()}/portal/${inv.clientId}`,
          }, { workspaceId: wsId, invoiceId: id });
        }
      } catch (emailErr) {
        console.warn('[FreelancerInvoiceService] Email dispatch notice (reminder):', emailErr);
      }

      return { success: true, message: `Payment reminder recorded for ${inv.invoiceNumber}.`, invoice: inv };
    } catch { return { success: false, message: 'Failed to record reminder' }; }
  },
  recordInvoiceView: async (id: string): Promise<Invoice | undefined> => {
    if (DemoDataProvider.isDemo() || isDemoModeActive()) {
      return FlowDeskStore.getInvoiceById(id);
    }
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return undefined;
    try {
      const { data } = await supabase.from('invoices').select('status').eq('id', id).eq('workspace_id', wsId).single();
      if (data && data.status === 'sent') {
        await supabase.from('invoices').update({ status: 'viewed', updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', wsId);
      }
      logActivitySafe('viewed_invoice', id, 'invoice');
      return FreelancerInvoiceService.getInvoiceById(id);
    } catch (err) {
      console.error('FreelancerInvoiceService.recordInvoiceView exception:', err);
      return undefined;
    }
  },
  getFinancialMetrics: async (): Promise<FinancialDashboardMetrics> => {
    const defaultMetrics: FinancialDashboardMetrics = {
      lifetimeRevenue: 0,
      outstandingBalance: 0,
      paidThisMonth: 0,
      pendingPayments: 0,
      overdueAmount: 0,
      averageInvoiceValue: 0,
      paymentCollectionRate: 100,
      recentPayments: [],
      recentInvoices: [],
      upcomingDueDates: [],
      agingReport: [
        { range: '0-7 Days', amount: 0, count: 0, percentage: 0 },
        { range: '8-15 Days', amount: 0, count: 0, percentage: 0 },
        { range: '16-30 Days', amount: 0, count: 0, percentage: 0 },
        { range: '30+ Days', amount: 0, count: 0, percentage: 0 },
      ],
      paymentTrend: [
        { month: 'Jan', paid: 0, pending: 0 },
        { month: 'Feb', paid: 0, pending: 0 },
        { month: 'Mar', paid: 0, pending: 0 },
        { month: 'Apr', paid: 0, pending: 0 },
      ],
    };

    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return defaultMetrics;

    try {
      const allInvoices = await FreelancerInvoiceService.getInvoices();
      if (!allInvoices || allInvoices.length === 0) return defaultMetrics;

      const lifetimeRevenue = allInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
      const totalPaid = allInvoices.filter(i => i.paymentStatus === 'paid').reduce((acc, i) => acc + (Number(i.total) || 0), 0);
      const outstandingBalance = lifetimeRevenue - totalPaid;
      const overdueInvoices = allInvoices.filter(i => i.paymentStatus !== 'paid' && new Date(i.dueDate) < new Date());
      const overdueAmount = overdueInvoices.reduce((acc, i) => acc + (Number(i.total) || 0), 0);
      const now = new Date();
      const thisMonth = allInvoices.filter(i => {
        const d = new Date(i.issueDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const paidThisMonth = thisMonth.filter(i => i.paymentStatus === 'paid').reduce((acc, i) => acc + (Number(i.total) || 0), 0);
      const pendingPayments = outstandingBalance;

      return {
        lifetimeRevenue,
        outstandingBalance,
        paidThisMonth,
        pendingPayments,
        overdueAmount,
        averageInvoiceValue: allInvoices.length ? Math.round(lifetimeRevenue / allInvoices.length) : 0,
        paymentCollectionRate: lifetimeRevenue > 0 ? Math.round((totalPaid / lifetimeRevenue) * 100) : 100,
        recentPayments: [],
        recentInvoices: allInvoices.slice(0, 5),
        upcomingDueDates: allInvoices.filter(i => i.paymentStatus !== 'paid').slice(0, 5),
        agingReport: [
          { range: '0-7 Days', amount: Math.round(outstandingBalance * 0.7), count: Math.ceil(allInvoices.length * 0.7), percentage: 70 },
          { range: '8-15 Days', amount: Math.round(outstandingBalance * 0.2), count: Math.floor(allInvoices.length * 0.2), percentage: 20 },
          { range: '16-30 Days', amount: Math.round(outstandingBalance * 0.1), count: Math.floor(allInvoices.length * 0.1), percentage: 10 },
          { range: '30+ Days', amount: overdueAmount, count: overdueInvoices.length, percentage: 0 },
        ],
        paymentTrend: [
          { month: 'Jan', paid: Math.round(paidThisMonth * 0.8), pending: Math.round(pendingPayments * 0.3) },
          { month: 'Feb', paid: Math.round(paidThisMonth * 0.9), pending: Math.round(pendingPayments * 0.4) },
          { month: 'Mar', paid: Math.round(paidThisMonth * 0.95), pending: Math.round(pendingPayments * 0.2) },
          { month: 'Apr', paid: paidThisMonth, pending: pendingPayments },
        ],
      };
    } catch {
      return defaultMetrics;
    }
  },
};

export const FreelancerActivityService = {
  getActivities: async (): Promise<ActivityLog[]> => {
    if (DemoDataProvider.isDemo()) return DemoDataProvider.getActivities();
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((a) => ({
        id: a.id,
        timestamp: a.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        user: a.user_name || 'Member',
        action: a.action,
        target: a.title,
        category: (a.resource_type as any) || 'client',
      }));
    } catch {
      return [];
    }
  },
  logActivity: async (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    try {
      const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
      if (!wsId) return;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activities').insert({ workspace_id: wsId, action: log.action, title: log.target || '', description: log.action, user_name: log.user || user?.email?.split('@')[0] || 'User', resource_type: log.category || 'client' });
    } catch { /* non-critical */ }
  },
};

// Aliases for Freelancer workspace & feature components
export const WorkspaceService = FreelancerWorkspaceService;
export const DashboardService = FreelancerDashboardService;
export const ClientService = FreelancerClientManagementService;
export const ProjectService = FreelancerProjectService;
export const DeliverableService = FreelancerDeliverableService;
export const DocumentService = FreelancerDocumentService;
export const InvoiceService = FreelancerInvoiceService;
export const ActivityService = FreelancerActivityService;

export const CommentService = {
  getComments: async (clientId: string): Promise<WorkspaceComment[]> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      const { data, error } = await supabase
        .from('workspace_comments')
        .select('*')
        .eq('workspace_id', wsId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((c) => ({
        id: c.id,
        clientId: c.client_id,
        author: c.author,
        avatar: c.avatar || '',
        time: c.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        text: c.text,
        isOwner: Boolean(c.is_owner),
        replyToId: c.reply_to_id || undefined,
        replyToAuthor: c.reply_to_author || undefined,
        replyToText: c.reply_to_text || undefined,
        mentions: c.mentions || [],
        attachments: c.attachments || [],
        isPinned: Boolean(c.is_pinned),
      }));
    } catch {
      return [];
    }
  },

  addComment: async (
    clientId: string,
    commentData: {
      text: string;
      author?: string;
      avatar?: string;
      isOwner?: boolean;
      replyToId?: string;
      replyToAuthor?: string;
      replyToText?: string;
      mentions?: string[];
      attachments?: string[];
      isPinned?: boolean;
    }
  ): Promise<WorkspaceComment> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) throw new Error("No active workspace");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        workspace_id: wsId,
        client_id: clientId,
        user_id: user?.id || null,
        text: commentData.text,
        author: commentData.author || 'Member',
        avatar: commentData.avatar || '',
        is_owner: commentData.isOwner ?? true,
        reply_to_id: commentData.replyToId || null,
        reply_to_author: commentData.replyToAuthor || null,
        reply_to_text: commentData.replyToText || null,
        mentions: commentData.mentions || [],
        attachments: commentData.attachments || [],
        is_pinned: commentData.isPinned ?? false,
      };

      const { data, error } = await supabase.from('workspace_comments').insert(payload).select().single();
      if (error || !data) throw new Error("Failed to add comment");

      return {
        id: data.id,
        clientId: data.client_id,
        author: data.author,
        avatar: data.avatar,
        time: data.created_at.split('T')[0],
        text: data.text,
        isOwner: data.is_owner,
      };
    } catch {
      throw new Error("Failed to add comment");
    }
  },

  editComment: async (commentId: string, text: string): Promise<WorkspaceComment | undefined> => {
    try {
      const { error } = await supabase.from('workspace_comments').update({ text, updated_at: new Date().toISOString() }).eq('id', commentId);
      if (error) return undefined;
      const { data } = await supabase.from('workspace_comments').select('*').eq('id', commentId).single();
      if (!data) return undefined;
      return { id: data.id, clientId: data.client_id, author: data.author, avatar: data.avatar || '', time: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0], text: data.text, isOwner: Boolean(data.is_owner) };
    } catch { return undefined; }
  },
  deleteComment: async (commentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('workspace_comments').delete().eq('id', commentId);
      return !error;
    } catch { return false; }
  },
  togglePinComment: async (commentId: string): Promise<WorkspaceComment | undefined> => {
    try {
      const { data: existing } = await supabase.from('workspace_comments').select('is_pinned').eq('id', commentId).single();
      if (!existing) return undefined;
      await supabase.from('workspace_comments').update({ is_pinned: !existing.is_pinned }).eq('id', commentId);
      const { data } = await supabase.from('workspace_comments').select('*').eq('id', commentId).single();
      if (!data) return undefined;
      return { id: data.id, clientId: data.client_id, author: data.author, avatar: data.avatar || '', time: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0], text: data.text, isOwner: Boolean(data.is_owner), isPinned: Boolean(data.is_pinned) };
    } catch { return undefined; }
  },
  markCommentsAsRead: async (clientId: string): Promise<void> => {
    try {
      const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
      if (wsId) { await supabase.from('workspace_comments').update({ read_by_client: true }).eq('client_id', clientId).eq('workspace_id', wsId); }
    } catch { /* error propagated */ }
  },
};

export const NotificationService = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    if (DemoDataProvider.isDemo()) return DemoDataProvider.getNotifications();
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) return [];

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        timestamp: n.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        read: Boolean(n.read),
        type: n.category as any,
        link: n.link || undefined,
      }));
    } catch {
      return [];
    }
  },

  addNotification: async (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): Promise<NotificationItem> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId) throw new Error("No active workspace");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        workspace_id: wsId,
        user_id: user?.id || null,
        title: notif.title,
        message: notif.message,
        category: notif.type || 'info',
        link: notif.link || null,
        read: false,
      };

      const { data, error } = await supabase.from('notifications').insert(payload).select().single();
      if (error || !data) throw new Error("Failed to add notification");

      return {
        id: data.id,
        title: data.title,
        message: data.message,
        timestamp: data.created_at.split('T')[0],
        read: data.read,
        type: data.category,
        link: data.link,
      };
    } catch {
      throw new Error("Failed to add notification");
    }
  },

  markAllAsRead: async (): Promise<void> => {
    const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (wsId) {
      try {
        await supabase.from('notifications').update({ read: true }).eq('workspace_id', wsId);
      } catch {
        // ignore
      }
    }
    // markAllAsRead handled by NotificationService
  },

  dismissNotification: async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      return !error;
    } catch { return false; }
  },
};

export const FreelancerNotificationService = NotificationService;

export const WorkspaceProgressService = {
  getWorkspaceProgressBreakdown: async (clientId: string): Promise<WorkspaceProgressBreakdown> => {
    return { documentsProgress: 0, milestonesProgress: 0, deliverablesProgress: 0, approvalsProgress: 0, totalPercentage: 0, overallPercentage: 0, documentsPercentage: 0, milestonesPercentage: 0, deliverablesPercentage: 0, approvalsPercentage: 0, stage: "Planning" as const };
  },
  calculateProgressBreakdown: (summary: WorkspaceSummary): WorkspaceProgressBreakdown => {
    const docs = summary.documents;
    const verifiedDocs = docs.filter((d) => d.status === 'verified' || d.status === 'signed').length;
    const documentsPct = docs.length ? Math.round((verifiedDocs / docs.length) * 100) : 100;
    const documentsProgress = Math.round((documentsPct / 100) * 20);

    const delivs = summary.deliverables;
    const approvedDelivs = delivs.filter((d) => d.status === 'approved').length;
    const deliverablesPct = delivs.length ? Math.round((approvedDelivs / delivs.length) * 100) : 100;
    const deliverablesProgress = Math.round((deliverablesPct / 100) * 30);

    const projs = summary.projects;
    const milestonesPct = projs.length
      ? Math.round(projs.reduce((acc, p) => acc + (p.completionPercentage || 0), 0) / projs.length)
      : 100;
    const milestonesProgress = Math.round((milestonesPct / 100) * 30);

    const approvalsPct = delivs.length ? Math.round((approvedDelivs / delivs.length) * 100) : 100;
    const approvalsProgress = Math.round((approvalsPct / 100) * 20);

    const totalPercentage = documentsProgress + milestonesProgress + deliverablesProgress + approvalsProgress;

    let stage: WorkspaceProgressBreakdown['stage'] = 'Planning';
    if (totalPercentage === 100) stage = 'Completed';
    else if (totalPercentage > 75) stage = 'Review';
    else if (totalPercentage > 20) stage = 'In Progress';

    return {
      documentsProgress,
      milestonesProgress,
      deliverablesProgress,
      approvalsProgress,
      totalPercentage,
      overallPercentage: totalPercentage,
      documentsPercentage: documentsPct,
      milestonesPercentage: milestonesPct,
      deliverablesPercentage: deliverablesPct,
      approvalsPercentage: approvalsPct,
      stage,
    };
  },
};

export const WorkspaceHealthService = {
  getWorkspaceHealthDetails: async (clientId: string): Promise<WorkspaceHealthDetails> => {
    return { score: 0, status: "Healthy" as const, reasons: [] };
  },
  evaluateWorkspaceHealth: (summary: WorkspaceSummary): WorkspaceHealthDetails => {
    let score = 100;
    const reasons: string[] = [];
    const pendingInvoices = summary.invoices.filter((i) => i.status === 'pending' || i.status === 'overdue');

    if (pendingInvoices.length > 0) {
      score -= pendingInvoices.length * 15;
      reasons.push(`${pendingInvoices.length} outstanding invoice(s) pending payment.`);
    }

    const missingDocs = summary.documents.filter(
      (d) => d.status === 'missing' || d.status === 'pending' || d.status === 'rejected'
    );
    if (missingDocs.length > 0) {
      score -= missingDocs.length * 10;
      reasons.push(`${missingDocs.length} requested document(s) pending client upload/verification.`);
    }

    const delivsNeedingReview = summary.deliverables.filter(
      (d) => d.status === 'ready_for_review' || d.status === 'submitted'
    );
    if (delivsNeedingReview.length > 0) {
      reasons.push(`${delivsNeedingReview.length} deliverable(s) waiting on client review.`);
    }

    score = Math.max(0, Math.min(100, score));

    let status: WorkspaceHealthDetails['status'] = 'Healthy';
    if (score < 50) status = 'Blocked';
    else if (pendingInvoices.length > 0) status = 'Waiting on Client';

    return { score, status, reasons };
  },
};

import { ProfileService } from '@/backend/auth/profile-service';
import { mockUserProfile } from '@/backend/store/mockData';

export const SettingsService = {
  getUserProfile: async (userId?: string): Promise<UserProfile> => {
    if (isDemoModeActive()) {
      const local = FlowDeskStore.getUserProfile();
      return local || mockUserProfile;
    }

    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }

      if (targetUserId) {
        const profile = await ProfileService.getProfile(targetUserId);
        if (profile && (profile.name || profile.email)) {
          FlowDeskStore.updateUserProfile(profile);
          return profile;
        }
      }

      // Production: no mock/local identity fallback — fail closed.
      throw new Error('Profile not found for the authenticated user.');
    } catch (err) {
      console.error('SettingsService.getUserProfile error:', err);
      throw err instanceof Error ? err : new Error('Could not load profile.');
    }
  },
  updateUserProfile: async (updates: Partial<UserProfile>, userId?: string): Promise<UserProfile> => {
    // 1. Immediately update local store cache so UI updates instantly
    const updatedLocal = FlowDeskStore.updateUserProfile(updates);

    if (isDemoModeActive()) {
      return updatedLocal;
    }

    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }

      if (!targetUserId) {
        // Production: fail closed — never claim a profile save succeeded without an identity.
        throw new Error('No authenticated user. Profile could not be saved.');
      }

      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) payload.full_name = updates.name;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.profession !== undefined) payload.profession = updates.profession;
      if (updates.companyName !== undefined) payload.business_name = updates.companyName;
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.hourlyRate !== undefined) payload.hourly_rate = updates.hourlyRate;
      if (updates.currency !== undefined) payload.currency = updates.currency;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.country !== undefined) payload.country = updates.country;
      if (updates.timezone !== undefined) payload.timezone = updates.timezone;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
      if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
      if (updates.signatureUrl !== undefined) payload.signature_url = updates.signatureUrl;

      const { error } = await supabase.from('profiles').upsert({ id: targetUserId, ...payload }, { onConflict: 'id' });
      if (error) {
        // Production: fail closed — never return local cache as success on DB failure.
        console.error('SettingsService.updateUserProfile failed:', error.message);
        throw new Error('Profile could not be saved. Please try again.');
      }
      const profile = await ProfileService.getProfile(targetUserId);
      if (profile) {
        FlowDeskStore.updateUserProfile(profile);
        return profile;
      }
      return updatedLocal;
    } catch (err) {
      console.error('SettingsService.updateUserProfile exception:', err);
      throw err instanceof Error ? err : new Error('Profile could not be saved. Please try again.');
    }
  },
};

