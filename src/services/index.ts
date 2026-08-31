import { supabase } from '../lib/supabase';
import { StorageHelper } from '../lib/storage-helper';
import { getCurrentWorkspace, getWorkspaceId } from '../lib/workspace';
import { ClientRepository } from '../lib/services/clients/client-service';
import { ProjectRepository } from '../lib/services/projects/project-service';
import { InvoiceRepository } from '../lib/services/invoices/invoice-service';
import { DocumentRepository } from '../lib/services/documents/document-service';
import { DeliverableRepository } from '../lib/services/deliverables/deliverable-service';
import { WorkspaceService as WorkspaceHelperService } from './workspace-service';
import { FlowDeskStore } from './storage-store';
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
  ClientPortalDashboardData,
  WorkspaceProgressBreakdown,
  WorkspaceHealthDetails,
  FinancialDashboardMetrics,
} from '../types';

export const WorkspaceService = {
  getActiveWorkspaceId: async (): Promise<string | null> => {
    return WorkspaceHelperService.getActiveWorkspaceId();
  },
  getWorkspaceSummary: async (clientId: string): Promise<WorkspaceSummary | null> => {
    return FlowDeskStore.getWorkspaceSummary(clientId);
  },
  addComment: async (clientId: string, text: string, author?: string, avatar?: string): Promise<WorkspaceComment> => {
    return FlowDeskStore.addComment(clientId, { text, author, avatar });
  },
  deleteComment: async (commentId: string): Promise<boolean> => {
    return FlowDeskStore.deleteComment(commentId);
  },
  requestDocument: async (clientId: string, title: string, type: DocumentItem['type']): Promise<DocumentItem> => {
    return FlowDeskStore.requestDocument(clientId, { title, type });
  },
  uploadDocumentPlaceholder: async (clientId: string, title: string, type: DocumentItem['type'], size?: string): Promise<DocumentItem> => {
    return FlowDeskStore.uploadDocumentFile(clientId, { fileName: title, size }) || {
      id: `doc-${Date.now()}`,
      clientId,
      title,
      type,
      status: 'uploaded',
      updatedAt: new Date().toISOString().split('T')[0],
      size: size || '1.2 MB',
      downloadUrl: '#',
    };
  },
  updateDocumentStatus: async (id: string, status: DocumentItem['status']): Promise<DocumentItem | undefined> => {
    if (status === 'verified') return FlowDeskStore.verifyDocument(id);
    if (status === 'rejected') return FlowDeskStore.rejectDocument(id, 'Document does not meet requirements');
    return FlowDeskStore.getDocuments().find((d) => d.id === id);
  },
  addDeliverable: async (del: Omit<Deliverable, 'id'>): Promise<Deliverable> => {
    return FlowDeskStore.addDeliverable(del);
  },
  updateDeliverableStatus: async (id: string, status: Deliverable['status'], note?: string): Promise<Deliverable | undefined> => {
    if (status === 'approved') return FlowDeskStore.approveDeliverable(id, note);
    if (status === 'revision_requested') return FlowDeskStore.requestDeliverableRevision(id, note || 'Revision requested');
    return FlowDeskStore.getDeliverables().find((d) => d.id === id);
  },
  togglePortalAccess: async (clientId: string, enabled: boolean): Promise<ClientPortalConfig> => {
    return FlowDeskStore.togglePortalAccess(clientId, enabled);
  },
  regeneratePortalLink: async (clientId: string): Promise<ClientPortalConfig> => {
    return FlowDeskStore.regeneratePortalLink(clientId);
  },
};

