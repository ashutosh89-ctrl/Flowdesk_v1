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
import { isDemoModeActive } from '@/backend/utilities/supabase';

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
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734daeb?auto=format&fit=crop&w=150&q=80',
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

// Helper to safely fetch item from localStorage or load default.
// Demo mode is intentionally resilient to stale/empty localStorage left behind
// by previous sessions: empty collections/objects must not erase the seeded demo.
const loadStore = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item) as T;

    if (isDemoModeActive() && parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed) && parsed.length === 0) return defaultValue;
      if (!Array.isArray(parsed) && Object.keys(parsed as Record<string, unknown>).length === 0) return defaultValue;
    }

    return parsed;
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
      ...