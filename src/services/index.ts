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
import { FlowDeskStore } from './storage-store';

export const DashboardService = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    return FlowDeskStore.getDashboardMetrics();
  },
};

export const ClientService = {
  getClients: async (): Promise<Client[]> => {
    return FlowDeskStore.getClients();
  },
  getClientById: async (id: string): Promise<Client | undefined> => {
    return FlowDeskStore.getClientById(id);
  },
  createClient: async (client: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>): Promise<Client> => {
    return FlowDeskStore.createClient(client);
  },
  updateClient: async (id: string, updates: Partial<Client>): Promise<Client | undefined> => {
    return FlowDeskStore.updateClient(id, updates);
  },
  archiveClient: async (id: string): Promise<Client | undefined> => {
    return FlowDeskStore.archiveClient(id);
  },
  restoreClient: async (id: string): Promise<Client | undefined> => {
    return FlowDeskStore.restoreClient(id);
  },
  deleteClient: async (id: string): Promise<boolean> => {
    return FlowDeskStore.deleteClient(id);
  },
};

export const ProjectService = {
  getProjects: async (): Promise<Project[]> => {
    return FlowDeskStore.getProjects();
  },
  getProjectsByClientId: async (clientId: string): Promise<Project[]> => {
    return FlowDeskStore.getProjectsByClientId(clientId);
  },
  getProjectById: async (id: string): Promise<Project | undefined> => {
    return FlowDeskStore.getProjectById(id);
  },
  createProject: async (project: Omit<Project, 'id' | 'completionPercentage' | 'spent'>): Promise<Project> => {
    return FlowDeskStore.createProject(project);
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

export const WorkspaceService = {
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

export const DocumentService = {
  getDocuments: async (clientId?: string): Promise<DocumentItem[]> => {
    return FlowDeskStore.getDocuments(clientId);
  },
  requestDocument: async (
    clientId: string,
    data: { title: string; type: DocumentItem['type']; isRequired?: boolean; dueDate?: string; description?: string }
  ): Promise<DocumentItem> => {
    return FlowDeskStore.requestDocument(clientId, data);
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
    return FlowDeskStore.deleteDocument(docId);
  },
};

export const DeliverableService = {
  getDeliverables: async (clientId?: string, includeArchived?: boolean): Promise<Deliverable[]> => {
    return FlowDeskStore.getDeliverables(clientId, includeArchived);
  },
  getDeliverableById: async (id: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.getDeliverableById(id);
  },
  addDeliverable: async (delData: Omit<Deliverable, 'id'>): Promise<Deliverable> => {
    return FlowDeskStore.addDeliverable(delData);
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
  uploadNewVersion: async (
    id: string,
    versionData: { version: string; note: string; fileUrl?: string; fileName?: string; fileSize?: string; uploadedBy?: string }
  ): Promise<Deliverable | undefined> => {
    return FlowDeskStore.replaceDeliverableVersion(id, versionData);
  },
  replaceDeliverableVersion: async (
    id: string,
    versionData: { version: string; note: string; fileUrl?: string; fileName?: string; fileSize?: string; uploadedBy?: string }
  ): Promise<Deliverable | undefined> => {
    return FlowDeskStore.replaceDeliverableVersion(id, versionData);
  },
  restoreDeliverableVersion: async (id: string, versionId: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.restoreDeliverableVersion(id, versionId);
  },
  addDeliverableFile: async (
    id: string,
    fileData: { fileName: string; fileSize: string; fileType: string; fileUrl?: string; folder?: string }
  ): Promise<Deliverable | undefined> => {
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
  addDeliverableComment: async (
    id: string,
    commentData: {
      author: string;
      authorRole: 'freelancer' | 'client' | 'team';
      isInternal: boolean;
      content: string;
      attachments?: string[];
      replyToId?: string;
    }
  ): Promise<Deliverable | undefined> => {
    return FlowDeskStore.addDeliverableComment(id, commentData);
  },
  toggleResolveDeliverableComment: async (id: string, commentId: string): Promise<Deliverable | undefined> => {
    return FlowDeskStore.toggleResolveDeliverableComment(id, commentId);
  },
  submitDeliverableClientReview: async (
    id: string,
    reviewData: { action: 'approve' | 'reject' | 'revision' | 'viewed'; notes?: string; reviewerName: string }
  ): Promise<Deliverable | undefined> => {
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
  bulkUpdateDeliverables: async (ids: string[], action: 'archive' | 'delete' | 'submit' | 'mark_ready'): Promise<boolean> => {
    return FlowDeskStore.bulkUpdateDeliverables(ids, action);
  },
};

export const CommentService = {
  getComments: async (clientId: string): Promise<WorkspaceComment[]> => {
    return FlowDeskStore.getComments(clientId);
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
    return FlowDeskStore.addComment(clientId, commentData);
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
    return FlowDeskStore.getNotifications();
  },
  addNotification: async (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): Promise<NotificationItem> => {
    return FlowDeskStore.addNotification(notif);
  },
  markAllAsRead: async (): Promise<void> => {
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

    const approvalsPct = delivs.length
      ? Math.round((approvedDelivs / delivs.length) * 100)
      : 100;
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

    const missingDocs = summary.documents.filter((d) => d.status === 'missing' || d.status === 'pending' || d.status === 'rejected');
    if (missingDocs.length > 0) {
      score -= missingDocs.length * 10;
      reasons.push(`${missingDocs.length} requested document(s) pending client upload/verification.`);
    }

    const delivsNeedingReview = summary.deliverables.filter((d) => d.status === 'ready_for_review' || d.status === 'submitted');
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
    return FlowDeskStore.getInvoices(clientId);
  },
  getInvoiceById: async (id: string): Promise<Invoice | undefined> => {
    return FlowDeskStore.getInvoiceById(id);
  },
  createInvoice: async (
    invoice: Partial<Invoice> & { clientId: string; items: any[] }
  ): Promise<Invoice> => {
    return FlowDeskStore.createInvoice(invoice);
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
    return FlowDeskStore.getActivities();
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