export const DashboardService = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getDashboardMetrics();

    try {
      const { data: clients } = await supabase.from('clients').select('id, total_billed').eq('workspace_id', wsId);
      const { data: projects } = await supabase.from('projects').select('id, status').eq('workspace_id', wsId);
      const { data: deliverables } = await supabase.from('deliverables').select('id, status').eq('workspace_id', wsId);
      const { data: invoices } = await supabase.from('invoices').select('id, status, total_amount, paid_amount').eq('workspace_id', wsId);

      const activeClients = clients?.length || 0;
      const activeProjs = projects?.filter((p) => p.status === 'in_progress').length || 0;
      const completedProjs = projects?.filter((p) => p.status === 'completed').length || 0;
      const upcomingDelivs = deliverables?.filter((d) => d.status !== 'approved' && d.status !== 'completed').length || 0;

      const totalRev = clients?.reduce((acc, c) => acc + (Number(c.total_billed) || 0), 0) || 0;
      const pendingInvAmount = invoices
        ?.filter((i) => i.status === 'pending' || i.status === 'sent' || i.status === 'draft')
        .reduce((acc, i) => acc + (Number(i.total_amount) - Number(i.paid_amount) || 0), 0) || 0;

      return {
        totalRevenue: totalRev,
        monthlyRevenue: Math.round(totalRev / 12) || 4200,
        activeClientsCount: activeClients,
        pendingInvoicesAmount: pendingInvAmount,
        completedProjectsCount: completedProjs,
        upcomingDeliverablesCount: upcomingDelivs,
        activeProjectsCount: activeProjs,
        revenueHistory: [
          { month: 'Jan', amount: Math.round(totalRev * 0.1) || 1200 },
          { month: 'Feb', amount: Math.round(totalRev * 0.15) || 2400 },
          { month: 'Mar', amount: Math.round(totalRev * 0.25) || 3800 },
          { month: 'Apr', amount: Math.round(totalRev * 0.5) || 6200 },
        ],
      };
    } catch {
      return FlowDeskStore.getDashboardMetrics();
    }
  },
};

export const ClientService = {
  getClients: async (): Promise<Client[]> => {
    return ClientRepository.getClients();
  },

  getClientById: async (id: string): Promise<Client | undefined> => {
    return ClientRepository.getClientById(id);
  },

  createClient: async (clientData: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>): Promise<Client> => {
    return ClientRepository.createClient(clientData);
  },

  updateClient: async (id: string, updates: Partial<Client>): Promise<Client | undefined> => {
    return ClientRepository.updateClient(id, updates);
  },

  archiveClient: async (id: string): Promise<Client | undefined> => {
    return ClientRepository.updateClient(id, { status: 'archived' });
  },

  restoreClient: async (id: string): Promise<Client | undefined> => {
    return ClientRepository.updateClient(id, { status: 'active' });
  },

  deleteClient: async (id: string): Promise<boolean> => {
    return ClientRepository.deleteClient(id);
  },
};

export const ProjectService = {
  getProjects: async (): Promise<Project[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getProjects();

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false });

      if (error || !data) return FlowDeskStore.getProjects();

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
      return FlowDeskStore.getProjects();
    }
  },

  getProjectsByClientId: async (clientId: string): Promise<Project[]> => {
    const projs = await ProjectService.getProjects();
    return projs.filter((p) => p.clientId === clientId);
  },

  getProjectById: async (id: string): Promise<Project | undefined> => {
    const projs = await ProjectService.getProjects();
    return projs.find((p) => p.id === id);
  },

  createProject: async (project: Omit<Project, 'id' | 'completionPercentage' | 'spent'>): Promise<Project> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.createProject(project);

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
      if (error || !data) return FlowDeskStore.createProject(project);

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
    } catch {
      return FlowDeskStore.createProject(project);
    }
  },

  updateProject: async (id: string, updates: Partial<Project>): Promise<Project | undefined> => {
    return FlowDeskStore.updateProject(id, updates);
  },

  toggleMilestone: async (projectId: string, milestoneId: string): Promise<Project | undefined> => {
    return FlowDeskStore.toggleMilestone(projectId, milestoneId);
  },

  addMilestone: async (projectId: string, title: string, dueDate: string): Promise<Project | undefined> => {
    return FlowDeskStore.addMilestone(projectId, title, dueDate);
  },

  markProjectComplete: async (id: string): Promise<Project | undefined> => {
    return FlowDeskStore.markProjectComplete(id);
  },
};

