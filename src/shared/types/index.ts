export type StatusType = 'active' | 'inactive' | 'lead' | 'pending' | 'completed' | 'draft' | 'overdue' | 'paid' | 'archived' | 'in_progress' | 'review' | 'on_hold';

export interface CustomField {
  key: string;
  value: string;
}

export interface Client {
  id: string;
  userId?: string;
  portalToken?: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  industry?: string;
  avatarUrl?: string;
  logoUrl?: string;
  status: 'active' | 'inactive' | 'lead' | 'archived' | 'pending_deletion';
  healthBadge?: 'excellent' | 'healthy' | 'attention' | 'critical' | 'risk';
  totalBilled: number;
  outstandingBalance?: number;
  activeProjectsCount: number;
  country: string;
  timezone?: string;
  currency: string;
  createdAt: string;
  deletedAt?: string;
  restoreUntil?: string;
  daysRemaining?: number;
  lastActivity?: string;
  notes?: string;
  tags?: string[];
  customFields?: CustomField[];
  isArchived?: boolean;
}

export interface AccountDeletionRecord {
  id: string;
  accountType: 'client' | 'freelancer';
  userId?: string;
  workspaceId?: string;
  clientId?: string;
  clientName?: string;
  clientCompany?: string;
  deletedBy: string;
  deletedAt: string;
  restoreUntil: string;
  daysRemaining: number;
  status: 'pending_deletion' | 'restored' | 'permanently_deleted';
  metadata?: Record<string, any>;
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
  priority?: 'high' | 'medium' | 'low';
  budget: number;
  spent: number;
  startDate: string;
  dueDate: string;
  completionPercentage: number;
  tags: string[];
  milestones?: ProjectMilestone[];
  team?: string[];
  linkedInvoiceId?: string;
  linkedDeliverableIds?: string[];
  linkedDocumentIds?: string[];
  isArchived?: boolean;
}

export type DeliverableStatus =
  | 'draft'
  | 'preparing'
  | 'ready_for_review'
  | 'submitted'
  | 'approved'
  | 'revision_requested'
  | 'completed'
  | 'archived';

export type ApprovalStatus =
  | 'pending'
  | 'viewed'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'expired';

export type DeliverablePriority = 'high' | 'medium' | 'low';

export interface DeliverableFile {
  id: string;
  deliverableId: string;
  versionId?: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
  folder?: string;
  isPinned?: boolean;
}

export interface DeliverableVersion {
  id: string;
  deliverableId?: string;
  version: string;
  versionNumber?: string;
  date: string;
  note: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  uploadedBy?: string;
  uploadedFiles?: DeliverableFile[];
  submissionDate?: string;
  approvalStatus?: ApprovalStatus;
  status?: 'draft' | 'in_review' | 'approved' | 'changes_requested' | 'archived';
  revisionNotes?: string;
  revisionComment?: string;
  isCurrentVersion?: boolean;
  createdDate?: string;
  isArchived?: boolean;
}

export interface DeliverableComment {
  id: string;
  deliverableId: string;
  author: string;
  authorAvatar?: string;
  authorRole: 'freelancer' | 'client' | 'team';
  isInternal: boolean;
  timestamp: string;
  content: string;
  replies?: DeliverableComment[];
  attachments?: string[];
  isResolved?: boolean;
}

export interface DeliverableRevision {
  id: string;
  deliverableId: string;
  revisionNumber: number;
  requestedBy: string;
  reason: string;
  requestedDate: string;
  completedDate?: string;
  status: 'pending' | 'in_progress' | 'addressed' | 'rejected';
  linkedVersion: string;
}

export interface DeliverableApproval {
  id: string;
  deliverableId: string;
  version: string;
  status: ApprovalStatus;
  reviewerName: string;
  reviewerEmail?: string;
  notes?: string;
  timestamp: string;
}

export interface DeliverableActivity {
  id: string;
  deliverableId: string;
  timestamp: string;
  user: string;
  userAvatar?: string;
  action: string;
  details?: string;
}

