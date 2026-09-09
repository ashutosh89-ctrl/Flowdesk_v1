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
  UserSettings,
} from '@/shared/types';

export const mockUserProfile: UserProfile = {
  id: '',
  name: '',
  email: '',
  companyName: '',
  title: '',
  avatarUrl: '',
  currency: 'USD',
  hourlyRate: 0,
  onboardingCompleted: false,
};

export const mockUserSettings: UserSettings = {
  id: '',
  currency: 'USD',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  week_start: 'monday',
  invoice_prefix: 'INV-',
  default_tax_rate: 0,
  tax_name: 'GST',
  default_payment_terms: 14,
  email_notifications: true,
};

export const mockClients: Client[] = [];
export const mockProjects: Project[] = [];
export const mockDeliverables: Deliverable[] = [];
export const mockDocuments: DocumentItem[] = [];
export const mockInvoices: Invoice[] = [];
export const mockActivities: ActivityLog[] = [];
export const mockNotifications: NotificationItem[] = [];

export const mockDashboardMetrics: DashboardMetrics = {
  totalRevenue: 0,
  monthlyRevenue: 0,
  activeClientsCount: 0,
  activeProjectsCount: 0,
  pendingInvoicesAmount: 0,
  completedProjectsCount: 0,
  upcomingDeliverablesCount: 0,
  revenueHistory: [],
};