export const DocumentService = {
  getDocuments: async (clientId?: string): Promise<DocumentItem[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getDocuments(clientId);

    try {
      let query = supabase.from('documents').select('*').eq('workspace_id', wsId);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) return FlowDeskStore.getDocuments(clientId);

      return data.map((d) => ({
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
        downloadUrl: StorageHelper.getPublicUrl('documents', d.file_url || ''),
      }));
    } catch {
      return FlowDeskStore.getDocuments(clientId);
    }
  },

  requestDocument: async (
    clientId: string,
    data: { title: string; type: DocumentItem['type']; isRequired?: boolean; dueDate?: string; description?: string }
  ): Promise<DocumentItem> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.requestDocument(clientId, data);

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
      if (error || !res) return FlowDeskStore.requestDocument(clientId, data);

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
    } catch {
      return FlowDeskStore.requestDocument(clientId, data);
    }
  },

  reorderDocuments: async (clientId: string, docIds: string[]): Promise<DocumentItem[]> => {
    return FlowDeskStore.reorderDocuments(clientId, docIds);
  },

  uploadDocumentFile: async (
    docId: string,
    fileData: { fileName?: string; size?: string; downloadUrl?: string }
  ): Promise<DocumentItem | undefined> => {
    return FlowDeskStore.uploadDocumentFile(docId, fileData);
  },

  verifyDocument: async (docId: string, notes?: string): Promise<DocumentItem | undefined> => {
    return FlowDeskStore.verifyDocument(docId, notes);
  },

  rejectDocument: async (docId: string, reason: string): Promise<DocumentItem | undefined> => {
    return FlowDeskStore.rejectDocument(docId, reason);
  },

  requestReupload: async (docId: string, reason: string): Promise<DocumentItem | undefined> => {
    return FlowDeskStore.requestReupload(docId, reason);
  },

  deleteDocument: async (docId: string): Promise<boolean> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (wsId) {
      try {
        await supabase.from('documents').delete().eq('id', docId).eq('workspace_id', wsId);
      } catch {
        // ignore
      }
    }
    return FlowDeskStore.deleteDocument(docId);
  },
};

