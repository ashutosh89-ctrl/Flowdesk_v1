import crypto from 'crypto';
import {
  Client,
  Project,
  Deliverable,
  DeliverableVersion,
  DeliverableFile,
  DeliverableComment,
  DeliverableRevision,
  DeliverableTimelineItem,
  DeliverableApproval,
  DocumentItem,
  Invoice,
  InvoiceItem,
  InvoiceReceipt,
  InvoiceTimelineItem,
  InvoiceActivity,
  InvoiceHistory,
  FinancialDashboardMetrics,
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
  ClientInvitation,
  PublicInvitationDetails,
  ClaimInvitationResult,
} from '@/shared/types';
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
} from './mockData';

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
  PINNED_ITEMS: 'flowdesk_pinned_items',
  RECENT_ITEMS: 'flowdesk_recent_items',
  WIDGET_CONFIG: 'flowdesk_widget_config',
  CLIENT_INVITATIONS: 'flowdesk_client_invitations',
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
let projects: Project[] = loadStore(STORAGE_KEYS.PROJECTS, mockProjects.map((p: any) => ({
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
let clientInvitations: Record<string, ClientInvitation> = loadStore(STORAGE_KEYS.CLIENT_INVITATIONS, {});
let recentSearches: string[] = loadStore(STORAGE_KEYS.RECENT_SEARCHES, ['Apex Digital', 'Design System', 'INV-2026-001']);
let userProfile: UserProfile = loadStore(STORAGE_KEYS.USER_PROFILE, mockUserProfile);
let notifications: NotificationItem[] = loadStore(STORAGE_KEYS.NOTIFICATIONS, mockNotifications);

// Initial Mock Pinned Items
const initialPinnedItems = [
  {
    id: 'pin-1',
    resourceId: 'cli-1',
    resourceType: 'client' as const,
    title: 'Apex Digital Workspace',
    subtitle: 'Enterprise Client • Health Score 98/100',
    path: 'clients',
    pinnedAt: '2026-08-01',
  },
  {
    id: 'pin-2',
    resourceId: 'proj-1',
    resourceType: 'project' as const,
    title: 'Enterprise Design System v2.0',
    subtitle: 'Apex Digital • Budget $24,500',
    path: 'projects',
    pinnedAt: '2026-08-02',
  },
  {
    id: 'pin-3',
    resourceId: 'inv-2026-002',
    resourceType: 'invoice' as const,
    title: 'Invoice #INV-2026-002',
    subtitle: 'Monolith Ventures • $8,500 Pending',
    path: 'invoices',
    pinnedAt: '2026-08-03',
  },
  {
    id: 'pin-4',
    resourceId: 'del-1',
    resourceType: 'deliverable' as const,
    title: 'Figma Token Spec Package v1.4.0',
    subtitle: 'Approved Deliverable • 4 files',
    path: 'deliverables',
    pinnedAt: '2026-08-04',
  },
];

// Initial Mock Recent Work Items
const initialRecentItems = [
  {
    id: 'rec-1',
    resourceId: 'proj-1',
    title: 'Enterprise Design System v2.0',
    type: 'project' as const,
    subtitle: 'Apex Digital • Milestones 50% Complete',
    path: 'projects',
    timestamp: '10 minutes ago',
    clientId: 'cli-1',
  },
  {
    id: 'rec-2',
    resourceId: 'cli-2',
    title: 'Monolith Ventures Workspace',
    type: 'client' as const,
    subtitle: 'Marcus Sterling • Pending Invoice #002',
    path: 'clients',
    timestamp: '1 hour ago',
    clientId: 'cli-2',
  },
  {
    id: 'rec-3',
    resourceId: 'doc-1',
    title: 'Brand Assets & Master Guidelines',
    type: 'document' as const,
    subtitle: 'Verified Document • 14.2 MB PDF',
    path: 'documents',
    timestamp: '3 hours ago',
    clientId: 'cli-1',
  },
  {
    id: 'rec-4',
    resourceId: 'del-2',
    title: 'Voice Visualizer Waveform Demo',
    type: 'deliverable' as const,
    subtitle: 'Hyperion AI • Revision Requested',
    path: 'deliverables',
    timestamp: 'Yesterday',
    clientId: 'cli-3',
  },
];

// Initial Mock Widget Config
const initialWidgets = [
  { id: 'w-today', type: 'today_focus' as const, title: "Today's Focus & Action Items", enabled: true, order: 1, category: 'core' as const, size: 'full' as const },
  { id: 'w-snapshot', type: 'business_snapshot' as const, title: 'Business Intelligence Snapshot', enabled: true, order: 2, category: 'core' as const, size: 'large' as const },
  { id: 'w-health', type: 'workspace_health' as const, title: 'Workspace Health Index', enabled: true, order: 3, category: 'core' as const, size: 'medium' as const },
  { id: 'w-project-health', type: 'project_health' as const, title: 'Project Health & Risk Radar', enabled: true, order: 4, category: 'projects' as const, size: 'large' as const },
  { id: 'w-revenue', type: 'revenue' as const, title: 'Revenue & Cashflow Trajectory', enabled: true, order: 5, category: 'finance' as const, size: 'large' as const },
  { id: 'w-pinned', type: 'pinned' as const, title: 'Pinned Items & Bookmarks', enabled: true, order: 6, category: 'productivity' as const, size: 'medium' as const },
  { id: 'w-recent', type: 'recent_work' as const, title: 'Recent Work & Quick Resume', enabled: true, order: 7, category: 'productivity' as const, size: 'medium' as const },
  { id: 'w-activity', type: 'activity' as const, title: 'Global Activity & Audit Stream', enabled: true, order: 8, category: 'activity' as const, size: 'medium' as const },
];

let pinnedItems = loadStore(STORAGE_KEYS.PINNED_ITEMS, initialPinnedItems);
let recentItems = loadStore(STORAGE_KEYS.RECENT_ITEMS, initialRecentItems);
let widgetConfig = loadStore(STORAGE_KEYS.WIDGET_CONFIG, initialWidgets);

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
      id: (clientData as any).id || `cli-${Date.now().toString().slice(-4)}`,
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
  toggleNotificationRead: (id: string): NotificationItem[] => {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    saveStore(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return notifications;
  },
  dismissNotification: (id: string): boolean => {
    notifications = notifications.filter((n) => n.id !== id);
    saveStore(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return true;
  },

  // --- DELIVERABLES MODULE ---
  getDeliverables: (clientId?: string, includeArchived = false): Deliverable[] =>
    deliverables.filter((d) => {
      if (clientId && d.clientId !== clientId) return false;
      if (!includeArchived && d.isArchived) return false;
      return true;
    }),

  getDeliverableById: (id: string): Deliverable | undefined =>
    deliverables.find((d) => d.id === id),

  addDeliverable: (delData: Omit<Deliverable, 'id'>): Deliverable => {
    const newId = `del-${Date.now().toString().slice(-4)}`;
    const today = new Date().toISOString().split('T')[0];
    const newDel: Deliverable = {
      ...delData,
      id: newId,
      status: delData.status || 'draft',
      approvalStatus: delData.approvalStatus || 'pending',
      priority: delData.priority || 'medium',
      version: delData.version || 'v1.0.0',
      createdAt: today,
      updatedAt: today,
      filesCount: delData.files ? delData.files.length : delData.fileUrl ? 1 : 0,
      commentsCount: 0,
      files: delData.files || (delData.fileUrl ? [
        {
          id: `file-${Date.now()}-1`,
          deliverableId: newId,
          fileName: delData.fileName || `${delData.title.toLowerCase().replace(/\s+/g, '-')}-v1.pdf`,
          fileSize: delData.fileSize || '2.4 MB',
          fileType: 'pdf',
          fileUrl: delData.fileUrl,
          uploadedAt: today,
          uploadedBy: 'Alex Rivera',
          isPinned: true,
        }
      ] : []),
      versionHistory: delData.versionHistory || [
        {
          id: `ver-${Date.now()}`,
          deliverableId: newId,
          version: delData.version || 'v1.0.0',
          versionNumber: delData.version || 'v1.0.0',
          date: today,
          note: delData.description || 'Initial deliverable package created',
          fileUrl: delData.fileUrl || '#',
          fileName: delData.fileName || `${delData.title.toLowerCase().replace(/\s+/g, '-')}-v1.pdf`,
          fileSize: delData.fileSize || '2.4 MB',
          uploadedBy: 'Alex Rivera',
          approvalStatus: delData.approvalStatus || 'pending',
          status: 'draft',
          isCurrentVersion: true,
        },
      ],
      comments: delData.comments || [],
      revisions: delData.revisions || [],
      approvals: delData.approvals || [],
      activityLog: [
        {
          id: `act-${Date.now()}-1`,
          deliverableId: newId,
          timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          user: 'Alex Rivera',
          action: 'Created Deliverable Package',
          details: `Title: ${delData.title} | Version: ${delData.version || 'v1.0.0'}`,
        },
      ],
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          deliverableId: newId,
          type: 'created',
          title: 'Deliverable Created',
          timestamp: today,
          actor: 'Alex Rivera',
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
      message: `Deliverable "${newDel.title}" (${newDel.version}) was created.`,
      type: 'info',
      clientId: newDel.clientId,
      category: 'deliverable',
    });

    return newDel;
  },

  updateDeliverable: (id: string, updates: Partial<Deliverable>): Deliverable | undefined => {
    const idx = deliverables.findIndex((d) => d.id === id);
    if (idx !== -1) {
      const today = new Date().toISOString().split('T')[0];
      deliverables[idx] = {
        ...deliverables[idx],
        ...updates,
        updatedAt: today,
      };
      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: 'updated deliverable',
        target: deliverables[idx].title,
        category: 'deliverable',
      });

      return deliverables[idx];
    }
    return undefined;
  },

  duplicateDeliverable: (id: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      const today = new Date().toISOString().split('T')[0];
      const newDel: Deliverable = {
        ...del,
        id: `del-${Date.now().toString().slice(-4)}`,
        title: `${del.title} (Copy)`,
        status: 'draft',
        approvalStatus: 'pending',
        createdAt: today,
        updatedAt: today,
        version: 'v1.0.0',
        revisions: [],
        approvals: [],
        activityLog: [
          {
            id: `act-${Date.now()}`,
            deliverableId: `del-${Date.now().toString().slice(-4)}`,
            timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            user: 'Alex Rivera',
            action: 'Duplicated Deliverable',
            details: `Cloned from ${del.title}`,
          },
        ],
        timeline: [
          {
            id: `tl-${Date.now()}`,
            deliverableId: `del-${Date.now().toString().slice(-4)}`,
            type: 'created',
            title: 'Deliverable Duplicated',
            timestamp: today,
            actor: 'Alex Rivera',
          },
        ],
      };
      deliverables = [newDel, ...deliverables];
      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      return newDel;
    }
    return undefined;
  },

  archiveDeliverable: (id: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      del.isArchived = !del.isArchived;
      del.status = del.isArchived ? 'archived' : 'draft';
      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

      FlowDeskStore.logActivity({
        user: 'Alex Rivera',
        action: del.isArchived ? 'archived deliverable' : 'restored deliverable',
        target: del.title,
        category: 'deliverable',
      });
    }
    return del;
  },

  deleteDeliverable: (id: string): boolean => {
    deliverables = deliverables.filter((d) => d.id !== id);
    saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    return true;
  },

  replaceDeliverableVersion: (
    id: string,
    versionData: { version: string; note: string; fileUrl?: string; fileName?: string; fileSize?: string; uploadedBy?: string }
  ): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      const oldVerStr = del.version;
      const today = new Date().toISOString().split('T')[0];
      const newVersionItem: DeliverableVersion = {
        id: `ver-${Date.now()}`,
        deliverableId: id,
        version: versionData.version,
        versionNumber: versionData.version,
        date: today,
        note: versionData.note,
        fileUrl: versionData.fileUrl || '#',
        fileName: versionData.fileName || `${del.title.toLowerCase().replace(/\s+/g, '-')}-${versionData.version}.zip`,
        fileSize: versionData.fileSize || '3.5 MB',
        uploadedBy: versionData.uploadedBy || 'Alex Rivera',
        approvalStatus: 'pending',
        status: 'in_review',
        isCurrentVersion: true,
      };

      if (!del.versionHistory) del.versionHistory = [];
      del.versionHistory = del.versionHistory.map(v => ({ ...v, isCurrentVersion: false }));
      del.versionHistory = [newVersionItem, ...del.versionHistory];
      del.version = versionData.version;
      del.status = 'ready_for_review';
      del.approvalStatus = 'pending';
      del.fileUrl = newVersionItem.fileUrl;
      del.fileName = newVersionItem.fileName;
      del.fileSize = newVersionItem.fileSize;
      del.revisionNote = undefined;
      del.updatedAt = today;

      // Add to timeline & activity
      if (!del.timeline) del.timeline = [];
      del.timeline.push({
        id: `tl-${Date.now()}`,
        deliverableId: id,
        type: 'version_created',
        title: `Version ${versionData.version} Created`,
        timestamp: today,
        actor: versionData.uploadedBy || 'Alex Rivera',
        metadata: versionData.note,
      });

      if (!del.activityLog) del.activityLog = [];
      del.activityLog.unshift({
        id: `act-${Date.now()}`,
        deliverableId: id,
        timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        user: versionData.uploadedBy || 'Alex Rivera',
        action: 'Uploaded New Version',
        details: `${oldVerStr} → ${versionData.version}`,
      });

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

  restoreDeliverableVersion: (id: string, versionId: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del && del.versionHistory) {
      const vItem = del.versionHistory.find((v) => v.id === versionId || v.version === versionId);
      if (vItem) {
        const today = new Date().toISOString().split('T')[0];
        del.versionHistory.forEach((v) => (v.isCurrentVersion = v.id === vItem.id));
        del.version = vItem.version;
        del.fileUrl = vItem.fileUrl || del.fileUrl;
        del.fileName = vItem.fileName || del.fileName;
        del.fileSize = vItem.fileSize || del.fileSize;
        del.updatedAt = today;

        if (!del.activityLog) del.activityLog = [];
        del.activityLog.unshift({
          id: `act-${Date.now()}`,
          deliverableId: id,
          timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          user: 'Alex Rivera',
          action: 'Restored Version',
          details: `Reverted to version ${vItem.version}`,
        });

        saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      }
    }
    return del;
  },

  addDeliverableFile: (
    id: string,
    fileData: { fileName: string; fileSize: string; fileType: string; fileUrl?: string; folder?: string }
  ): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      const today = new Date().toISOString().split('T')[0];
      const newFile: DeliverableFile = {
        id: `file-${Date.now()}`,
        deliverableId: id,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        fileUrl: fileData.fileUrl || '#',
        uploadedAt: today,
        uploadedBy: 'Alex Rivera',
        folder: fileData.folder || 'Root',
        isPinned: false,
      };

      if (!del.files) del.files = [];
      del.files.push(newFile);
      del.filesCount = del.files.length;
      del.updatedAt = today;

      if (!del.activityLog) del.activityLog = [];
      del.activityLog.unshift({
        id: `act-${Date.now()}`,
        deliverableId: id,
        timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        user: 'Alex Rivera',
        action: 'Uploaded File',
        details: fileData.fileName,
      });

      if (!del.timeline) del.timeline = [];
      del.timeline.push({
        id: `tl-${Date.now()}`,
        deliverableId: id,
        type: 'files_uploaded',
        title: `File Uploaded: ${fileData.fileName}`,
        timestamp: today,
        actor: 'Alex Rivera',
      });

      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    }
    return del;
  },

  renameDeliverableFile: (id: string, fileId: string, newName: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del && del.files) {
      const f = del.files.find((file) => file.id === fileId);
      if (f) {
        const oldName = f.fileName;
        f.fileName = newName;
        const today = new Date().toISOString().split('T')[0];
        del.updatedAt = today;

        if (!del.activityLog) del.activityLog = [];
        del.activityLog.unshift({
          id: `act-${Date.now()}`,
          deliverableId: id,
          timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          user: 'Alex Rivera',
          action: 'Renamed File',
          details: `${oldName} → ${newName}`,
        });

        saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      }
    }
    return del;
  },

  deleteDeliverableFile: (id: string, fileId: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del && del.files) {
      const targetFile = del.files.find(f => f.id === fileId);
      del.files = del.files.filter((f) => f.id !== fileId);
      del.filesCount = del.files.length;
      const today = new Date().toISOString().split('T')[0];
      del.updatedAt = today;

      if (!del.activityLog) del.activityLog = [];
      del.activityLog.unshift({
        id: `act-${Date.now()}`,
        deliverableId: id,
        timestamp: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        user: 'Alex Rivera',
        action: 'Deleted File',
        details: targetFile ? targetFile.fileName : fileId,
      });

      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    }
    return del;
  },

  togglePinDeliverableFile: (id: string, fileId: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del && del.files) {
      const f = del.files.find((file) => file.id === fileId);
      if (f) {
        f.isPinned = !f.isPinned;
        saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      }
    }
    return del;
  },

  addDeliverableComment: (
    id: string,
    commentData: {
      author: string;
      authorRole: 'freelancer' | 'client' | 'team';
      isInternal: boolean;
      content: string;
      attachments?: string[];
      replyToId?: string;
    }
  ): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      const today = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newComment: DeliverableComment = {
        id: `comm-${Date.now()}`,
        deliverableId: id,
        author: commentData.author,
        authorRole: commentData.authorRole,
        isInternal: commentData.isInternal,
        timestamp: `${today} ${timeStr}`,
        content: commentData.content,
        attachments: commentData.attachments || [],
        isResolved: false,
      };

      if (!del.comments) del.comments = [];

      if (commentData.replyToId) {
        const parent = del.comments.find((c) => c.id === commentData.replyToId);
        if (parent) {
          if (!parent.replies) parent.replies = [];
          parent.replies.push(newComment);
        } else {
          del.comments.push(newComment);
        }
      } else {
        del.comments.push(newComment);
      }

      del.commentsCount = del.comments.length;
      del.updatedAt = today;

      if (!del.timeline) del.timeline = [];
      del.timeline.push({
        id: `tl-${Date.now()}`,
        deliverableId: id,
        type: 'comment_added',
        title: `${commentData.isInternal ? 'Internal' : 'Client'} Comment Added`,
        timestamp: today,
        actor: commentData.author,
        metadata: commentData.content,
      });

      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    }
    return del;
  },

  toggleResolveDeliverableComment: (id: string, commentId: string): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del && del.comments) {
      const c = del.comments.find((comm) => comm.id === commentId);
      if (c) {
        c.isResolved = !c.isResolved;
        saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
      }
    }
    return del;
  },

  submitDeliverableClientReview: (
    id: string,
    reviewData: { action: 'approve' | 'reject' | 'revision' | 'viewed'; notes?: string; reviewerName: string }
  ): Deliverable | undefined => {
    const del = deliverables.find((d) => d.id === id);
    if (del) {
      const today = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (reviewData.action === 'approve') {
        del.status = 'approved';
        del.approvalStatus = 'approved';
      } else if (reviewData.action === 'revision') {
        del.status = 'revision_requested';
        del.approvalStatus = 'revision_requested';
        del.revisionNote = reviewData.notes;

        if (!del.revisions) del.revisions = [];
        del.revisions.unshift({
          id: `rev-${Date.now()}`,
          deliverableId: id,
          revisionNumber: del.revisions.length + 1,
          requestedBy: reviewData.reviewerName,
          reason: reviewData.notes || 'Revision requested by client',
          requestedDate: today,
          status: 'pending',
          linkedVersion: del.version,
        });
      } else if (reviewData.action === 'reject') {
        del.status = 'revision_requested';
        del.approvalStatus = 'rejected';
      } else if (reviewData.action === 'viewed') {
        if (del.approvalStatus === 'pending') {
          del.approvalStatus = 'viewed';
        }
      }

      if (!del.approvals) del.approvals = [];
      del.approvals.unshift({
        id: `app-${Date.now()}`,
        deliverableId: id,
        version: del.version,
        status: del.approvalStatus || 'pending',
        reviewerName: reviewData.reviewerName,
        notes: reviewData.notes,
        timestamp: `${today} ${timeStr}`,
      });

      if (!del.timeline) del.timeline = [];
      del.timeline.push({
        id: `tl-${Date.now()}`,
        deliverableId: id,
        type: reviewData.action === 'approve' ? 'approved' : reviewData.action === 'revision' ? 'revision_requested' : 'viewed',
        title: `Deliverable ${reviewData.action.toUpperCase()} by Client`,
        timestamp: today,
        actor: reviewData.reviewerName,
        metadata: reviewData.notes,
      });

      if (!del.activityLog) del.activityLog = [];
      del.activityLog.unshift({
        id: `act-${Date.now()}`,
        deliverableId: id,
        timestamp: `${today} ${timeStr}`,
        user: `${reviewData.reviewerName} (Client)`,
        action: `Review: ${reviewData.action.toUpperCase()}`,
        details: reviewData.notes || 'No review notes provided',
      });

      del.updatedAt = today;
      saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);

      FlowDeskStore.addNotification({
        title: reviewData.action === 'approve' ? 'Deliverable Approved!' : 'Revision Requested',
        message: `Client ${reviewData.reviewerName} updated approval status for "${del.title}".`,
        type: reviewData.action === 'approve' ? 'success' : 'warning',
        clientId: del.clientId,
        category: 'deliverable',
      });
    }
    return del;
  },

  approveDeliverable: (id: string, note?: string): Deliverable | undefined => {
    return FlowDeskStore.submitDeliverableClientReview(id, {
      action: 'approve',
      notes: note,
      reviewerName: 'Client',
    });
  },

  requestDeliverableRevision: (id: string, revisionComment: string): Deliverable | undefined => {
    return FlowDeskStore.submitDeliverableClientReview(id, {
      action: 'revision',
      notes: revisionComment,
      reviewerName: 'Client',
    });
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

  bulkUpdateDeliverables: (ids: string[], action: 'archive' | 'delete' | 'submit' | 'mark_ready'): boolean => {
    if (action === 'delete') {
      deliverables = deliverables.filter((d) => !ids.includes(d.id));
    } else {
      deliverables.forEach((d) => {
        if (ids.includes(d.id)) {
          if (action === 'archive') {
            d.isArchived = true;
            d.status = 'archived';
          } else if (action === 'submit') {
            d.status = 'submitted';
            d.approvalStatus = 'pending';
          } else if (action === 'mark_ready') {
            d.status = 'ready_for_review';
          }
        }
      });
    }
    saveStore(STORAGE_KEYS.DELIVERABLES, deliverables);
    return true;
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

  uploadDirectDocument: (
    clientId: string,
    data: {
      title: string;
      type?: DocumentItem['type'];
      category?: string;
      description?: string;
      fileName?: string;
      size?: string;
      downloadUrl?: string;
      projectId?: string;
    }
  ): DocumentItem => {
    const docType = (data.type || data.category || 'other') as DocumentItem['type'];
    const newDoc: DocumentItem & { category?: string } = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clientId,
      title: data.title,
      description: data.description || '',
      type: docType,
      category: data.category || docType,
      status: 'uploaded',
      isRequired: false,
      fileName: data.fileName || `${data.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      size: data.size || '2.4 MB',
      downloadUrl: data.downloadUrl || '#',
      uploadedAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    documents = [newDoc as DocumentItem, ...documents];
    saveStore(STORAGE_KEYS.DOCUMENTS, documents);

    FlowDeskStore.logActivity({
      user: 'Client',
      action: 'uploaded document',
      target: newDoc.title,
      category: 'document',
      metadata: `Category: ${newDoc.type} | File: ${newDoc.fileName}`,
    });

    FlowDeskStore.addNotification({
      title: 'Client Uploaded Document',
      message: `Client uploaded document "${newDoc.title}".`,
      type: 'success',
      clientId,
      category: 'document',
    });

    return newDoc;
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

  // --- SECURE ONE-TIME CONNECTION INVITATIONS ---
  createOrGetInvitation: (clientId: string, recipientEmail?: string): { rawToken: string; url: string; invitation: ClientInvitation } => {
    const client = clients.find((c) => c.id === clientId);
    const targetEmail = recipientEmail || client?.email || 'client@example.com';
    const nowIso = new Date().toISOString();

    // Revoke any existing pending invitations for this client
    Object.values(clientInvitations).forEach((inv) => {
      if (inv.clientId === clientId && inv.status === 'pending') {
        inv.status = 'revoked';
        inv.revokedAt = nowIso;
      }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invitation: ClientInvitation = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: 'ws-demo-workspace',
      clientId,
      freelancerId: 'usr-demo-freelancer',
      tokenHash,
      status: 'pending',
      recipientEmail: targetEmail,
      createdAt: nowIso,
      expiresAt,
    };

    clientInvitations[tokenHash] = invitation;
    saveStore(STORAGE_KEYS.CLIENT_INVITATIONS, clientInvitations);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${origin}/connect/${rawToken}`;

    return { rawToken, url, invitation };
  },

  getPublicInvitationDetails: (tokenHash: string): PublicInvitationDetails => {
    const inv = clientInvitations[tokenHash];
    if (!inv) {
      return {
        isValid: false,
        status: 'invalid',
        error: 'This connection link is invalid or does not exist.',
      };
    }

    const now = new Date();
    if (inv.status === 'pending' && new Date(inv.expiresAt) < now) {
      inv.status = 'expired';
      saveStore(STORAGE_KEYS.CLIENT_INVITATIONS, clientInvitations);
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

    const client = clients.find((c) => c.id === inv.clientId);

    return {
      isValid: true,
      status: 'pending',
      freelancerName: 'Apex Digital Labs',
      clientName: client?.name || 'Client',
      companyName: client?.company || '',
      maskedEmail: inv.recipientEmail ? `${inv.recipientEmail.charAt(0)}***@${inv.recipientEmail.split('@')[1] || 'example.com'}` : undefined,
      expiresAt: inv.expiresAt,
    };
  },

  claimInvitation: (tokenHash: string, userId: string, userEmail?: string): ClaimInvitationResult => {
    const inv = clientInvitations[tokenHash];
    if (!inv) {
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        error: 'This connection link is invalid or does not exist.',
      };
    }

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
    if (inv.status === 'expired' || new Date(inv.expiresAt) < now) {
      inv.status = 'expired';
      saveStore(STORAGE_KEYS.CLIENT_INVITATIONS, clientInvitations);
      return {
        success: false,
        errorCode: 'EXPIRED',
        error: 'This connection link has expired.',
      };
    }

    const client = clients.find((c) => c.id === inv.clientId);
    if (!client) {
      return {
        success: false,
        errorCode: 'CLIENT_NOT_FOUND',
        error: 'Associated client record not found.',
      };
    }

    if (client.userId && client.userId !== userId) {
      return {
        success: false,
        errorCode: 'CLIENT_ALREADY_CONNECTED',
        error: 'This client connection has already been completed by another user.',
      };
    }

    // Bind client
    client.userId = userId;
    saveStore(STORAGE_KEYS.CLIENTS, clients);

    // Consume invitation
    inv.status = 'claimed';
    inv.claimedAt = now.toISOString();
    inv.claimedByUserId = userId;

    // Revoke any other pending invitations for this client
    Object.values(clientInvitations).forEach((otherInv) => {
      if (otherInv.clientId === inv.clientId && otherInv.id !== inv.id && otherInv.status === 'pending') {
        otherInv.status = 'revoked';
        otherInv.revokedAt = now.toISOString();
      }
    });
    saveStore(STORAGE_KEYS.CLIENT_INVITATIONS, clientInvitations);

    // Log Activity & Notification
    FlowDeskStore.logActivity({
      user: userEmail || client.name,
      action: 'connected client portal account',
      target: client.company,
      category: 'portal',
    });

    FlowDeskStore.addNotification({
      title: 'Client Connected',
      message: `${client.name} (${client.company}) connected their portal account.`,
      type: 'success',
      clientId: client.id,
      category: 'portal',
    });

    return {
      success: true,
      clientId: client.id,
      workspaceId: inv.workspaceId,
      clientName: client.name,
      company: client.company,
      message: 'Client account successfully connected.',
    };
  },

  revokeInvitation: (clientId: string): { success: boolean; error?: string } => {
    const nowIso = new Date().toISOString();
    Object.values(clientInvitations).forEach((inv) => {
      if (inv.clientId === clientId && inv.status === 'pending') {
        inv.status = 'revoked';
        inv.revokedAt = nowIso;
      }
    });
    saveStore(STORAGE_KEYS.CLIENT_INVITATIONS, clientInvitations);
    return { success: true };
  },

  getClientPortalDashboardData: (clientId: string): ClientPortalDashboardData | null => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;

    const clientProjects = projects.filter((p) => p.clientId === clientId);
    const clientDeliverables = deliverables.filter((d) => d.clientId === clientId && !d.isArchived);
    const clientDocuments = documents.filter((d) => d.clientId === clientId);
    const clientInvoices = invoices.filter((i) => i.clientId === clientId);

    const pendingDocs = clientDocuments.filter((d) => d.status === 'pending' || d.status === 'rejected');
    const pendingDelivs = clientDeliverables.filter((d) => d.status === 'ready_for_review' || d.status === 'submitted' || d.status === 'draft');
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
    const revisionReq = clientDeliverables.filter((d) => d.status === 'revision_requested');
    if (revisionReq.length > 0) {
      hasWaitingOnFreelancer = true;
      reasons.push(`Freelancer needs to address revisions on ${revisionReq.length} deliverable(s)`);
    }

    const inReviewDelivs = clientDeliverables.filter((d) => d.status === 'ready_for_review' || d.status === 'submitted');
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

  getInvoiceById: (id: string): Invoice | undefined =>
    invoices.find((i) => i.id === id || i.invoiceNumber === id),

  createInvoice: (invoiceData: Partial<Invoice> & { clientId: string; items: InvoiceItem[] }): Invoice => {
    const client = clients.find((c) => c.id === invoiceData.clientId);
    const proj = projects.find((p) => p.id === invoiceData.projectId);

    const subtotal = invoiceData.subtotal ?? invoiceData.items.reduce((s, it) => s + (it.amount || it.quantity * it.rate), 0);
    const tax = invoiceData.tax ?? 0;
    const discount = invoiceData.discount ?? 0;
    const total = invoiceData.total ?? Math.max(0, subtotal + tax - discount);

    const invCount = invoices.length + 1;
    const defaultNumber = `FD-2026-${invCount.toString().padStart(4, '0')}`;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newInv: Invoice = {
      id: invoiceData.id || `inv-${Date.now().toString().slice(-6)}`,
      invoiceNumber: invoiceData.invoiceNumber || defaultNumber,
      clientId: invoiceData.clientId,
      clientName: invoiceData.clientName || (client ? client.company : 'Client Workspace'),
      clientEmail: invoiceData.clientEmail || (client ? client.email : 'billing@client.com'),
      projectId: invoiceData.projectId,
      projectName: invoiceData.projectName || (proj ? proj.title : undefined),
      issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      workflowStatus: invoiceData.workflowStatus || 'draft',
      paymentStatus: invoiceData.paymentStatus || 'pending',
      status: invoiceData.paymentStatus === 'paid' ? 'paid' : invoiceData.workflowStatus === 'draft' ? 'draft' : 'pending',
      items: invoiceData.items,
      subtotal,
      discount,
      taxName: invoiceData.taxName || 'GST',
      taxPercentage: invoiceData.taxPercentage || 0,
      tax,
      total,
      currency: invoiceData.currency || (client ? client.currency : 'USD'),
      notes: invoiceData.notes || 'Thank you for your business.',
      paymentInstructions: invoiceData.paymentInstructions || 'Direct Bank Wire or Secure Razorpay Link.',
      internalNotes: invoiceData.internalNotes || '',
      reminders: invoiceData.reminders || [],
      receipts: invoiceData.receipts || [],
      timeline: [
        {
          id: `tl-${Date.now()}`,
          invoiceId: '',
          type: 'created',
          title: `Invoice ${invoiceData.invoiceNumber || defaultNumber} Created`,
          timestamp: now,
          actor: 'Alex Rivera',
        },
      ],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          invoiceId: '',
          timestamp: now,
          user: 'Alex Rivera',
          action: 'Created Invoice',
          details: `Drafted invoice for ${client ? client.company : 'Client'} total $${total}`,
        },
      ],
      history: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    newInv.timeline![0].invoiceId = newInv.id;
    newInv.activityLog![0].invoiceId = newInv.id;

    invoices = [newInv, ...invoices];
    saveStore(STORAGE_KEYS.INVOICES, invoices);

    // Auto-register professional invoice document in Documents repository
    const invoiceDoc: DocumentItem = {
      id: `doc-${Date.now()}-${newInv.id.slice(-4)}`,
      clientId: newInv.clientId,
      title: `Invoice #${newInv.invoiceNumber} — ${newInv.clientName}`,
      description: `Official billing statement for ${newInv.clientName}. Total: ${newInv.currency} ${newInv.total.toLocaleString()}`,
      type: 'invoice',
      status: 'verified',
      isPinned: false,
      isInternal: false,
      fileName: `Invoice_${newInv.invoiceNumber}.pdf`,
      size: '245 KB',
      downloadUrl: '',
      updatedAt: new Date().toISOString().split('T')[0],
      uploadedAt: new Date().toISOString().split('T')[0],
      verifiedAt: new Date().toISOString().split('T')[0],
    };
    documents = [invoiceDoc, ...documents];
    saveStore(STORAGE_KEYS.DOCUMENTS, documents);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'created invoice',
      target: `${newInv.invoiceNumber} (${newInv.currency} ${newInv.total.toLocaleString()})`,
      category: 'invoice',
      metadata: `Client: ${newInv.clientName}`,
    });

    return newInv;
  },

  updateInvoice: (id: string, updates: Partial<Invoice>): Invoice | undefined => {
    const idx = invoices.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;

    const oldInv = invoices[idx];
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const historyEntries: InvoiceHistory[] = [...(oldInv.history || [])];
    const activityEntries: InvoiceActivity[] = [...(oldInv.activityLog || [])];

    // Detect changed fields for lightweight audit log
    if (updates.total !== undefined && updates.total !== oldInv.total) {
      historyEntries.push({
        id: `hist-${Date.now()}-1`,
        invoiceId: id,
        fieldChanged: 'total',
        oldValue: `${oldInv.currency} ${oldInv.total}`,
        newValue: `${oldInv.currency} ${updates.total}`,
        time: now,
        user: 'Alex Rivera',
      });
      activityEntries.push({
        id: `act-${Date.now()}-1`,
        invoiceId: id,
        timestamp: now,
        user: 'Alex Rivera',
        action: 'Edited Invoice Amount',
        fieldChanged: 'total',
        oldValue: String(oldInv.total),
        newValue: String(updates.total),
        details: `Updated total from $${oldInv.total} to $${updates.total}`,
      });
    }

    if (updates.dueDate && updates.dueDate !== oldInv.dueDate) {
      historyEntries.push({
        id: `hist-${Date.now()}-2`,
        invoiceId: id,
        fieldChanged: 'dueDate',
        oldValue: oldInv.dueDate,
        newValue: updates.dueDate,
        time: now,
        user: 'Alex Rivera',
      });
    }

    const updatedInv: Invoice = {
      ...oldInv,
      ...updates,
      history: historyEntries,
      activityLog: activityEntries,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (updates.paymentStatus) {
      updatedInv.status = updates.paymentStatus === 'paid' ? 'paid' : updatedInv.workflowStatus === 'draft' ? 'draft' : 'pending';
    }

    invoices[idx] = updatedInv;
    saveStore(STORAGE_KEYS.INVOICES, invoices);
    return updatedInv;
  },

  deleteInvoice: (id: string): boolean => {
    const target = invoices.find((i) => i.id === id);
    if (!target) return false;
    const invNum = target.invoiceNumber;
    invoices = invoices.filter((i) => i.id !== id);
    saveStore(STORAGE_KEYS.INVOICES, invoices);

    // Clean up corresponding invoice document
    if (invNum) {
      documents = documents.filter((d) => !d.title.includes(invNum) && d.fileName !== `Invoice_${invNum}.pdf`);
      saveStore(STORAGE_KEYS.DOCUMENTS, documents);
    }
    return true;
  },

  markInvoicePaidOffline: (
    id: string,
    paymentMethod: string = 'bank_transfer',
    notes?: string,
    amount?: number
  ): Invoice | undefined => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return undefined;

    const currentPaid = Number(inv.paidAmount) || 0;
    const remaining = Math.max(0, (Number(inv.total) || 0) - currentPaid);
    const settleAmt = (amount !== undefined && amount > 0 && amount <= remaining) ? amount : remaining;
    const newPaid = currentPaid + settleAmt;
    const newRemaining = Math.max(0, (Number(inv.total) || 0) - newPaid);
    const isFull = newRemaining === 0;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const receiptNum = `RCP-${new Date().getFullYear()}-${( (inv.receipts?.length || 0) + 1 ).toString().padStart(3, '0')}`;

    const newReceipt = {
      id: `rec-${Date.now()}`,
      receiptNumber: receiptNum,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: settleAmt,
      currency: inv.currency,
      paymentMethod,
      paymentDate: new Date().toISOString().split('T')[0],
      razorpayOrderId: `order_mock_${Math.random().toString(36).substring(2, 8)}`,
      razorpayPaymentId: `pay_mock_${Math.random().toString(36).substring(2, 8)}`,
      notes: notes || (isFull ? 'Offline settlement recorded and verified.' : 'Partial offline settlement recorded.'),
    };

    inv.paidAmount = newPaid;
    inv.remainingAmount = newRemaining;
    inv.remainingBalance = newRemaining;
    inv.paymentStatus = isFull ? 'paid' : 'partially_paid';
    inv.workflowStatus = isFull ? 'viewed' : inv.workflowStatus;
    inv.status = isFull ? 'paid' : 'partially_paid';
    inv.receipts = [...(inv.receipts || []), newReceipt];

    inv.timeline = [
      ...(inv.timeline || []),
      {
        id: `tl-${Date.now()}`,
        invoiceId: inv.id,
        type: 'marked_paid_offline',
        title: `Payment Marked Paid (${String(paymentMethod).replace('_', ' ').toUpperCase()})`,
        timestamp: now,
        actor: 'Alex Rivera',
        metadata: `Receipt #${receiptNum} Issued ($${settleAmt.toLocaleString()})`,
      },
      {
        id: `tl-${Date.now() + 1}`,
        invoiceId: inv.id,
        type: 'payment_received',
        title: `Payment Received (${inv.currency} ${settleAmt.toLocaleString()})`,
        timestamp: now,
        actor: 'System',
      },
    ];

    inv.activityLog = [
      ...(inv.activityLog || []),
      {
        id: `act-${Date.now()}`,
        invoiceId: inv.id,
        timestamp: now,
        user: 'Alex Rivera',
        action: 'Recorded Offline Payment',
        details: `Settled ${inv.currency} ${settleAmt.toLocaleString()} via ${paymentMethod}`,
      },
    ];

    inv.history = [
      ...(inv.history || []),
      {
        id: `hist-${Date.now()}`,
        invoiceId: inv.id,
        fieldChanged: 'paymentStatus',
        oldValue: inv.paymentStatus,
        newValue: isFull ? 'paid' : 'partially_paid',
        time: now,
        user: 'Alex Rivera',
      },
    ];

    saveStore(STORAGE_KEYS.INVOICES, invoices);

    // Update client total billed
    const client = clients.find((c) => c.id === inv.clientId);
    if (client) {
      client.totalBilled = (client.totalBilled || 0) + settleAmt;
      if (client.outstandingBalance) {
        client.outstandingBalance = Math.max(0, client.outstandingBalance - settleAmt);
      }
      saveStore(STORAGE_KEYS.CLIENTS, clients);
    }

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'marked invoice paid',
      target: `${inv.invoiceNumber} (${inv.currency} ${settleAmt.toLocaleString()})`,
      category: 'invoice',
    });

    return inv;
  },

  sendInvoiceReminder: (id: string, customNote?: string): { success: boolean; message: string; invoice?: Invoice } => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return { success: false, message: 'Invoice not found' };

    const currentReminders = inv.reminders || [];
    if (currentReminders.length >= 3) {
      return {
        success: false,
        message: 'Maximum limit of 3 manual reminders reached for this invoice.',
        invoice: inv,
      };
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const reminderNum = currentReminders.length + 1;

    const newReminder = {
      id: `rem-${Date.now()}`,
      invoiceId: inv.id,
      reminderNumber: reminderNum,
      date: now,
      method: 'portal' as const,
      status: 'sent' as const,
      notes: customNote || `Reminder #${reminderNum} sent to ${inv.clientEmail}`,
    };

    inv.reminders = [...currentReminders, newReminder];
    inv.workflowStatus = 'sent';

    inv.timeline = [
      ...(inv.timeline || []),
      {
        id: `tl-${Date.now()}`,
        invoiceId: inv.id,
        type: 'reminder_sent',
        title: `Reminder #${reminderNum} Sent to Client`,
        timestamp: now,
        actor: 'Alex Rivera',
      },
    ];

    inv.activityLog = [
      ...(inv.activityLog || []),
      {
        id: `act-${Date.now()}`,
        invoiceId: inv.id,
        timestamp: now,
        user: 'Alex Rivera',
        action: `Sent Reminder #${reminderNum}`,
        details: customNote || `Dispatched reminder notification to ${inv.clientEmail}`,
      },
    ];

    saveStore(STORAGE_KEYS.INVOICES, invoices);

    FlowDeskStore.logActivity({
      user: 'Alex Rivera',
      action: 'sent payment reminder',
      target: `${inv.invoiceNumber} (Reminder #${reminderNum})`,
      category: 'invoice',
    });

    return {
      success: true,
      message: `Reminder #${reminderNum} recorded & dispatched successfully.`,
      invoice: inv,
    };
  },

  recordInvoiceView: (id: string): Invoice | undefined => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return undefined;

    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    if (inv.workflowStatus !== 'viewed' && inv.workflowStatus !== 'cancelled') {
      inv.workflowStatus = 'viewed';
      inv.viewedAt = now;

      inv.timeline = [
        ...(inv.timeline || []),
        {
          id: `tl-${Date.now()}`,
          invoiceId: inv.id,
          type: 'viewed',
          title: 'Invoice Viewed by Client',
          timestamp: now,
          actor: inv.clientName,
        },
      ];

      inv.activityLog = [
        ...(inv.activityLog || []),
        {
          id: `act-${Date.now()}`,
          invoiceId: inv.id,
          timestamp: now,
          user: inv.clientName,
          action: 'Viewed Invoice',
          details: `Client opened invoice link`,
        },
      ];

      saveStore(STORAGE_KEYS.INVOICES, invoices);
    }
    return inv;
  },

  getFinancialMetrics: (): FinancialDashboardMetrics => {
    const paidInvoices = invoices.filter((i) => i.paymentStatus === 'paid');
    const pendingInvoices = invoices.filter((i) => i.paymentStatus === 'pending');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = pendingInvoices.filter((i) => {
      const d = new Date(i.dueDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });

    const lifetimeRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
    const outstandingBalance = pendingInvoices.reduce((sum, i) => sum + i.total, 0);
    const overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.total, 0);
    const pendingPayments = outstandingBalance - overdueAmount;

    // Paid this month
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const paidThisMonth = paidInvoices
      .filter((i) => {
        const date = new Date(i.updatedAt || i.issueDate);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, i) => sum + i.total, 0);

    const totalInvoicesCount = invoices.filter((i) => i.workflowStatus !== 'draft').length || invoices.length || 1;
    const paidCount = paidInvoices.length;
    const averageInvoiceValue = paidCount > 0 ? lifetimeRevenue / paidCount : lifetimeRevenue || 0;
    const paymentCollectionRate = Math.round((paidCount / totalInvoicesCount) * 100) || 0;

    // Aging Report
    let age0_7 = 0;
    let age8_15 = 0;
    let age16_30 = 0;
    let age30Plus = 0;
    let count0_7 = 0;
    let count8_15 = 0;
    let count16_30 = 0;
    let count30Plus = 0;

    pendingInvoices.forEach((i) => {
      const d = new Date(i.dueDate);
      d.setHours(0,0,0,0);
      const diffTime = today.getTime() - d.getTime();
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      if (diffDays <= 7) {
        age0_7 += i.total;
        count0_7++;
      } else if (diffDays <= 15) {
        age8_15 += i.total;
        count8_15++;
      } else if (diffDays <= 30) {
        age16_30 += i.total;
        count16_30++;
      } else {
        age30Plus += i.total;
        count30Plus++;
      }
    });

    const totalAgingAmount = outstandingBalance || 1;

    const agingReport = [
      { range: '0-7 Days' as const, amount: age0_7, count: count0_7, percentage: Math.round((age0_7 / totalAgingAmount) * 100) },
      { range: '8-15 Days' as const, amount: age8_15, count: count8_15, percentage: Math.round((age8_15 / totalAgingAmount) * 100) },
      { range: '16-30 Days' as const, amount: age16_30, count: count16_30, percentage: Math.round((age16_30 / totalAgingAmount) * 100) },
      { range: '30+ Days' as const, amount: age30Plus, count: count30Plus, percentage: Math.round((age30Plus / totalAgingAmount) * 100) },
    ];

    const upcomingDueDates = [...pendingInvoices].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5);
    const recentPayments = [...paidInvoices].slice(0, 5);
    const recentInvoices = [...invoices].slice(0, 5);

    const paymentTrend = [
      { month: 'May', paid: 19800, pending: 4500 },
      { month: 'Jun', paid: 22000, pending: 3200 },
      { month: 'Jul', paid: 32000, pending: 16000 },
      { month: 'Aug', paid: paidThisMonth || 16000, pending: outstandingBalance },
    ];

    return {
      lifetimeRevenue,
      outstandingBalance,
      paidThisMonth,
      pendingPayments,
      overdueAmount,
      averageInvoiceValue,
      paymentCollectionRate,
      recentPayments,
      recentInvoices,
      upcomingDueDates,
      agingReport,
      paymentTrend,
    };
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
      health: healthDetails,
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

  // --- PHASE 11: PINNED ITEMS ---
  getPinnedItems: (): any[] => pinnedItems,
  pinItem: (item: { resourceId: string; resourceType: 'client' | 'project' | 'invoice' | 'document' | 'folder' | 'deliverable'; title: string; subtitle: string; path: string; metadata?: Record<string, any> }) => {
    const exists = pinnedItems.some((p: any) => p.resourceId === item.resourceId);
    if (!exists) {
      const newPin = {
        id: `pin-${Date.now()}`,
        ...item,
        pinnedAt: new Date().toISOString().split('T')[0],
      };
      pinnedItems = [newPin as any, ...pinnedItems];
      saveStore(STORAGE_KEYS.PINNED_ITEMS, pinnedItems);
    }
    return pinnedItems;
  },
  unpinItem: (resourceId: string) => {
    pinnedItems = pinnedItems.filter((p: any) => p.resourceId !== resourceId && p.id !== resourceId);
    saveStore(STORAGE_KEYS.PINNED_ITEMS, pinnedItems);
    return pinnedItems;
  },
  isItemPinned: (resourceId: string): boolean => {
    return pinnedItems.some((p: any) => p.resourceId === resourceId || p.id === resourceId);
  },

  // --- PHASE 11: RECENT WORK ---
  getRecentWork: (): any[] => recentItems,
  trackRecentWork: (item: { resourceId: string; title: string; type: 'project' | 'client' | 'document' | 'deliverable' | 'invoice'; subtitle: string; path: string; clientId?: string; thumbnailUrl?: string }) => {
    recentItems = recentItems.filter((r: any) => r.resourceId !== item.resourceId);
    const newRecent = {
      id: `rec-${Date.now()}`,
      ...item,
      timestamp: 'Just now',
    };
    recentItems = [newRecent as any, ...recentItems.slice(0, 9)];
    saveStore(STORAGE_KEYS.RECENT_ITEMS, recentItems);
    return newRecent;
  },

  // --- PHASE 11: DASHBOARD WIDGET CONFIG ---
  getDashboardWidgets: (): any[] => widgetConfig,
  updateDashboardWidgets: (newWidgets: any[]) => {
    widgetConfig = newWidgets;
    saveStore(STORAGE_KEYS.WIDGET_CONFIG, widgetConfig);
    return widgetConfig;
  },

  // --- PHASE 11: TODAY'S FOCUS LIST ---
  getTodayFocusList: () => {
    const items: any[] = [];

    // Overdue invoices
    invoices
      .filter((i) => i.status === 'overdue')
      .forEach((inv) => {
        items.push({
          id: `focus-inv-${inv.id}`,
          title: `Overdue Invoice #${inv.invoiceNumber}`,
          description: `$${inv.total.toLocaleString()} was due on ${inv.dueDate} for ${inv.clientName}.`,
          category: 'overdue_invoice',
          priority: 'critical',
          dueDate: inv.dueDate,
          clientName: inv.clientName,
          clientId: inv.clientId,
          actionText: 'Send Payment Reminder',
          actionType: 'pay_invoice',
          targetId: inv.id,
          createdAt: inv.dueDate,
        });
      });

    // Deliverables needing review / revision requested
    deliverables.forEach((del) => {
      if (del.status === 'revision_requested' || del.approvalStatus === 'revision_requested') {
        items.push({
          id: `focus-del-rev-${del.id}`,
          title: `Revision Requested: ${del.title}`,
          description: `Client requested revision on ${del.version}. Note: "${del.revisionNote || 'Please update design elements.'}"`,
          category: 'revision_requested',
          priority: 'high',
          dueDate: del.dueDate,
          clientName: del.clientName || 'Client Workspace',
          clientId: del.clientId,
          actionText: 'Review Revision Feedback',
          actionType: 'view_deliverable',
          targetId: del.id,
          createdAt: del.updatedAt,
        });
      } else if (del.status === 'ready_for_review' || del.approvalStatus === 'pending') {
        items.push({
          id: `focus-del-app-${del.id}`,
          title: `Awaiting Client Approval: ${del.title}`,
          description: `Package ${del.version} sent for review. Follow up if unapproved.`,
          category: 'approval_waiting',
          priority: 'medium',
          dueDate: del.dueDate,
          clientName: del.clientName || 'Client Workspace',
          clientId: del.clientId,
          actionText: 'View Deliverable Package',
          actionType: 'view_deliverable',
          targetId: del.id,
          createdAt: del.createdAt,
        });
      }
    });

    // Pending Document Uploads / Requests
    documents
      .filter((d) => d.status === 'pending' && d.isRequired)
      .forEach((doc) => {
        items.push({
          id: `focus-doc-${doc.id}`,
          title: `Missing Required Document: ${doc.title}`,
          description: `Awaiting client upload due ${doc.dueDate}.`,
          category: 'missing_file',
          priority: 'medium',
          dueDate: doc.dueDate,
          clientId: doc.clientId,
          actionText: 'Manage Checklist',
          actionType: 'view_documents',
          targetId: doc.id,
          createdAt: doc.requestedAt,
        });
      });

    // Sort by priority (critical -> high -> medium -> low)
    const priorityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    items.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    return items;
  },

  // --- PHASE 11: WORKSPACE HEALTH ---
  getWorkspaceHealth: () => {
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
    const overdueInvoicesAmount = overdueInvoices.reduce((sum, i) => sum + i.total, 0);
    const lateProjects = projects.filter((p) => p.status === 'in_progress' && p.dueDate < new Date().toISOString().split('T')[0]);
    const pendingApprovals = deliverables.filter((d) => d.status === 'ready_for_review' || d.approvalStatus === 'pending');
    const missingDocs = documents.filter((d) => d.status === 'pending' && d.isRequired);
    const unansweredComments = comments.filter((c) => !c.read && !c.isOwner);

    let score = 100;
    score -= overdueInvoices.length * 12;
    score -= lateProjects.length * 15;
    score -= unansweredComments.length * 5;
    score -= missingDocs.length * 4;
    if (score < 30) score = 30;

    let status: 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical' = 'Excellent';
    if (score >= 90) status = 'Excellent';
    else if (score >= 75) status = 'Healthy';
    else if (score >= 60) status = 'Needs Attention';
    else status = 'Critical';

    const recommendations: any[] = [];
    if (overdueInvoices.length > 0) {
      recommendations.push({
        id: 'rec-inv',
        title: `${overdueInvoices.length} Overdue Invoice(s) Pending Payment`,
        description: `Total outstanding value of $${overdueInvoicesAmount.toLocaleString()}. Follow up with clients.`,
        impact: 'high',
        actionText: 'Send Payment Reminders',
        actionType: 'send_reminder',
        targetType: 'invoice',
      });
    }
    if (pendingApprovals.length > 0) {
      recommendations.push({
        id: 'rec-deliv',
        title: `${pendingApprovals.length} Deliverable Package(s) Awaiting Review`,
        description: 'Send quick client nudge to unblock milestone payments.',
        impact: 'medium',
        actionText: 'Review Packages',
        actionType: 'approve_deliv',
        targetType: 'deliverable',
      });
    }
    if (missingDocs.length > 0) {
      recommendations.push({
        id: 'rec-doc',
        title: `${missingDocs.length} Mandatory Document(s) Missing`,
        description: 'Onboarding files are required before project handover.',
        impact: 'low',
        actionText: 'Check Checklist',
        actionType: 'review_docs',
        targetType: 'document',
      });
    }

    return {
      score,
      status,
      metrics: {
        overdueInvoicesCount: overdueInvoices.length,
        overdueInvoicesAmount,
        lateProjectsCount: lateProjects.length,
        unansweredCommentsCount: unansweredComments.length,
        pendingApprovalsCount: pendingApprovals.length,
        missingDocumentsCount: missingDocs.length,
        clientEngagementScore: 94,
      },
      recommendations,
      updatedAt: 'Just now',
    };
  },

  // --- PHASE 11: BUSINESS METRICS ---
  getBusinessMetrics: () => {
    const activeClientsCount = clients.filter((c) => c.status === 'active' && !c.isArchived).length;
    const activeProjectsCount = projects.filter((p) => p.status === 'in_progress' || p.status === 'review').length;
    const pendingDeliverablesCount = deliverables.filter((d) => d.status !== 'approved').length;
    const pendingDocumentsCount = documents.filter((d) => d.status === 'pending').length;
    const pendingInvoices = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue');
    const pendingInvoicesCount = pendingInvoices.length;
    const pendingInvoicesAmount = pendingInvoices.reduce((sum, i) => sum + i.total, 0);
    const paidTotal = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);

    const completedProj = projects.filter((p) => p.status === 'completed').length;
    const totalProj = projects.length || 1;
    const completionRate = Math.round((completedProj / totalProj) * 100);

    return {
      activeClientsCount,
      activeProjectsCount,
      pendingDeliverablesCount,
      pendingDocumentsCount,
      pendingInvoicesCount,
      pendingInvoicesAmount,
      outstandingRevenue: pendingInvoicesAmount,
      monthlyRevenue: 24750,
      totalRevenue: paidTotal + 85000,
      completionRate,
      workspaceHealthScore: 96,
      revenueGrowthPct: 18.4,
      activeProposalsCount: 3,
      avgProjectCompletionDays: 22,
    };
  },

  // --- PHASE 11: PROJECT HEALTH RADAR ---
  getProjectHealthSummaries: () => {
    return projects.map((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      const projInvoices = invoices.filter((i) => i.projectId === p.id);
      const unpaidInv = projInvoices.some((i) => i.status === 'overdue');
      const projDeliverables = deliverables.filter((d) => d.projectId === p.id);
      const revReq = projDeliverables.filter((d) => d.status === 'revision_requested').length;
      const isOverdue = p.dueDate < new Date().toISOString().split('T')[0] && p.status !== 'completed';

      let status: 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical' = 'Healthy';
      let score = 90;
      const reasons: string[] = [];

      if (unpaidInv) {
        status = 'Needs Attention';
        score -= 20;
        reasons.push('Overdue invoice pending payment');
      }
      if (revReq > 0) {
        if (status === 'Healthy') status = 'Needs Attention';
        score -= 15;
        reasons.push(`${revReq} deliverable revision(s) requested`);
      }
      if (isOverdue) {
        status = 'Critical';
        score -= 30;
        reasons.push('Project deadline has passed');
      }
      if (reasons.length === 0) {
        status = 'Excellent';
        reasons.push('All milestones on schedule');
      }

      return {
        projectId: p.id,
        projectTitle: p.title,
        clientName: p.clientName || client?.company || 'Client',
        clientId: p.clientId,
        status,
        score: Math.max(30, score),
        completionPercentage: p.completionPercentage,
        overdueMilestones: p.milestones?.filter((m) => !m.completed && m.dueDate < new Date().toISOString().split('T')[0]).length || 0,
        pendingDeliverables: projDeliverables.filter((d) => d.status !== 'approved').length,
        revisionRequests: revReq,
        unpaidInvoices: projInvoices.filter((i) => i.status !== 'paid').length,
        reasons,
      };
    });
  },

  // --- PHASE 11: GLOBAL SEARCH INDEX ---
  getSearchIndex: () => {
    return {
      clients: clients.map((c) => ({
        id: c.id,
        title: c.company,
        subtitle: `Contact: ${c.name} (${c.email}) • ${c.status.toUpperCase()}`,
        type: 'client' as const,
        category: 'Clients',
        path: 'clients',
        clientId: c.id,
        badge: c.healthBadge || 'healthy',
      })),
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: `${p.clientName} • Budget $${p.budget.toLocaleString()} • ${p.completionPercentage}% Done`,
        type: 'project' as const,
        category: 'Projects',
        path: 'projects',
        clientId: p.clientId,
        badge: `${p.completionPercentage}%`,
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        title: `Invoice #${i.invoiceNumber}`,
        subtitle: `${i.clientName} • $${i.total.toLocaleString()} • Due ${i.dueDate}`,
        type: 'invoice' as const,
        category: 'Invoices',
        path: 'invoices',
        clientId: i.clientId,
        badge: (i.status || i.paymentStatus || 'pending').toUpperCase(),
      })),
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: `Checklist File • Status: ${d.status.toUpperCase()} • ${d.size}`,
        type: 'document' as const,
        category: 'Documents',
        path: 'documents',
        clientId: d.clientId,
        badge: d.type.toUpperCase(),
      })),
      deliverables: deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: `Deliverable ${d.version} • Status: ${d.status.replace(/_/g, ' ').toUpperCase()}`,
        type: 'deliverable' as const,
        category: 'Deliverables',
        path: 'deliverables',
        clientId: d.clientId,
        badge: d.version,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        title: `Comment by ${c.author}`,
        subtitle: c.text,
        type: 'comment' as const,
        category: 'Activity & Comments',
        path: 'clients',
        clientId: c.clientId,
        timestamp: c.time,
      })),
      activities: activities.map((a) => ({
        id: a.id,
        title: `${a.user} ${a.action}`,
        subtitle: `${a.target} ${a.metadata ? `• ${a.metadata}` : ''}`,
        type: 'activity' as const,
        category: 'Activity Log',
        path: 'activity',
        timestamp: a.timestamp,
      })),
      lastIndexedAt: new Date().toISOString(),
    };
  },
};

