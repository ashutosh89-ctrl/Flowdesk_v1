import { isDemoModeActive } from '@/backend/utilities/supabase';
import { FlowDeskStore } from '@/backend/store/storage-store';
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
} from '@/backend/store/mockData';
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
} from '@/shared/types';

/**
 * Demo data provider that returns mock data when Supabase is not configured.
 * All production services should check isDemoMode before querying Supabase,
 * and fall back to this provider for demo/preview functionality.
 */
export const DemoDataProvider = {
  isDemo: isDemoModeActive,

  getClients: (): Client[] => {
    try {
      const list = FlowDeskStore.getClients();
      return list && list.length > 0 ? list : mockClients;
    } catch {
      return mockClients;
    }
  },

  getClientById: (id: string): Client | undefined => {
    try {
      return FlowDeskStore.getClientById(id) || mockClients.find((c) => c.id === id);
    } catch {
      return mockClients.find((c) => c.id === id);
    }
  },

  getProjects: (): Project[] => {
    try {
      const list = FlowDeskStore.getProjects();
      return list && list.length > 0 ? list : mockProjects;
    } catch {
      return mockProjects;
    }
  },

  getProjectsByClientId: (clientId: string): Project[] => {
    try {
      const list = FlowDeskStore.getProjectsByClientId(clientId);
      return list && list.length > 0 ? list : mockProjects.filter((p) => p.clientId === clientId);
    } catch {
      return mockProjects.filter((p) => p.clientId === clientId);
    }
  },

  getProjectById: (id: string): Project | undefined => {
    try {
      return FlowDeskStore.getProjectById(id) || mockProjects.find((p) => p.id === id);
    } catch {
      return mockProjects.find((p) => p.id === id);
    }
  },

  getDeliverables: (clientId?: string, includeArchived?: boolean): Deliverable[] => {
    try {
      const list = FlowDeskStore.getDeliverables(clientId, includeArchived);
      if (list && list.length > 0) return list;
      let filtered = mockDeliverables;
      if (clientId) filtered = filtered.filter((d) => d.clientId === clientId);
      if (!includeArchived) filtered = filtered.filter((d) => !d.isArchived);
      return filtered;
    } catch {
      let filtered = mockDeliverables;
      if (clientId) filtered = filtered.filter((d) => d.clientId === clientId);
      if (!includeArchived) filtered = filtered.filter((d) => !d.isArchived);
      return filtered;
    }
  },

  getDeliverableById: (id: string): Deliverable | undefined => {
    try {
      return FlowDeskStore.getDeliverableById(id) || mockDeliverables.find((d) => d.id === id);
    } catch {
      return mockDeliverables.find((d) => d.id === id);
    }
  },

  getDocuments: (clientId?: string): DocumentItem[] => {
    try {
      const list = FlowDeskStore.getDocuments(clientId);
      if (list && list.length > 0) return list;
      if (clientId) return mockDocuments.filter((d) => d.clientId === clientId);
      return mockDocuments;
    } catch {
      if (clientId) return mockDocuments.filter((d) => d.clientId === clientId);
      return mockDocuments;
    }
  },

  getInvoices: (clientId?: string): Invoice[] => {
    try {
      const list = FlowDeskStore.getInvoices(clientId);
      if (list && list.length > 0) return list;
      if (clientId) return mockInvoices.filter((i) => i.clientId === clientId);
      return mockInvoices;
    } catch {
      if (clientId) return mockInvoices.filter((i) => i.clientId === clientId);
      return mockInvoices;
    }
  },

  getInvoiceById: (id: string): Invoice | undefined => {
    try {
      return FlowDeskStore.getInvoiceById(id) || mockInvoices.find((i) => i.id === id);
    } catch {
      return mockInvoices.find((i) => i.id === id);
    }
  },

  getActivities: (): ActivityLog[] => {
    try {
      const list = FlowDeskStore.getActivities();
      return list && list.length > 0 ? list : mockActivities;
    } catch {
      return mockActivities;
    }
  },

  getNotifications: (): NotificationItem[] => {
    try {
      const list = FlowDeskStore.getNotifications();
      return list && list.length > 0 ? list : mockNotifications;
    } catch {
      return mockNotifications;
    }
  },

  getDashboardMetrics: (): DashboardMetrics => {
    try {
      return FlowDeskStore.getDashboardMetrics() || mockDashboardMetrics;
    } catch {
      return mockDashboardMetrics;
    }
  },

  getUserProfile: (): UserProfile => {
    try {
      return FlowDeskStore.getUserProfile() || mockUserProfile;
    } catch {
      return mockUserProfile;
    }
  },
};