export const DeliverableService = {
  getDeliverables: async (clientId?: string, includeArchived?: boolean): Promise<Deliverable[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getDeliverables(clientId, includeArchived);

    try {
      let query = supabase.from('deliverables').select('*').eq('workspace_id', wsId);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) return FlowDeskStore.getDeliverables(clientId, includeArchived);

      return data.map((d) => ({
        id: d.id,
        projectId: d.project_id || 'proj-1',
        clientId: d.client_id,
        clientName: d.client_name || 'Client Workspace',
        title: d.title,
        description: d.description || '',
        status: d.status || 'draft',
        dueDate: d.due_date || new Date().toISOString().split('T')[0],
        version: d.current_version || 'v1.0',
        internalNotes: d.internal_notes || '',
      }));
    } catch {
      return FlowDeskStore.getDeliverables(clientId, includeArchived);
    }
  },

  getDeliverableById: async (id: string): Promise<Deliverable | undefined> => {
    const delivs = await DeliverableService.getDeliverables();
    return delivs.find((d) => d.id === id);
  },

  addDeliverable: async (delData: Omit<Deliverable, 'id'>): Promise<Deliverable> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.addDeliverable(delData);

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
        due_date: delData.dueDate,
        current_version: delData.version || 'v1.0',
        internal_notes: delData.internalNotes || '',
      };

      const { data, error } = await supabase.from('deliverables').insert(payload).select().single();
      if (error || !data) return FlowDeskStore.addDeliverable(delData);

      return {
        id: data.id,
        projectId: data.project_id,
        clientId: data.client_id,
        clientName: data.client_name,
        title: data.title,
        description: data.description,
        status: data.status,
        dueDate: data.due_date,
        version: data.current_version,
      };
    } catch {
      return FlowDeskStore.addDeliverable(delData);
    }
  },

  updateDeliverable: async (id: string, updates: Partial<Deliverable>): Promise<Deliverable | undefined> => {
    return FlowDeskStore.updateDeliverable(id, updates);
  },
  duplicateDeliverable: async (id: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.duplicateDeliverable(id);
  },
  archiveDeliverable: async (id: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.archiveDeliverable(id);
  },
  deleteDeliverable: async (id: string): Promise<boolean> => {
    return FlowDeskStore.deleteDeliverable(id);
  },
  uploadNewVersion: async (id: string, versionData: any): Promise<Deliverable | undefined> => {
    return FlowDeskStore.replaceDeliverableVersion(id, versionData);
  },
  replaceDeliverableVersion: async (id: string, versionData: any): Promise<Deliverable | undefined> => {
    return FlowDeskStore.replaceDeliverableVersion(id, versionData);
  },
  restoreDeliverableVersion: async (id: string, versionId: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.restoreDeliverableVersion(id, versionId);
  },
  addDeliverableFile: async (id: string, fileData: any): Promise<Deliverable | undefined> => {
    return FlowDeskStore.addDeliverableFile(id, fileData);
  },
  renameDeliverableFile: async (id: string, fileId: string, newName: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.renameDeliverableFile(id, fileId, newName);
  },
  deleteDeliverableFile: async (id: string, fileId: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.deleteDeliverableFile(id, fileId);
  },
  togglePinDeliverableFile: async (id: string, fileId: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.togglePinDeliverableFile(id, fileId);
  },
  addDeliverableComment: async (id: string, commentData: any): Promise<Deliverable | undefined> => {
    return FlowDeskStore.addDeliverableComment(id, commentData);
  },
  toggleResolveDeliverableComment: async (id: string, commentId: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.toggleResolveDeliverableComment(id, commentId);
  },
  submitDeliverableClientReview: async (id: string, reviewData: any): Promise<Deliverable | undefined> => {
    return FlowDeskStore.submitDeliverableClientReview(id, reviewData);
  },
  approveDeliverable: async (id: string, note?: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.approveDeliverable(id, note);
  },
  requestDeliverableRevision: async (id: string, revisionComment: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.requestDeliverableRevision(id, revisionComment);
  },
  archiveDeliverableVersion: async (id: string, versionNumber: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.archiveDeliverableVersion(id, versionNumber);
  },
  deleteDeliverableDraft: async (id: string): Promise<boolean> => {
    return FlowDeskStore.deleteDeliverableDraft(id);
  },
  updateDeliverableInternalNotes: async (id: string, notes: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.updateDeliverableInternalNotes(id, notes);
  },
  bulkUpdateDeliverables: async (ids: string[], action: any): Promise<boolean> => {
    return FlowDeskStore.bulkUpdateDeliverables(ids, action);
  },
};

export const CommentService = {
  getComments: async (clientId: string): Promise<WorkspaceComment[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getComments(clientId);

    try {
      const { data, error } = await supabase
        .from('workspace_comments')
        .select('*')
        .eq('workspace_id', wsId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error || !data) return FlowDeskStore.getComments(clientId);

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
      return FlowDeskStore.getComments(clientId);
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
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.addComment(clientId, commentData);

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
      if (error || !data) return FlowDeskStore.addComment(clientId, commentData);

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
      return FlowDeskStore.addComment(clientId, commentData);
    }
  },

  editComment: async (commentId: string, text: string): Promise<WorkspaceComment | undefined> => {
    return FlowDeskStore.editComment(commentId, text);
  },
  deleteComment: async (commentId: string): Promise<boolean> => {
    return FlowDeskStore.deleteComment(commentId);
  },
  togglePinComment: async (commentId: string): Promise<WorkspaceComment | undefined> => {
    return FlowDeskStore.togglePinComment(commentId);
  },
  markCommentsAsRead: async (clientId: string): Promise<void> => {
    FlowDeskStore.markCommentsAsRead(clientId);
  },
};

