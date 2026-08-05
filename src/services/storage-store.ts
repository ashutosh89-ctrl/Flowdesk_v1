import {
  Client,
  Project,
  Deliverable,
  DeliverableVersion,
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
  WorkspaceHealthStatus,
  ProjectMilestone,
} from '../types';
import {
  mockClients,
  mockProjects,
  mockDeliverables,
  mockDocuments,
  mockInvoices,
  mockActivities,
  mockNotifications,
  mockUserProfile,
  mockDashboardMetrics,
} from '../mock/mockData';

const STORAGE_KEYS = {
  CLIENTS: 'flowdesk_clients',
  PROJECTS: 'flowdesk_projects',
  DELIVERABLES: 'flowdesk_deliverables',
  DOCUMENTS: 'flowdesk_documents',
  INVOICES: 'flowdesk_invoices',
  ACTIVITIES: 'flowdesk_activities',
  COMMENTS: 'flowdesk_comments',
  PORTALS: 'flowdesk_portals',
  RECENT_SEARCHES: 'flowdesk_recent_searches',
  USER_PROFILE: 'flowdesk_user_profile',
  NOTIFICATIONS: 'flowdesk_notifications',
};

// Initial Mock Milestones for projects
const initialMilestones: Record<string, ProjectMilestone[]> = {
  'proj-1': [
    { id: 'm-1', projectId: 'proj-1', title: 'Figma Token Spec & Color System', dueDate: '2026-06-15', completed: true },
    { id: 'm-2', projectId: 'proj-1', title: 'Command Palette UI Component', dueDate: '2026-07-20', completed: true },
    { id: 'm-3', projectId: 'proj-1', title: 'Analytics Dashboard Widgets', dueDate: '2026-08-10', completed: false },
    { id: 'm-4', projectId: 'proj-1', title: 'Final System Handover & Package', dueDate: '2026-08-25', completed: false },
  ],
  'proj-2': [
    { id: 'm-5', projectId: 'proj-2', title: 'Data Pipeline Schema Definition', dueDate: '2026-05-20', completed: true },
    { id: 'm-6', projectId: 'proj-2', title: 'D3 Chart Integration', dueDate: '2026-06-30', completed: true },
    { id: 'm-7', projectId: 'proj-2', title: 'Export Engine & CSV Generators', dueDate: '2026-08-05', completed: true },
  ],
  'proj-3': [
    { id: 'm-8', projectId: 'proj-3', title: 'Brand Identity Strategy & Moodboard', dueDate: '2026-07-15', completed: true },
    { id: 'm-9', projectId: 'proj-3', title: '3D Spatial Glass Hero Render', dueDate: '2026-08-15', completed: false },
  ],
  'proj-4': [
    { id: 'm-10', projectId: 'proj-4', title: 'Conversational Agent Canvas UI', dueDate: '2026-07-25', completed: true },
    { id: 'm-11', projectId: 'proj-4', title: 'Voice Waveform Audio Visualizer', dueDate: '2026-08-10', completed: true },
    { id: 'm-12', projectId: 'proj-4', title: 'Custom Settings & Key Storage Panel', dueDate: '2026-08-30', completed: false },
  ],
};

// Initial Mock Comments for client workspaces
const initialComments: WorkspaceComment[] = [
  {
    id: 'c-1',
    clientId: 'cli-1',
    author: 'Eleanor Vance',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    time: '2 hours ago',
    text: 'The dark crystal theme and token architecture look phenomenal! Let’s proceed with option B for the analytics suite.',
    isOwner: false,
    read: true,
  },
  {
    id: 'c-2',
    clientId: 'cli-1',
    author: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    time: '1 hour ago',
    text: 'Fantastic! I have updated the Figma token package and uploaded version v1.4.0 to the Deliverables tab.',
    isOwner: true,
    read: true,
  },
  {
    id: 'c-3',
    clientId: 'cli-2',
    author: 'Marcus Sterling',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    time: 'Yesterday at 4:15 PM',
    text: 'Hey Alex, could you send over the updated brand strategy deck before our call on Thursday?',
    isOwner: false,
    read: true,
  },
];

// Helper to safely fetch item from localStorage or load default
const loadStore = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveStore = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

// State Singletons
let clients: Client[] = loadStore(STORAGE_KEYS.CLIENTS, mockClients);
let projects: Project[] = loadStore(STORAGE_KEYS.PROJECTS, mockProjects.map(p => ({
  ...p,
  milestones: initialMilestones[p.id] || [],
})));
let deliverables: Deliverable[] = loadStore(STORAGE_KEYS.DELIVERABLES, mockDeliverables);
let documents: DocumentItem[] = loadStore(STORAGE_KEYS.DOCUMENTS, mockDocuments);
let invoices: Invoice[] = loadStore(STORAGE_KEYS.INVOICES, mockInvoices);
let activities: ActivityLog[] = loadStore(STORAGE_KEYS.ACTIVITIES, mockActivities);
let comments: WorkspaceComment[] = loadStore(STORAGE_KEYS.COMMENTS, initialComments);
let portals: Record<string, ClientPortalConfig> = loadStore(STORAGE_KEYS.PORTALS, {
  'cli-1': { clientId: 'cli-1', enabled: true, magicKey: 'magic-key-cli-1', lastAccessed: '10m ago' },
  'cli-2': { clientId: 'cli-2', enabled: true, magicKey: 'magic-key-cli-2', lastAccessed: 'Yesterday' },
  'cli-3': { clientId: 'cli-3', enabled: true, magicKey: 'magic-key-cli-3', lastAccessed: '3 days ago' },
  'cli-4': { clientId: 'cli-4', enabled: false, magicKey: 'magic-key-cli-4' },
});
let recentSearches: string[] = loadStore(STORAGE_KEYS.RECENT_SEARCHES, ['Apex Digital', 'Design System', 'INV-2026-001']);
let userProfile: UserProfile = loadStore(STORAGE_KEYS.USER_PROFILE, mockUserProfile);
let notifications: NotificationItem[] = loadStore(STORAGE_KEYS.NOTIFICATIONS, mockNotifications);