export interface DeliverableTimelineItem {
  id: string;
  deliverableId: string;
  type:
    | 'created'
    | 'files_uploaded'
    | 'version_created'
    | 'submitted'
    | 'viewed'
    | 'comment_added'
    | 'revision_requested'
    | 'approved'
    | 'completed';
  title: string;
  timestamp: string;
  actor: string;
  metadata?: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  clientId: string;
  clientName?: string;
  title: string;
  description: string;
  status: DeliverableStatus;
  approvalStatus?: ApprovalStatus;
  priority?: DeliverablePriority;
  dueDate: string;
  reviewDeadline?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  version: string;
  commentsCount?: number;
  filesCount?: number;
  linkedProjectId?: string;
  linkedDocumentIds?: string[];
  internalNotes?: string;
  submissionMessage?: string;
  revisionNote?: string;
  rejectionReason?: string;
  files?: DeliverableFile[];
  versionHistory?: DeliverableVersion[];
  comments?: DeliverableComment[];
  revisions?: DeliverableRevision[];
  approvals?: DeliverableApproval[];
  activityLog?: DeliverableActivity[];
  timeline?: DeliverableTimelineItem[];
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentItem {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  type: 'contract' | 'proposal' | 'brief' | 'nda' | 'tax' | 'invoice' | 'asset' | 'deliverable' | 'other';
  status: 'pending' | 'uploaded' | 'verified' | 'rejected' | 'missing' | 'draft' | 'sent' | 'signed' | 'expired';
  folder?: string;
  isPinned?: boolean;
  isInternal?: boolean;
  tags?: string[];
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

export type InvoiceWorkflowStatus = 'draft' | 'sent' | 'viewed' | 'cancelled';
export type InvoicePaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';
export type PaymentMethod = 'razorpay' | 'bank_transfer' | 'cash' | 'cheque' | 'online' | 'other';

export interface InvoiceBranding {
  businessName: string;
  freelancerName: string;
  email: string;
  phone?: string;
  address?: string;
  country?: string;
  logoUrl?: string;
  signatureUrl?: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  taxPercent?: number;
  amount: number;
  total?: number;
}

export interface InvoiceReminder {
  id: string;
  invoiceId: string;
  reminderNumber: number; // 1, 2, or 3 (max 3)
  date: string;
  method: 'email' | 'portal' | 'manual';
  status: 'sent' | 'failed' | 'scheduled';
  notes?: string;
}

export interface InvoiceReceipt {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId?: string;
  clientName?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod | string;
  paymentDate: string;
  notes?: string;
  remainingBalance?: number;
  totalAmount?: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  gateway?: string;
  gatewayStatus?: string;
}

export interface InvoiceTimelineItem {
  id: string;
  invoiceId: string;
  type:
    | 'created'
    | 'edited'
    | 'sent'
    | 'viewed'
    | 'reminder_sent'
    | 'marked_paid_offline'
    | 'payment_received'
    | 'cancelled';
  title: string;
  timestamp: string;
  actor: string;
  metadata?: string;
}

export interface InvoiceActivity {
  id: string;
  invoiceId: string;
  timestamp: string;
  user: string;
  action: string;
  details?: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
}

export interface InvoiceHistory {
  id: string;
  invoiceId: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  time: string;
  user: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  projectId?: string;
  projectName?: string;
  issueDate: string;
  dueDate: string;
  workflowStatus: InvoiceWorkflowStatus;
  paymentStatus: InvoicePaymentStatus;
  status?: 'paid' | 'pending' | 'overdue' | 'draft' | 'partially_paid' | 'cancelled';
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  taxName?: string;
  taxPercentage?: number;
  tax: number;
  total: number;
  paidAmount?: number;
  remainingBalance?: number;
  currency: string;
  notes?: string;
  paymentInstructions?: string;
  internalNotes?: string;
  viewedAt?: string;
  lastDeliveredAt?: string;
  reminders?: InvoiceReminder[];
  receipts?: InvoiceReceipt[];
  timeline?: InvoiceTimelineItem[];
  activityLog?: InvoiceActivity[];
  history?: InvoiceHistory[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancialDashboardMetrics {
  lifetimeRevenue: number;
  outstandingBalance: number;
  paidThisMonth: number;
  pendingPayments: number;
  overdueAmount: number;
  averageInvoiceValue: number;
  paymentCollectionRate: number;
  recentPayments: Invoice[];
  recentInvoices: Invoice[];
  upcomingDueDates: Invoice[];
  agingReport: {
    range: '0-7 Days' | '8-15 Days' | '16-30 Days' | '30+ Days';
    amount: number;
    count: number;
    percentage: number;
  }[];
  paymentTrend: { month: string; paid: number; pending: number }[];
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
  isInternal?: boolean;
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

// Phase 10 Specific Portal Models
export interface ClientPortal {
  id: string;
  clientId: string;
  companyName: string;
  primaryContact: string;
  contactEmail: string;
  enabled: boolean;
  magicKey: string;
  portalUrl: string;
  inviteStatus: 'pending_invite' | 'invited' | 'accepted';
  invitedAt?: string;
  acceptedAt?: string;
  lastAccessedAt?: string;
  themeConfig?: {
    accentColor?: string;
    logoUrl?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PortalNotification {
  id: string;
  clientId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  type: 'deliverable' | 'invoice' | 'document' | 'comment' | 'project' | 'approval' | 'file_request';
  link?: string;
  groupedBy?: 'today' | 'yesterday' | 'earlier';
  createdAt?: string;
}

export interface PortalActivity {
  id: string;
  clientId: string;
  projectId?: string;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  category: 'deliverable' | 'invoice' | 'document' | 'approval' | 'revision' | 'file_request' | 'comment';
  metadata?: string;
  createdAt?: string;
}

export interface PortalCommentAttachment {
  name: string;
  size: string;
  url: string;
}

export interface PortalComment {
  id: string;
  clientId: string;
  projectId?: string;
  deliverableId?: string;
  author: string;
  authorRole: 'client' | 'freelancer';
  avatar?: string;
  timestamp: string;
  text: string;
  replies?: PortalComment[];
  replyToId?: string;
  replyToAuthor?: string;
  attachments?: PortalCommentAttachment[];
  isResolved?: boolean;
  unread?: boolean;
  mentions?: string[];
  createdAt?: string;
}

export interface PortalApproval {
  id: string;
  clientId: string;
  deliverableId: string;
  deliverableTitle: string;
  version: string;
  approvedBy: string;
  approvedAt: string;
  comments?: string;
  status: 'approved' | 'revision_requested' | 'pending';
  createdAt?: string;
}

export interface PortalFileRequest {
  id: string;
  clientId: string;
  projectId?: string;
  requestedBy: string;
  title: string;
  category: 'Brand Assets' | 'Logos' | 'Content' | 'Contracts' | 'Reference Files' | 'Other';
  description?: string;
  status: 'pending' | 'fulfilled' | 'rejected';
  dueDate?: string;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  uploadedFileSize?: string;
  requestedAt: string;
  uploadedAt?: string;
  createdAt?: string;
}

export interface PortalProfile {
  id: string;
  clientId: string;
  company: string;
  contactPerson: string;
  email: string;
  phone: string;
  timezone: string;
  portalLanguage: string;
  recentAccess: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
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
  role?: string;
  email: string;
  avatarUrl: string;
  logoUrl?: string;
  signatureUrl?: string;
  currency: string;
  companyName: string;
  hourlyRate: number;
  profession?: string;
  phone?: string;
  address?: string;
  country?: string;
  timezone?: string;
  language?: string;
  onboardingCompleted?: boolean;
}

export interface SupabaseProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  logo_url?: string | null;
  signature_url?: string | null;
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

export type InvoiceNumberFormatPreset =
  | 'prefix_sequence'      // INV-0001
  | 'prefix_year_sequence' // INV-2026-0001
  | 'bill_sequence'        // BILL-0001
  | 'bill_year_sequence'   // BILL-2026-0001
  | 'year_sequence'        // 2026-0001
  | 'custom';              // User-defined

export interface InvoiceNumberingSettings {
  format?: InvoiceNumberFormatPreset;
  prefix?: string;
  separator?: string;
  includeYear?: boolean;
  padding?: number; // 1 to 5 digits, default 4
  nextSequence?: number; // Starting or next sequence number
  annualReset?: boolean; // Resets sequence per calendar year if true
}

export interface UserSettings {
  id?: string;
  currency: string;
  timezone: string;
  date_format: string;
  week_start: string;
  invoice_prefix: string;
  invoice_number_format?: InvoiceNumberFormatPreset;
  invoice_separator?: string;
  invoice_include_year?: boolean;
  invoice_padding?: number;
  invoice_next_sequence?: number;
  invoice_annual_reset?: boolean;
  default_tax_rate: number;
  tax_name: string;
  default_payment_terms: number;
  email_notifications?: boolean;
  email_deliverables?: boolean;
  email_documents?: boolean;
  email_invoices?: boolean;
  invoice_reminders?: boolean;
  comment_alerts?: boolean;
  weekly_digest?: boolean;
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
  health: WorkspaceHealthDetails;
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

// ====================================================
// PHASE 11: MISSION CONTROL & PRODUCTIVITY DATA MODELS
// ====================================================

export type WidgetCategory = 'core' | 'finance' | 'projects' | 'activity' | 'productivity';
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface DashboardWidget {
  id: string;
  type:
    | 'today_focus'
    | 'business_snapshot'
    | 'workspace_health'
    | 'project_health'
    | 'revenue'
    | 'activity'
    | 'deadlines'
    | 'invoices_due'
    | 'approvals'
    | 'recent_uploads'
    | 'usage'
    | 'active_clients'
    | 'pinned'
    | 'recent_work';
  title: string;
  enabled: boolean;
  order: number;
  category: WidgetCategory;
  size: WidgetSize;
  options?: Record<string, any>;
}

export interface WorkspaceHealthRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionText: string;
  actionType: 'send_reminder' | 'approve_deliv' | 'review_docs' | 'contact_client' | 'create_invoice' | 'view_project';
  targetId?: string;
  targetType?: 'client' | 'invoice' | 'deliverable' | 'project' | 'document';
}

export interface WorkspaceHealth {
  score: number; // 0 - 100
  status: 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical';
  metrics: {
    overdueInvoicesCount: number;
    overdueInvoicesAmount: number;
    lateProjectsCount: number;
    unansweredCommentsCount: number;
    pendingApprovalsCount: number;
    missingDocumentsCount: number;
    clientEngagementScore: number;
  };
  recommendations: WorkspaceHealthRecommendation[];
  updatedAt: string;
}

export interface BusinessMetrics {
  activeClientsCount: number;
  activeProjectsCount: number;
  pendingDeliverablesCount: number;
  pendingDocumentsCount: number;
  pendingInvoicesCount: number;
  pendingInvoicesAmount: number;
  outstandingRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  completionRate: number;
  workspaceHealthScore: number;
  revenueGrowthPct: number;
  activeProposalsCount?: number;
  avgProjectCompletionDays?: number;
}

export interface PinnedItem {
  id: string;
  resourceId: string;
  resourceType: 'client' | 'project' | 'invoice' | 'document' | 'folder' | 'deliverable';
  title: string;
  subtitle: string;
  path: string;
  pinnedAt: string;
  metadata?: Record<string, any>;
}

export interface RecentItem {
  id: string;
  resourceId: string;
  title: string;
  type: 'project' | 'client' | 'document' | 'deliverable' | 'invoice';
  subtitle: string;
  path: string;
  timestamp: string;
  clientId?: string;
  thumbnailUrl?: string;
}

export interface QuickActionItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'create' | 'navigate' | 'filter' | 'settings';
  shortcut?: string;
  actionType:
    | 'create_client'
    | 'create_project'
    | 'create_deliverable'
    | 'create_invoice'
    | 'create_folder'
    | 'create_document'
    | 'navigate'
    | 'open_modal';
  targetView?: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'client' | 'project' | 'invoice' | 'document' | 'deliverable' | 'comment' | 'activity';
  category: string;
  path: string;
  clientId?: string;
  badge?: string;
  timestamp?: string;
  isPinned?: boolean;
}

export interface SearchIndex {
  clients: SearchResultItem[];
  projects: SearchResultItem[];
  invoices: SearchResultItem[];
  documents: SearchResultItem[];
  deliverables: SearchResultItem[];
  comments: SearchResultItem[];
  activities: SearchResultItem[];
  lastIndexedAt: string;
}

export type ProjectHealthStatus = 'Excellent' | 'Healthy' | 'Needs Attention' | 'Critical';

export interface ProjectHealthSummary {
  projectId: string;
  projectTitle: string;
  clientName: string;
  clientId: string;
  status: ProjectHealthStatus;
  score: number;
  completionPercentage: number;
  overdueMilestones: number;
  pendingDeliverables: number;
  revisionRequests: number;
  unpaidInvoices: number;
  reasons: string[];
}

export type TodayFocusPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TodayFocusItem {
  id: string;
  title: string;
  description: string;
  category: 'overdue_invoice' | 'deliverable_due' | 'revision_requested' | 'missing_file' | 'approval_waiting' | 'comment_unanswered';
  priority: TodayFocusPriority;
  dueDate?: string;
  clientName?: string;
  clientId?: string;
  actionText: string;
  actionType: 'view_invoice' | 'view_deliverable' | 'view_documents' | 'view_workspace' | 'pay_invoice' | 'approve';
  targetId: string;
  createdAt: string;
}