export const NotificationService = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getNotifications();

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false });

      if (error || !data) return FlowDeskStore.getNotifications();

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
      return FlowDeskStore.getNotifications();
    }
  },

  addNotification: async (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): Promise<NotificationItem> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.addNotification(notif);

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
      if (error || !data) return FlowDeskStore.addNotification(notif);

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
      return FlowDeskStore.addNotification(notif);
    }
  },

  markAllAsRead: async (): Promise<void> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (wsId) {
      try {
        await supabase.from('notifications').update({ read: true }).eq('workspace_id', wsId);
      } catch {
        // ignore
      }
    }
    FlowDeskStore.markAllNotificationsRead();
  },

  dismissNotification: async (id: string): Promise<boolean> => {
    return FlowDeskStore.dismissNotification(id);
  },
};

export const PortalService = {
  getPortalConfig: async (clientId: string): Promise<ClientPortalConfig> => {
    return FlowDeskStore.getPortalConfig(clientId);
  },
  togglePortalAccess: async (clientId: string, enabled: boolean): Promise<ClientPortalConfig> => {
    return FlowDeskStore.togglePortalAccess(clientId, enabled);
  },
  regeneratePortalLink: async (clientId: string): Promise<ClientPortalConfig> => {
    return FlowDeskStore.regeneratePortalLink(clientId);
  },
  getClientPortalDashboardData: async (clientId: string): Promise<ClientPortalDashboardData | null> => {
    return FlowDeskStore.getClientPortalDashboardData(clientId);
  },
};

export const InvitationService = {
  inviteClient: async (clientId: string, email: string): Promise<ClientPortalConfig> => {
    return FlowDeskStore.inviteClient(clientId, email);
  },
  acceptInvitation: async (clientId: string): Promise<ClientPortalConfig> => {
    return FlowDeskStore.acceptInvitation(clientId);
  },
};