// Storage Helper Object
export const FlowDeskStore = {
  // --- USER PROFILE ---
  getUserProfile: (): UserProfile => userProfile,
  updateUserProfile: (updates: Partial<UserProfile>): UserProfile => {
    userProfile = { ...userProfile, ...updates };
    saveStore(STORAGE_KEYS.USER_PROFILE, userProfile);
    return userProfile;
  },
  // --- CLIENTS ---
  getClients: (): Client[] => clients,
  getClientById: (id: string): Client | undefined => clients.find((c) => c.id === id),
  createClient: (clientData: Omit<Client, 'id' | 'totalBilled' | 'createdAt'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now().toString().slice(-4)}`,
      status: clientData.status || 'active',
      healthBadge: 'healthy',
      totalBilled: 0,
      activeProjectsCount: clientData.activeProjectsCount || 0,
      createdAt: new Date().toISOString().split('T')[0],
      isArchived: false,
    };
    clients = [newClient, ...clients];
    saveStore(STORAGE_KEYS.CLIENTS, clients);

    // Provision Portal
    portals[newClient.id] = {
      clientId: newClient.id,
      enabled: true,
      magicKey: `magic-key-${newClient.id.toLowerCase()}`,
    };
    saveStore(STORAGE_KEYS.PORTALS, portals);

    // Log activity
    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'created client workspace',
      target: newClient.company,
      category: 'client',
      metadata: `Contact: ${newClient.name} (${newClient.email})`,
    });

    return newClient;
  },
  updateClient: (id: string, updates: Partial<Client>): Client | undefined => {
    const idx = clients.findIndex((c) => c.id === id);
    if (idx !== -1) {
      clients[idx] = { ...clients[idx], ...updates };
      saveStore(STORAGE_KEYS.CLIENTS, clients);
      return clients[idx];
    }
    return undefined;
  },
  archiveClient: (id: string): Client | undefined => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      client.status = 'archived';
      client.isArchived = true;
      saveStore(STORAGE_KEYS.CLIENTS, clients);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'archived client',
        target: client.company,
        category: 'client',
      });
    }
    return client;
  },
  restoreClient: (id: string): Client | undefined => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      client.status = 'active';
      client.isArchived = false;
      saveStore(STORAGE_KEYS.CLIENTS, clients);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'restored client',
        target: client.company,
        category: 'client',
      });
    }
    return client;
  },
  deleteClient: (id: string): boolean => {
    const client = clients.find((c) => c.id === id);
    if (client) {
      clients = clients.filter((c) => c.id !== id);
      saveStore(STORAGE_KEYS.CLIENTS, clients);
      // Remove related projects, deliverables, documents, invoices, comments
      projects = projects.filter((p) => p.clientId !== id);
      saveStore(STORAGE_KEYS.PROJECTS, projects);
      deliverables = deliverables.filter((d) => d.clientId !== id);
      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      documents = documents.filter((d) => d.clientId !== id);
      saveStore(STORAGE_KEYS.DOCUMENTS, documents);
      invoices = invoices.filter((i) => i.clientId !== id);
      saveStore(STORAGE_KEYS.INVOICES, invoices);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'deleted client workspace',
        target: client.company,
        category: 'client',
      });
      return true;
    }
    return false;
  },

  // --- PROJECTS ---
  getProjects: (): Project[] => projects,
  getProjectsByClientId: (clientId: string): Project[] => projects.filter((p) => p.clientId === clientId),
  getProjectById: (id: string): Project | undefined => projects.find((p) => p.id === id),
  createProject: (projectData: Omit<Project, 'id' | 'completionPercentage' | 'spent'>): Project => {
    const newProj: Project = {
      ...projectData,
      id: `proj-${Date.now().toString().slice(-4)}`,
      completionPercentage: 0,
      spent: 0,
      milestones: [
        { id: `m-${Date.now()}-1`, projectId: `proj-${Date.now()}`, title: 'Kickoff & Discovery', dueDate: projectData.startDate, completed: true },
        { id: `m-${Date.now()}-2`, projectId: `proj-${Date.now()}`, title: 'Core Deliverables Review', dueDate: projectData.dueDate, completed: false },
      ],
      isArchived: false,
    };
    projects = [newProj, ...projects];
    saveStore(STORAGE_KEYS.PROJECTS, projects);

    // Update Client active projects count
    const targetClient = clients.find((c) => c.id === projectData.clientId);
    if (targetClient) {
      targetClient.activeProjectsCount = (targetClient.activeProjectsCount || 0) + 1;
      saveStore(STORAGE_KEYS.CLIENTS, clients);
    }

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'created project',
      target: newProj.title,
      category: 'project',
      metadata: `Client: ${newProj.clientName} | Budget: $${newProj.budget.toLocaleString()}`,
    });

    return newProj;
  },
  updateProject: (id: string, updates: Partial<Project>): Project | undefined => {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], ...updates };
      saveStore(STORAGE_KEYS.PROJECTS, projects);
      return projects[idx];
    }
    return undefined;
  },
  toggleMilestone: (projectId: string, milestoneId: string): Project | undefined => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj && proj.milestones) {
      const m = proj.milestones.find((ms) => ms.id === milestoneId);
      if (m) {
        m.completed = !m.completed;
        const total = proj.milestones.length;
        const done = proj.milestones.filter((ms) => ms.completed).length;
        proj.completionPercentage = Math.round((done / total) * 100);
        saveStore(STORAGE_KEYS.PROJECTS, projects);
      }
    }
    return proj;
  },
  addMilestone: (projectId: string, title: string, dueDate: string): Project | undefined => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      if (!proj.milestones) proj.milestones = [];
      proj.milestones.push({
        id: `m-${Date.now()}`,
        projectId,
        title,
        dueDate,
        completed: false,
      });
      saveStore(STORAGE_KEYS.PROJECTS, projects);
    }
    return proj;
  },
  markProjectComplete: (id: string): Project | undefined => {
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      proj.status = 'completed';
      proj.completionPercentage = 100;
      saveStore(STORAGE_KEYS.PROJECTS, projects);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'marked project complete',
        target: proj.title,
        category: 'project',
      });
    }
    return proj;
  },

  // --- NOTIFICATIONS ---
  getNotifications: (): NotificationItem[] => notifications,
  addNotification: (notifData: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): NotificationItem => {
    const newNotif: NotificationItem = {
      ...notifData,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: 'Just now',
      read: false,
    };
    notifications = [newNotif, ...notifications];
    saveStore(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return newNotif;
  },
  markAllNotificationsRead: (): void => {
    notifications = notifications.map((n) => ({ ...n, read: true }));
    saveStore(STORAGE_KEYS.NOTIFICATIONS, notifications);
  },
  dismissNotification: (id: string): boolean => {
    notifications = notifications.filter((n) => n.id !== id);
    saveStore(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return true;
  },

  // --- DELIVERABLES MODULE ---
  getDeliverables: (clientId?: string): Deliverable[] =>
    clientId ? deliverables.filter((d) => d.clientId === clientId && !d.isArchived) : deliverables.filter(d => !d.isArchived),
  
  addDeliverable: (delData: Omit<Deliverable, 'id'>): Deliverable => {
    const newDel: Deliverable = {
      ...delData,
      id: `del-${Date.now().toString().slice(-4)}`,
      status: delData.status || 'todo',
      version: delData.version || 'v1.0.0',
      createdAt: new Date().toISOString().split('T')[0],
      versionHistory: delData.versionHistory || [
        {
          id: `ver-${Date.now()}`,
          version: delData.version || 'v1.0.0',
          date: new Date().toISOString().split('T')[0],
          note: delData.description || 'Initial draft version uploaded',
          fileUrl: delData.fileUrl || '#',
          fileName: delData.fileName || `${delData.title.toLowerCase().replace(/\s+/g, '-')}-v1.pdf`,
          fileSize: delData.fileSize || '2.4 MB',
          uploadedBy: 'Alex Rivera',
          status: 'in_review',
        },
      ],
    };
    deliverables = [newDel, ...deliverables];
    saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'created deliverable',
      target: newDel.title,
      category: 'deliverable',
      metadata: `Version: ${newDel.version} | Due: ${newDel.dueDate}`,
    });

    FlowDeskStore.addNotification({
      title: 'New Deliverable Created',
      message: `Deliverable "${newDel.title}" (${newDel.version}) was published for review.`,
      type: 'info',
      clientId: newDel.clientId,
      category: 'deliverable',
    });

    return newDel;
  },

  replaceDeliverableVersion: (
    id: string,
    versionData: { version: string; note: string; fileUrl?: string; fileName?: string; fileSize?: string }
  ): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      const oldVerStr = del.version;
      const newVersionItem: DeliverableVersion = {
        id: `ver-${Date.now()}`,
        version: versionData.version,
        date: new Date().toISOString().split('T')[0],
        note: versionData.note,
        fileUrl: versionData.fileUrl || '#',
        fileName: versionData.fileName || `${del.title.toLowerCase().replace(/\s+/g, '-')}-${versionData.version}.zip`,
        fileSize: versionData.fileSize || '3.5 MB',
        uploadedBy: 'Alex Rivera',
        status: 'in_review',
      };

      if (!del.versionHistory) del.versionHistory = [];
      del.versionHistory = [newVersionItem, ...del.versionHistory];
      del.version = versionData.version;
      del.status = 'in_review';
      del.fileUrl = newVersionItem.fileUrl;
      del.fileName = newVersionItem.fileName;
      del.fileSize = newVersionItem.fileSize;
      del.revisionNote = undefined;

      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'uploaded new deliverable version',
        target: `${del.title} (${oldVerStr} → ${versionData.version})`,
        category: 'deliverable',
        metadata: `Version Note: ${versionData.note}`,
      });

      FlowDeskStore.addNotification({
        title: 'Deliverable Version Updated',
        message: `Version ${versionData.version} for "${del.title}" is ready for client review.`,
        type: 'info',
        clientId: del.clientId,
        category: 'deliverable',
      });
    }
    return del;
  },

  approveDeliverable: (id: string, note?: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      del.status = 'approved';
      if (note) del.revisionNote = note;

      if (del.versionHistory && del.versionHistory.length > 0) {
        del.versionHistory[0].status = 'approved';
      }

      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

      FlowDeskStore.logActivity({
        user: 'Client',
        action: 'approved deliverable',
        target: del.title,
        category: 'deliverable',
        metadata: note ? `Client note: ${note}` : `Approved ${del.version}`,
      });

      FlowDeskStore.addNotification({
        title: 'Deliverable Approved!',
        message: `Client approved "${del.title}" (${del.version}).`,
        type: 'success',
        clientId: del.clientId,
        category: 'deliverable',
      });
    }
    return del;
  },

  requestDeliverableRevision: (id: string, revisionComment: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      del.status = 'changes_requested';
      del.revisionNote = revisionComment;

      if (del.versionHistory && del.versionHistory.length > 0) {
        del.versionHistory[0].status = 'changes_requested';
        del.versionHistory[0].revisionComment = revisionComment;
      }

      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

      FlowDeskStore.logActivity({
        user: 'Client',
        action: 'requested revisions on deliverable',
        target: del.title,
        category: 'deliverable',
        metadata: `Comment: "${revisionComment}"`,
      });

      FlowDeskStore.addNotification({
        title: 'Revision Requested',
        message: `Client requested changes on "${del.title}": "${revisionComment}"`,
        type: 'warning',
        clientId: del.clientId,
        category: 'deliverable',
      });
    }
    return del;
  },

  archiveDeliverableVersion: (id: string, versionNumber: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del && del.versionHistory) {
      const vItem = del.versionHistory.find((vh) => vh.version === versionNumber);
      if (vItem) {
        vItem.isArchived = !vItem.isArchived;
        saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      }
    }
    return del;
  },

  deleteDeliverableDraft: (id: string): boolean => {
    deliverables = deliverables.filter((d) => d.id !== id);
    saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    return true;
  },

  updateDeliverableInternalNotes: (id: string, notes: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      del.internalNotes = notes;
      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    }
    return del;
  },

  // --- DOCUMENTS MODULE ---
  getDocuments: (clientId?: string): DocumentItem[] =>
    clientId ? documents.filter((d) => d.clientId === clientId) : documents,

  requestDocument: (
    clientId: string,
    data: { title: string; type: DocumentItem['type']; isRequired?: boolean; dueDate?: string; description?: string }
  ): DocumentItem => {
    const newDoc: DocumentItem = {
      id: `doc-${Date.now().toString().slice(-4)}`,
      clientId,
      title: data.title,
      description: data.description,
      type: data.type,
      status: 'pending',
      isRequired: data.isRequired ?? true,
      order: documents.filter((d) => d.clientId === clientId).length + 1,
      dueDate: data.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      requestedAt: new Date().toISOString().split('T')[0],
      size: 'Awaiting client upload',
    };
    documents = [newDoc, ...documents];
    saveStore(STORAGE_KEYS.DOCUMENTS, documents);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'requested document from client',
      target: data.title,
      category: 'document',
      metadata: `Required: ${data.isRequired ? 'Yes' : 'No'} | Due: ${newDoc.dueDate}`,
    });

    FlowDeskStore.addNotification({
      title: 'Document Requested',
      message: `Requested "${data.title}" from client. Checklist updated.`,
      type: 'info',
      clientId,
      category: 'document',
    });

    return newDoc;
  },

  reorderDocuments: (clientId: string, docIds: string[]): DocumentItem[] => {
    docIds.forEach((id, index) => {
      const doc = documents.find((d) => d.id === id);
      if (doc) {
        doc.order = index + 1;
      }
    });
    saveStore(STORAGE_KEYS.DOCUMENTS, documents);
    return documents.filter((d) => d.clientId === clientId);
  },

  uploadDocumentFile: (
    docId: string,
    fileData: { fileName?: string; size?: string; downloadUrl?: string }
  ): DocumentItem | undefined => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      doc.status = 'uploaded';
      doc.fileName = fileData.fileName || `${doc.title.toLowerCase().replace(/\s+/g, '-')}-uploaded.pdf`;
      doc.size = fileData.size || '1.8 MB';
      doc.downloadUrl = fileData.downloadUrl || '#';
      doc.uploadedAt = new Date().toISOString().split('T')[0];
      doc.updatedAt = new Date().toISOString().split('T')[0];
      doc.rejectionReason = undefined;

      saveStore(STORAGE_KEYS.DOCUMENTS, documents);

      FlowDeskStore.logActivity({
        user: 'Client',
        action: 'uploaded document',
        target: doc.title,
        category: 'document',
        metadata: `File: ${doc.fileName} (${doc.size})`,
      });

      FlowDeskStore.addNotification({
        title: 'Document Uploaded',
        message: `Client uploaded "${doc.title}". Ready for verification.`,
        type: 'info',
        clientId: doc.clientId,
        category: 'document',
      });
    }
    return doc;
  },

  verifyDocument: (docId: string, notes?: string): DocumentItem | undefined => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      doc.status = 'verified';
      doc.verifiedAt = new Date().toISOString().split('T')[0];
      doc.verificationNotes = notes;
      doc.updatedAt = new Date().toISOString().split('T')[0];

      saveStore(STORAGE_KEYS.DOCUMENTS, documents);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'verified document',
        target: doc.title,
        category: 'document',
        metadata: notes ? `Notes: ${notes}` : 'Document verified successfully',
      });

      FlowDeskStore.addNotification({
        title: 'Document Verified',
        message: `Document "${doc.title}" has been verified and approved.`,
        type: 'success',
        clientId: doc.clientId,
        category: 'document',
      });
    }
    return doc;
  },

  rejectDocument: (docId: string, rejectionReason: string): DocumentItem | undefined => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      doc.status = 'rejected';
      doc.rejectionReason = rejectionReason;
      doc.updatedAt = new Date().toISOString().split('T')[0];

      saveStore(STORAGE_KEYS.DOCUMENTS, documents);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'rejected document',
        target: doc.title,
        category: 'document',
        metadata: `Reason: "${rejectionReason}"`,
      });

      FlowDeskStore.addNotification({
        title: 'Document Rejected',
        message: `Document "${doc.title}" was rejected: "${rejectionReason}"`,
        type: 'warning',
        clientId: doc.clientId,
        category: 'document',
      });
    }
    return doc;
  },

  requestReupload: (docId: string, reason: string): DocumentItem | undefined => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      doc.status = 'pending';
      doc.rejectionReason = reason;
      doc.size = 'Re-upload requested';
      doc.updatedAt = new Date().toISOString().split('T')[0];

      saveStore(STORAGE_KEYS.DOCUMENTS, documents);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'requested re-upload of document',
        target: doc.title,
        category: 'document',
        metadata: `Notes: "${reason}"`,
      });

      FlowDeskStore.addNotification({
        title: 'Re-upload Requested',
        message: `Requested client re-upload for "${doc.title}": "${reason}"`,
        type: 'info',
        clientId: doc.clientId,
        category: 'document',
      });
    }
    return doc;
  },

  deleteDocument: (docId: string): boolean => {
    documents = documents.filter((d) => d.id !== docId);
    saveStore(STORAGE_KEYS.DOCUMENTS, documents);
    return true;
  },

  // --- COMMENTS MODULE ---
  getComments: (clientId: string): WorkspaceComment[] =>
    comments.filter((c) => c.clientId === clientId),

  addComment: (
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
  ): WorkspaceComment => {
    const author = commentData.author || 'Alex Rivera';
    const newComment: WorkspaceComment = {
      id: `c-${Date.now()}`,
      clientId,
      author,
      avatar: commentData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      time: 'Just now',
      text: commentData.text,
      isOwner: commentData.isOwner ?? true,
      read: true,
      replyToId: commentData.replyToId,
      replyToAuthor: commentData.replyToAuthor,
      replyToText: commentData.replyToText,
      mentions: commentData.mentions,
      attachments: commentData.attachments,
      isPinned: commentData.isPinned || false,
      updatedAt: new Date().toISOString(),
    };
    comments = [...comments, newComment];
    saveStore(STORAGE_KEYS.COMMENTS, comments);

    FlowDeskStore.logActivity({
      user: author,
      action: 'posted comment in workspace',
      target: commentData.text.length > 35 ? commentData.text.slice(0, 35) + '...' : commentData.text,
      category: 'comment',
    });

    FlowDeskStore.addNotification({
      title: 'New Workspace Comment',
      message: `${author}: "${commentData.text.slice(0, 50)}..."`,
      type: 'info',
      clientId,
      category: 'comment',
    });

    return newComment;
  },

  editComment: (commentId: string, newText: string): WorkspaceComment | undefined => {
    const c = comments.find((item) => item.id === commentId);
    if (c) {
      c.text = newText;
      c.updatedAt = new Date().toISOString();
      saveStore(STORAGE_KEYS.COMMENTS, comments);
    }
    return c;
  },

  deleteComment: (commentId: string): boolean => {
    comments = comments.filter((c) => c.id !== commentId);
    saveStore(STORAGE_KEYS.COMMENTS, comments);
    return true;
  },

  togglePinComment: (commentId: string): WorkspaceComment | undefined => {
    const c = comments.find((item) => item.id === commentId);
    if (c) {
      c.isPinned = !c.isPinned;
      saveStore(STORAGE_KEYS.COMMENTS, comments);
    }
    return c;
  },

  markCommentsAsRead: (clientId: string): void => {
    comments = comments.map((c) => (c.clientId === clientId ? { ...c, read: true } : c));
    saveStore(STORAGE_KEYS.COMMENTS, comments);
  },

  // --- PORTAL CONFIG & INVITATIONS ---
  getPortalConfig: (clientId: string): ClientPortalConfig => {
    if (!portals[clientId]) {
      portals[clientId] = {
        clientId,
        enabled: true,
        magicKey: `magic-key-${clientId.toLowerCase()}`,
        inviteStatus: 'accepted',
        portalUrl: `/portal/${clientId}?key=magic-key-${clientId.toLowerCase()}`,
      };
      saveStore(STORAGE_KEYS.PORTALS, portals);
    }
    return portals[clientId];
  },

  inviteClient: (clientId: string, email: string): ClientPortalConfig => {
    const cfg = FlowDeskStore.getPortalConfig(clientId);
    const client = clients.find((c) => c.id === clientId);
    cfg.inviteStatus = 'invited';
    cfg.invitedAt = new Date().toISOString().split('T')[0];
    cfg.inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${clientId}?invite=${cfg.magicKey}`;
    saveStore(STORAGE_KEYS.PORTALS, portals);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'sent client portal invitation',
      target: client ? client.company : email,
      category: 'portal',
      metadata: `Invited email: ${email}`,
    });

    FlowDeskStore.addNotification({
      title: 'Client Invitation Sent',
      message: `Invitation generated and sent to ${email}.`,
      type: 'success',
      clientId,
      category: 'portal',
    });

    return cfg;
  },

  acceptInvitation: (clientId: string): ClientPortalConfig => {
    const cfg = FlowDeskStore.getPortalConfig(clientId);
    cfg.inviteStatus = 'accepted';
    cfg.acceptedAt = new Date().toISOString().split('T')[0];
    cfg.lastAccessed = 'Just now';
    saveStore(STORAGE_KEYS.PORTALS, portals);

    FlowDeskStore.logActivity({
      user: 'Client',
      action: 'accepted portal invitation',
      target: `Workspace ${clientId}`,
      category: 'portal',
    });

    FlowDeskStore.addNotification({
      title: 'Portal Invitation Accepted',
      message: `Client activated their portal access successfully.`,
      type: 'success',
      clientId,
      category: 'portal',
    });

    return cfg;
  },

  togglePortalAccess: (clientId: string, enabled: boolean): ClientPortalConfig => {
    const cfg = FlowDeskStore.getPortalConfig(clientId);
    cfg.enabled = enabled;
    saveStore(STORAGE_KEYS.PORTALS, portals);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: enabled ? 'enabled client portal' : 'disabled client portal',
      target: `Workspace ${clientId}`,
      category: 'portal',
    });

    return cfg;
  },

  regeneratePortalLink: (clientId: string): ClientPortalConfig => {
    const cfg = FlowDeskStore.getPortalConfig(clientId);
    const newKey = `magic-key-${clientId.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    cfg.magicKey = newKey;
    cfg.portalUrl = `/portal/${clientId}?key=${newKey}`;
    if (cfg.inviteStatus === 'invited') {
      cfg.inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${clientId}?invite=${newKey}`;
    }
    saveStore(STORAGE_KEYS.PORTALS, portals);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'regenerated client magic portal link',
      target: `Workspace ${clientId}`,
      category: 'portal',
    });

    return cfg;
  },

  getClientPortalDashboardData: (clientId: string): ClientPortalDashboardData | null => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;

    const clientProjects = projects.filter((p) => p.clientId === clientId);
    const clientDeliverables = deliverables.filter((d) => d.clientId === clientId && !d.isArchived);
    const clientDocuments = documents.filter((d) => d.clientId === clientId);
    const clientInvoices = invoices.filter((i) => i.clientId === clientId);

    const pendingDocs = clientDocuments.filter((d) => d.status === 'pending' || d.status === 'rejected');
    const pendingDelivs = clientDeliverables.filter((d) => d.status === 'in_review' || d.status === 'todo');
    const unpaidInvoices = clientInvoices.filter((i) => i.status === 'pending' || i.status === 'overdue');
    const outstandingTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

    const recentActs = activities.filter(
      (a) => a.target.includes(client.company) || a.target.includes(client.name)
    ).slice(0, 5);

    const upcomingTasks = [
      ...pendingDocs.map((d) => ({
        id: d.id,
        title: `Upload Required Document: ${d.title}`,
        dueDate: d.dueDate || 'ASAP',
        category: 'Document Request',
      })),
      ...pendingDelivs.map((d) => ({
        id: d.id,
        title: `Review Deliverable: ${d.title} (${d.version})`,
        dueDate: d.dueDate || 'In Review',
        category: 'Deliverable Review',
      })),
    ];

    let nextAction: ClientPortalDashboardData['nextAction'] = undefined;
    if (pendingDocs.length > 0) {
      nextAction = {
        title: 'Document Upload Required',
        description: `Please upload "${pendingDocs[0].title}" to keep the project on schedule.`,
        actionType: 'upload_doc',
      };
    } else if (pendingDelivs.length > 0) {
      nextAction = {
        title: 'Deliverable Ready for Review',
        description: `Version ${pendingDelivs[0].version} of "${pendingDelivs[0].title}" is awaiting your feedback.`,
        actionType: 'review_deliverable',
      };
    } else if (unpaidInvoices.length > 0) {
      nextAction = {
        title: 'Outstanding Invoice Payment',
        description: `Invoice ${unpaidInvoices[0].invoiceNumber} ($${unpaidInvoices[0].total.toLocaleString()}) is ready for payment.`,
        actionType: 'pay_invoice',
      };
    }

    return {
      client,
      projects: clientProjects,
      upcomingTasks,
      pendingApprovalsCount: pendingDelivs.length,
      pendingDocumentsCount: pendingDocs.length,
      outstandingInvoicesTotal: outstandingTotal,
      recentActivities: recentActs,
      nextAction,
    };
  },

  // --- WORKSPACE PROGRESS ENGINE ---
  getWorkspaceProgressBreakdown: (clientId: string): WorkspaceProgressBreakdown => {
    const clientDocs = documents.filter((d) => d.clientId === clientId && d.isRequired !== false);
    const clientProjects = projects.filter((p) => p.clientId === clientId);
    const clientDeliverables = deliverables.filter((d) => d.clientId === clientId && !d.isArchived);
    const clientInvoices = invoices.filter((i) => i.clientId === clientId);

    // 1. Documents (20%)
    let docsProgress = 20;
    if (clientDocs.length > 0) {
      const verifiedCount = clientDocs.filter((d) => d.status === 'verified' || d.status === 'signed').length;
      docsProgress = Math.round((verifiedCount / clientDocs.length) * 20);
    }

    // 2. Project Milestones (30%)
    let milestonesProgress = 30;
    let totalMilestones = 0;
    let completedMilestones = 0;
    clientProjects.forEach((p) => {
      if (p.milestones && p.milestones.length > 0) {
        totalMilestones += p.milestones.length;
        completedMilestones += p.milestones.filter((m) => m.completed).length;
      }
    });
    if (totalMilestones > 0) {
      milestonesProgress = Math.round((completedMilestones / totalMilestones) * 30);
    }

    // 3. Deliverables Approved (30%)
    let delivProgress = 30;
    if (clientDeliverables.length > 0) {
      const approvedCount = clientDeliverables.filter((d) => d.status === 'approved' || d.status === 'completed').length;
      delivProgress = Math.round((approvedCount / clientDeliverables.length) * 30);
    }

    // 4. Invoices / Approvals (20%)
    let approvalsProgress = 20;
    if (clientInvoices.length > 0) {
      const paidCount = clientInvoices.filter((i) => i.status === 'paid').length;
      approvalsProgress = Math.round((paidCount / clientInvoices.length) * 20);
    }

    const total = Math.min(100, docsProgress + milestonesProgress + delivProgress + approvalsProgress);

    let stage: WorkspaceProgressBreakdown['stage'] = 'Planning';
    if (total >= 100) stage = 'Completed';
    else if (total > 70) stage = 'Review';
    else if (total > 25) stage = 'In Progress';

    return {
      documentsProgress: docsProgress,
      milestonesProgress,
      deliverablesProgress: delivProgress,
      approvalsProgress,
      totalPercentage: total,
      overallPercentage: total,
      documentsPercentage: Math.round((docsProgress / 20) * 100),
      milestonesPercentage: Math.round((milestonesProgress / 30) * 100),
      deliverablesPercentage: Math.round((delivProgress / 30) * 100),
      approvalsPercentage: Math.round((approvalsProgress / 20) * 100),
      stage,
    };
  },

  // --- WORKSPACE HEALTH ENGINE ---
  getWorkspaceHealthDetails: (clientId: string): WorkspaceHealthDetails => {
    const clientDocs = documents.filter((d) => d.clientId === clientId);
    const clientDeliverables = deliverables.filter((d) => d.clientId === clientId && !d.isArchived);
    const clientInvoices = invoices.filter((i) => i.clientId === clientId);
    const portalConfig = FlowDeskStore.getPortalConfig(clientId);

    const reasons: string[] = [];
    let hasBlocked = false;
    let hasWaitingOnClient = false;
    let hasWaitingOnFreelancer = false;
    let isAllComplete = true;

    // Check Documents
    const rejectedDocs = clientDocs.filter((d) => d.status === 'rejected');
    if (rejectedDocs.length > 0) {
      hasBlocked = true;
      reasons.push(`${rejectedDocs.length} document(s) rejected & need resolution`);
    }

    const pendingDocs = clientDocs.filter((d) => d.status === 'pending');
    if (pendingDocs.length > 0) {
      hasWaitingOnClient = true;
      reasons.push(`Waiting for client to upload ${pendingDocs.length} required document(s)`);
    }

    // Check Deliverables
    const revisionReq = clientDeliverables.filter((d) => d.status === 'changes_requested');
    if (revisionReq.length > 0) {
      hasWaitingOnFreelancer = true;
      reasons.push(`Freelancer needs to address revisions on ${revisionReq.length} deliverable(s)`);
    }

    const inReviewDelivs = clientDeliverables.filter((d) => d.status === 'in_review');
    if (inReviewDelivs.length > 0) {
      hasWaitingOnClient = true;
      reasons.push(`Client review pending on ${inReviewDelivs.length} deliverable(s)`);
    }

    // Check Invoices
    const overdueInvoices = clientInvoices.filter((i) => i.status === 'overdue');
    if (overdueInvoices.length > 0) {
      hasBlocked = true;
      reasons.push(`${overdueInvoices.length} overdue invoice(s) blocking project workflow`);
    }

    if (portalConfig.inviteStatus === 'invited') {
      hasWaitingOnClient = true;
      reasons.push('Portal invitation sent, awaiting client setup');
    }

    // Determine completion
    const unapprovedDeliverables = clientDeliverables.filter((d) => d.status !== 'approved' && d.status !== 'completed');
    if (unapprovedDeliverables.length > 0 || pendingDocs.length > 0 || clientInvoices.some((i) => i.status !== 'paid')) {
      isAllComplete = false;
    }

    let status: WorkspaceHealthStatus = 'Healthy';
    let score = 100;

    if (isAllComplete && clientDeliverables.length > 0) {
      status = 'Completed';
      score = 100;
      reasons.push('All deliverables, documents, and invoices successfully completed!');
    } else if (hasBlocked) {
      status = 'Blocked';
      score = 45;
    } else if (hasWaitingOnFreelancer) {
      status = 'Waiting on Freelancer';
      score = 75;
    } else if (hasWaitingOnClient) {
      status = 'Waiting on Client';
      score = 85;
    } else {
      status = 'Healthy';
      score = 95;
      reasons.push('Workspace running smoothly with active collaboration');
    }

    return {
      status,
      score,
      reasons,
    };
  },

  // --- INVOICES ---
  getInvoices: (clientId?: string): Invoice[] =>
    clientId ? invoices.filter((i) => i.clientId === clientId) : invoices,
  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>): Invoice => {
    const newInv: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now().toString().slice(-4)}`,
      invoiceNumber: `INV-2026-${(invoices.length + 1).toString().padStart(3, '0')}`,
    };
    invoices = [newInv, ...invoices];
    saveStore(STORAGE_KEYS.INVOICES, invoices);

    // Update client total billed if paid or added
    const client = clients.find((c) => c.id === invoiceData.clientId);
    if (client && invoiceData.status === 'paid') {
      client.totalBilled += newInv.total;
      saveStore(STORAGE_KEYS.CLIENTS, clients);
    }

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'generated invoice',
      target: `${newInv.invoiceNumber} ($${newInv.total.toLocaleString()})`,
      category: 'invoice',
      metadata: `Client: ${newInv.clientName} | Status: ${newInv.status}`,
    });

    return newInv;
  },
  markInvoicePaid: (id: string): Invoice | undefined => {
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      inv.status = 'paid';
      saveStore(STORAGE_KEYS.INVOICES, invoices);

      const client = clients.find((c) => c.id === inv.clientId);
      if (client) {
        client.totalBilled += inv.total;
        saveStore(STORAGE_KEYS.CLIENTS, clients);
      }

      FlowDeskStore.logActivity({
        user: inv.clientName,
        action: 'paid invoice',
        target: `${inv.invoiceNumber} ($${inv.total.toLocaleString()})`,
        category: 'invoice',
      });
    }
    return inv;
  },
  sendInvoiceReminder: (id: string): boolean => {
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'sent payment reminder',
        target: `${inv.invoiceNumber} to ${inv.clientEmail}`,
        category: 'invoice',
      });
      return true;
    }
    return false;
  },



  // --- WORKSPACE SUMMARY ---
  getWorkspaceSummary: (clientId: string): WorkspaceSummary | null => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;

    const clientProjects = projects.filter((p) => p.clientId === clientId);
    const clientDeliverables = deliverables.filter((d) => d.clientId === clientId && !d.isArchived);
    const clientDocuments = documents.filter((d) => d.clientId === clientId);
    const clientInvoices = invoices.filter((i) => i.clientId === clientId);
    const clientComments = comments.filter((c) => c.clientId === clientId);
    const clientActivities = activities.filter(
      (a) => a.target.includes(client.company) || a.target.includes(client.name)
    );
    const portalConfig = FlowDeskStore.getPortalConfig(clientId);
    const healthDetails = FlowDeskStore.getWorkspaceHealthDetails(clientId);

    return {
      clientId,
      client,
      projects: clientProjects,
      deliverables: clientDeliverables,
      documents: clientDocuments,
      invoices: clientInvoices,
      comments: clientComments,
      activities: clientActivities,
      portalConfig,
      healthScore: healthDetails.score,
    };
  },

  // --- ACTIVITY ENGINE ---
  getActivities: (): ActivityLog[] => activities,
  logActivity: (log: Omit<ActivityLog, 'id' | 'timestamp'>): ActivityLog => {
    const newLog: ActivityLog = {
      ...log,
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: 'Just now',
    };
    activities = [newLog, ...activities];
    saveStore(STORAGE_KEYS.ACTIVITIES, activities);
    return newLog;
  },

  // --- SEARCH ENGINE ---
  search: (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return { clients: [], projects: [], documents: [], invoices: [] };

    const matchedClients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
    const matchedProjects = projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
    const matchedDocs = documents.filter((d) => d.title.toLowerCase().includes(q));
    const matchedInvoices = invoices.filter(
      (i) => i.invoiceNumber.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)
    );

    return {
      clients: matchedClients,
      projects: matchedProjects,
      documents: matchedDocs,
      invoices: matchedInvoices,
    };
  },

  getRecentSearches: (): string[] => recentSearches,
  addRecentSearch: (query: string) => {
    if (!query || recentSearches.includes(query)) return;
    recentSearches = [query, ...recentSearches.slice(0, 4)];
    saveStore(STORAGE_KEYS.RECENT_SEARCHES, recentSearches);
  },

  // --- DASHBOARD METRICS ---
  getDashboardMetrics: (): DashboardMetrics => {
    const totalRev = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0);

    const pendingInvoices = invoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0);

    const activeClients = clients.filter((c) => c.status === 'active' && !c.isArchived).length;
    const activeProjects = projects.filter((p) => p.status === 'in_progress' || p.status === 'review').length;
    const completedProjects = projects.filter((p) => p.status === 'completed').length;
    const upcomingDeliverables = deliverables.filter((d) => d.status !== 'approved').length;

    return {
      totalRevenue: totalRev + 85000,
      monthlyRevenue: 24750,
      activeClientsCount: activeClients,
      pendingInvoicesAmount: pendingInvoices,
      completedProjectsCount: completedProjects,
      upcomingDeliverablesCount: upcomingDeliverables,
      activeProjectsCount: activeProjects,
      revenueHistory: mockDashboardMetrics.revenueHistory,
    };
  },
};
