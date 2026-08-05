export type StatusType = 'active' | 'inactive' | 'lead' | 'pending' | 'completed' | 'draft' | 'overdue' | 'paid' | 'archived' | 'in_progress' | 'review' | 'on_hold';

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  avatarUrl?: string;
  status: 'active' | 'inactive' | 'lead' | 'archived';
  healthBadge?: 'healthy' | 'attention' | 'risk';
  totalBilled: number;
  activeProjectsCount: number;
  country: string;
  currency: string;
  createdAt: string;
  notes?: string;
  tags?: string[];
  isArchived?: boolean;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  desc?: string;
}

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  status: 'in_progress' | 'review' | 'completed' | 'on_hold' | 'archived';
  budget: number;
  spent: number;
  startDate: string;
  dueDate: string;
  completionPercentage: number;
  tags: string[];
  milestones?: ProjectMilestone[];
  team?: string[];
  isArchived?: boolean;
}

export interface DeliverableVersion {
  id?: string;
  version: string;
  date: string;
  note: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  uploadedBy?: string;
  status?: 'draft' | 'in_review' | 'approved' | 'changes_requested' | 'archived';
  revisionComment?: string;
  isArchived?: boolean;
}

export interface Deliverable {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_review' | 'approved' | 'changes_requested' | 'draft' | 'completed';
  dueDate: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  version: string;
  internalNotes?: string;
  revisionNote?: string;
  versionHistory?: DeliverableVersion[];
  isArchived?: boolean;
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  type: 'contract' | 'proposal' | 'brief' | 'nda' | 'tax' | 'other';
  status: 'pending' | 'uploaded' | 'verified' | 'rejected' | 'missing' | 'draft' | 'sent' | 'signed' | 'expired';
  isRequired?: boolean;
  order?: number;
  dueDate?: string;
  updatedAt: string;
  size?: string;
  fileName?: string;
  downloadUrl?: string;
  requestedAt?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  verificationNotes?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'draft';
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
}

export interface WorkspaceComment {
  id: string;
  clientId: string;
  author: string;
  avatar?: string;
  time: string;
  text: string;
  attachments?: string[];
  read?: boolean;
  isOwner?: boolean;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  isPinned?: boolean;
  mentions?: string[];
  updatedAt?: string;
}

export interface ClientPortalConfig {
  clientId: string;
  enabled: boolean;
  magicKey: string;
  inviteStatus?: 'pending_invite' | 'invited' | 'accepted';
  invitedAt?: string;
  acceptedAt?: string;
  inviteLink?: string;
  lastAccessed?: string;
  portalUrl?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  category: 'client' | 'project' | 'invoice' | 'document' | 'deliverable' | 'comment' | 'portal';
  metadata?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  clientId?: string;
  category?: 'document' | 'deliverable' | 'comment' | 'portal' | 'invoice' | 'project';
}

export interface WorkspaceProgressBreakdown {
  documentsProgress: number; // 0 - 20
  milestonesProgress: number; // 0 - 30
  deliverablesProgress: number; // 0 - 30
  approvalsProgress: number; // 0 - 20
  totalPercentage: number; // 0 - 100
  overallPercentage: number;
  documentsPercentage: number;
  milestonesPercentage: number;
  deliverablesPercentage: number;
  approvalsPercentage: number;
  stage: 'Planning' | 'In Progress' | 'Review' | 'Completed';
}

export type WorkspaceHealthStatus = 'Healthy' | 'Waiting on Client' | 'Waiting on Freelancer' | 'Blocked' | 'Completed';

export interface WorkspaceHealthDetails {
  status: WorkspaceHealthStatus;
  score: number;
  reasons: string[];
}

export interface ClientPortalDashboardData {
  client: Client;
  projects: Project[];
  upcomingTasks: { id: string; title: string; dueDate: string; category: string }[];
  pendingApprovalsCount: number;
  pendingDocumentsCount: number;
  outstandingInvoicesTotal: number;
  recentActivities: ActivityLog[];
  nextAction?: { title: string; description: string; actionType: 'upload_doc' | 'review_deliverable' | 'pay_invoice' | 'general' };
}

export interface UserProfile {
  id?: string;
  name: string;
  title: string;
  email: string;
  avatarUrl: string;
  currency: string;
  companyName: string;
  hourlyRate: number;
  taxRate: number;
  notificationsEnabled: boolean;
  profession?: string;
  phone?: string;
  country?: string;
  timezone?: string;
  language?: string;
  onboardingCompleted?: boolean;
}

export interface SupabaseProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  business_name: string | null;
  profession: string | null;
  phone: string | null;
  country: string | null;
  timezone: string | null;
  language: string | null;
  onboarding_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSettings {
  id?: string;
  currency: string;
  timezone: string;
  date_format: string;
  week_start: string;
  invoice_prefix: string;
  default_tax_rate: number;
  tax_name: string;
}

export interface OnboardingData {
  // Step 1: Personal
  fullName: string;
  profession: string;
  country: string;
  timezone: string;
  language: string;
  // Step 2: Business
  businessName: string;
  logoUrl?: string;
  currency: string;
  taxName: string;
  taxRate: number;
  // Step 3: First Client
  clientName: string;
  clientCompany: string;
  clientEmail: string;
}

export interface WorkspaceSummary {
  clientId: string;
  client: Client;
  projects: Project[];
  deliverables: Deliverable[];
  documents: DocumentItem[];
  invoices: Invoice[];
  comments: WorkspaceComment[];
  activities: ActivityLog[];
  portalConfig: ClientPortalConfig;
  healthScore: number;
}

export interface DashboardMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  activeClientsCount: number;
  pendingInvoicesAmount: number;
  completedProjectsCount: number;
  upcomingDeliverablesCount: number;
  activeProjectsCount: number;
  revenueHistory: { month: string; amount: number }[];
}