export const WorkspaceProgressService = {
  getWorkspaceProgressBreakdown: async (clientId: string): Promise<WorkspaceProgressBreakdown> => {
    return FlowDeskStore.getWorkspaceProgressBreakdown(clientId);
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
    return FlowDeskStore.getWorkspaceHealthDetails(clientId);
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

export const InvoiceService = {
  getInvoices: async (clientId?: string): Promise<Invoice[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getInvoices(clientId);

    try {
      let query = supabase.from('invoices').select('*, invoice_items(*)').eq('workspace_id', wsId);
      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) return FlowDeskStore.getInvoices(clientId);

      return data.map((i) => ({
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
        paymentStatus: i.paid_amount >= i.total_amount ? 'paid' : 'pending',
        status: i.status || 'draft',
        items: (i.invoice_items || []).map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: Number(item.quantity) || 1,
          rate: Number(item.unit_price) || 0,
          amount: Number(item.amount) || 0,
        })),
        subtotal: Number(i.subtotal) || 0,
        taxPercentage: Number(i.tax_percentage) || 10,
        tax: Number(i.tax_amount) || 0,
        total: Number(i.total_amount) || 0,
        currency: i.currency || 'USD',
        notes: i.notes || '',
      }));
    } catch {
      return FlowDeskStore.getInvoices(clientId);
    }
  },

  getInvoiceById: async (id: string): Promise<Invoice | undefined> => {
    const invs = await InvoiceService.getInvoices();
    return invs.find((i) => i.id === id);
  },

  createInvoice: async (
    invoice: Partial<Invoice> & { clientId: string; items: any[] }
  ): Promise<Invoice> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.createInvoice(invoice);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const subtotal = (invoice.items || []).reduce((acc, it) => acc + (Number(it.rate) * Number(it.quantity) || 0), 0);
      const taxAmount = Math.round(subtotal * ((invoice.taxPercentage || 10) / 100));
      const totalAmount = subtotal + taxAmount;

      const payload = {
        workspace_id: wsId,
        client_id: invoice.clientId,
        user_id: user?.id || null,
        client_name: invoice.clientName || 'Client Workspace',
        client_email: invoice.clientEmail || 'client@example.com',
        project_id: invoice.projectId || null,
        project_name: invoice.projectName || null,
        invoice_number: invoice.invoiceNumber || `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: invoice.status || 'draft',
        issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
        due_date: invoice.dueDate || new Date().toISOString().split('T')[0],
        subtotal,
        tax_percentage: invoice.taxPercentage || 10,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        paid_amount: 0,
        currency: invoice.currency || 'USD',
        notes: invoice.notes || '',
      };

      const { data: inv, error } = await supabase.from('invoices').insert(payload).select().single();
      if (error || !inv) return FlowDeskStore.createInvoice(invoice);

      if (invoice.items && invoice.items.length > 0) {
        const itemPayloads = invoice.items.map((it) => ({
          invoice_id: inv.id,
          description: it.description || 'Deliverable Item',
          quantity: it.quantity || 1,
          unit_price: it.rate || 0,
          amount: (it.quantity || 1) * (it.rate || 0),
        }));
        await supabase.from('invoice_items').insert(itemPayloads);
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        clientId: inv.client_id,
        clientName: inv.client_name,
        clientEmail: inv.client_email,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        workflowStatus: 'draft',
        paymentStatus: 'pending',
        status: inv.status,
        items: invoice.items || [],
        subtotal,
        taxPercentage: inv.tax_percentage,
        tax: taxAmount,
        total: totalAmount,
        currency: inv.currency,
        notes: inv.notes,
      };
    } catch {
      return FlowDeskStore.createInvoice(invoice);
    }
  },

  updateInvoice: async (id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> => {
    return FlowDeskStore.updateInvoice(id, updates);
  },
  deleteInvoice: async (id: string): Promise<boolean> => {
    return FlowDeskStore.deleteInvoice(id);
  },
  markAsPaid: async (id: string): Promise<Invoice | undefined> => {
    return FlowDeskStore.markInvoicePaidOffline(id, 'bank_transfer', 'Payment marked paid');
  },
  markInvoicePaidOffline: async (
    id: string,
    paymentMethod: string = 'bank_transfer',
    notes?: string
  ): Promise<Invoice | undefined> => {
    return FlowDeskStore.markInvoicePaidOffline(id, paymentMethod, notes);
  },
  sendReminder: async (id: string, notes?: string): Promise<{ success: boolean; message: string; invoice?: Invoice }> => {
    return FlowDeskStore.sendInvoiceReminder(id, notes);
  },
  recordInvoiceView: async (id: string): Promise<Invoice | undefined> => {
    return FlowDeskStore.recordInvoiceView(id);
  },
  getFinancialMetrics: async (): Promise<FinancialDashboardMetrics> => {
    return FlowDeskStore.getFinancialMetrics();
  },
};

export const ActivityService = {
  getActivities: async (): Promise<ActivityLog[]> => {
    const wsId = await WorkspaceService.getActiveWorkspaceId();
    if (!wsId) return FlowDeskStore.getActivities();

    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: false });

      if (error || !data) return FlowDeskStore.getActivities();

      return data.map((a) => ({
        id: a.id,
        timestamp: a.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        user: a.user_name || 'Member',
        action: a.action,
        target: a.title,
        category: (a.resource_type as any) || 'client',
      }));
    } catch {
      return FlowDeskStore.getActivities();
    }
  },

  logActivity: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    return FlowDeskStore.logActivity(log);
  },
};

export const SearchService = {
  search: (query: string) => {
    return FlowDeskStore.search(query);
  },
  getRecentSearches: (): string[] => {
    return FlowDeskStore.getRecentSearches();
  },
  addRecentSearch: (query: string) => {
    FlowDeskStore.addRecentSearch(query);
  },
};

export const SettingsService = {
  getUserProfile: async (): Promise<UserProfile> => {
    return FlowDeskStore.getUserProfile();
  },
  updateUserProfile: async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    return FlowDeskStore.updateUserProfile(updates);
  },
};

export const AuthService = {
  getCurrentUser: async (): Promise<UserProfile | null> => {
    return SettingsService.getUserProfile();
  },
};
