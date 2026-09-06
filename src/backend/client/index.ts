export * from './client-auth-service';
export * from './client-deliverable-service';
export * from './client-document-service';
export * from './client-invoice-service';
export * from './client-comment-service';

import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { DemoDataProvider } from '@/backend/utilities/demo-data-provider';
import { ClientAuthService } from './client-auth-service';
import { ClientDeliverableService } from './client-deliverable-service';
import { ClientDocumentService } from './client-document-service';
import { ClientInvoiceService } from './client-invoice-service';
import { ClientCommentService } from './client-comment-service';
import {
  Client,
  Project,
  Deliverable,
  DocumentItem,
  Invoice,
  PortalActivity,
  PortalNotification,
  PortalComment,
  PortalProfile,
  PortalFileRequest,
  InvoiceBranding,
} from '@/shared/types';

export interface ClientPortalDataset {
  client: Client | null;
  projects: Project[];
  deliverables: Deliverable[];
  documents: DocumentItem[];
  invoices: Invoice[];
  activities: PortalActivity[];
  notifications: PortalNotification[];
  comments: PortalComment[];
  profile: PortalProfile | null;
  fileRequests: PortalFileRequest[];
  branding?: InvoiceBranding | null;
  isConfigured?: boolean;
}

export const ClientPortalService = {
  /**
   * Resolves full dataset for authenticated Client Portal session
   */
  getPortalData: async (clientIdOrToken: string): Promise<ClientPortalDataset> => {
    if (!clientIdOrToken || !clientIdOrToken.trim()) {
      return {
        client: null,
        projects: [],
        deliverables: [],
        documents: [],
        invoices: [],
        activities: [],
        notifications: [],
        comments: [],
        profile: null,
        fileRequests: [],
        isConfigured: false,
      };
    }

    // Demo mode: return mock data directly
    if (isDemoModeActive()) {
      const cleanDemoId = clientIdOrToken.trim();
      const mockClient = DemoDataProvider.getClientById(cleanDemoId) || DemoDataProvider.getClients()[0];
      if (!mockClient) {
        return { client: null, projects: [], deliverables: [], documents: [], invoices: [], activities: [], notifications: [], comments: [], profile: null, fileRequests: [], isConfigured: false };
      }
      const mockProjs = DemoDataProvider.getProjectsByClientId(mockClient.id);
      const mockDelivs = DemoDataProvider.getDeliverables(mockClient.id);
      const mockDocs = DemoDataProvider.getDocuments(mockClient.id);
      const mockInvs = DemoDataProvider.getInvoices(mockClient.id);
      return {
        client: mockClient,
        projects: mockProjs,
        deliverables: mockDelivs,
        documents: mockDocs,
        invoices: mockInvs,
        activities: mockDelivs.map((d, idx) => ({
          id: `act-${idx}`,
          clientId: mockClient.id,
          title: d.title,
          description: `Deliverable status: ${d.status.replace(/_/g, ' ')}`,
          timestamp: d.dueDate || 'Active',
          actor: mockClient.company,
          category: 'deliverable' as const,
        })),
        notifications: [],
        comments: [],
        profile: {
          id: `prof-${mockClient.id}`,
          clientId: mockClient.id,
          company: mockClient.company,
          contactPerson: mockClient.name,
          email: mockClient.email,
          phone: mockClient.phone || '',
          timezone: 'America/New_York (UTC-4)',
          portalLanguage: 'English (US)',
          recentAccess: 'Active Session',
        },
        fileRequests: mockDocs.filter(d => d.status === 'pending').map(d => ({
          id: d.id, clientId: mockClient.id, title: d.title, description: `Please upload ${d.title}.`,
          requestedBy: 'Studio Owner', category: 'Brand Assets', status: d.status === 'uploaded' || d.status === 'verified' ? 'fulfilled' as const : 'pending' as const,
          dueDate: d.dueDate || 'Required', requestedAt: 'Recent',
        })),
        isConfigured: true,
      };
    }

    const cleanId = clientIdOrToken.trim();

    // 1. Resolve client record
    let client: Client | null = null;

    // Supabase query
      try {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .or(`id.eq.${cleanId},portal_token.eq.${cleanId},user_id.eq.${cleanId},email.eq.${cleanId}`)
          .maybeSingle();

        if (data) {
          client = {
            id: data.id,
            userId: data.user_id,
            portalToken: data.portal_token,
            name: data.name,
            company: data.company,
            email: data.email,
            phone: data.phone || '',
            avatarUrl: data.avatar_url || '',
            status: data.status || 'active',
            healthBadge: data.health_badge || 'healthy',
            totalBilled: Number(data.total_billed) || 0,
            activeProjectsCount: data.active_projects_count || 0,
            country: data.country || 'United States',
            currency: data.currency || 'USD',
            createdAt: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          };
        }
      } catch (err) {
        console.warn('Error querying client record from Supabase:', err);
      }

    if (!client) {
      return {
        client: null,
        projects: [],
        deliverables: [],
        documents: [],
        invoices: [],
        activities: [],
        notifications: [],
        comments: [],
        profile: null,
        fileRequests: [],
        isConfigured: false,
      };
    }

    const resolvedClientId = client.id;

    // 2. Fetch scoped data in parallel using client services
    const [deliverables, documents, invoices, comments] = await Promise.all([
      ClientDeliverableService.getDeliverables(resolvedClientId),
      ClientDocumentService.getDocuments(resolvedClientId),
      ClientInvoiceService.getInvoices(resolvedClientId),
      ClientCommentService.getComments(resolvedClientId),
    ]);

    // 3. Projects
    let projects: Project[] = [];
    try {
      const { data: projsData } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', resolvedClientId);

      if (projsData && projsData.length > 0) {
        projects = projsData.map((p) => ({
          id: p.id,
          clientId: p.client_id,
          clientName: p.client_name || client!.company,
          title: p.title,
          description: p.description || '',
          status: p.status || 'in_progress',
          budget: Number(p.budget) || 0,
          spent: Number(p.spent) || 0,
          startDate: p.start_date || new Date().toISOString().split('T')[0],
          dueDate: p.due_date || new Date().toISOString().split('T')[0],
          completionPercentage: p.completion_percentage || 0,
          tags: p.tags || [],
          milestones: p.milestones || [],
        }));
      }
    } catch {
      // ignore
    }

    // Projects loaded from Supabase above

    // 4. File requests from documents
    const fileRequests: PortalFileRequest[] = documents
      .filter((d) => d.status === 'pending' || d.isRequired)
      .map((d) => ({
        id: d.id,
        clientId: resolvedClientId,
        title: d.title,
        description: d.description || `Please upload ${d.title} for project kickoff.`,
        requestedBy: 'Studio Owner',
        category: 'Brand Assets',
        status: d.status === 'uploaded' || d.status === 'verified' ? 'fulfilled' : 'pending',
        dueDate: d.dueDate || 'Required for kickoff',
        requestedAt: d.requestedAt || d.updatedAt || 'Recent',
        uploadedAt: d.uploadedAt,
      }));

    // 5. Activity stream from activities table (scoped to client)
    let activities: PortalActivity[] = [];
    try {
      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('client_id', resolvedClientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (actData && actData.length > 0) {
        activities = actData.map((a) => ({
          id: a.id,
          clientId: resolvedClientId,
          projectId: a.project_id || undefined,
          title: a.title || a.action,
          description: a.description || a.action,
          timestamp: a.created_at?.split('T')[0] || 'Recent',
          actor: a.user_name || client!.company,
          category: (a.resource_type as any) || 'deliverable',
        }));
      }
    } catch {
      // Fallback: construct from deliverables if activities table query fails
      activities = deliverables.map((del, idx) => ({
        id: del.id || `act-${idx}`,
        clientId: resolvedClientId,
        title: del.title,
        description: `Deliverable status: ${del.status.replace(/_/g, ' ')}`,
        timestamp: del.dueDate || 'Active',
        actor: client!.company,
        category: 'deliverable' as const,
        projectId: del.projectId,
      }));
    }

    // 6. Notifications from Supabase (client-scoped)
    let notifications: PortalNotification[] = [];
    try {
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('client_id', resolvedClientId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (notifData && notifData.length > 0) {
        notifications = notifData.map((n) => ({
          id: n.id,
          clientId: resolvedClientId,
          title: n.title,
          message: n.message,
          read: n.read || false,
          timestamp: n.created_at?.split('T')[0] || 'Recent',
          priority: (n.priority as 'high' | 'medium' | 'low') || 'low',
          type: (n.category as any) || 'comment',
        }));
      }
    } catch {
      // Non-critical: return empty if query fails
    }

    // 7. Profile
    const profile: PortalProfile = {
      id: `prof-${resolvedClientId}`,
      clientId: resolvedClientId,
      company: client.company,
      contactPerson: client.name,
      email: client.email,
      phone: client.phone || '+1 (555) 234-5678',
      timezone: client.timezone || 'America/New_York (UTC-4)',
      portalLanguage: 'English (US)',
      recentAccess: 'Active Session',
    };

    // 8. Freelancer Studio Branding for Invoices & PDF
    let branding: any = {
      businessName: 'FlowDesk Freelance Studio',
      freelancerName: 'Studio Lead',
      email: '',
    };

    try {
      const wsId = (client as any).workspace_id;
      if (wsId) {
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('name, logo_url, signature_url, user_id')
          .eq('id', wsId)
          .maybeSingle();

        if (wsData) {
          branding.businessName = wsData.name || branding.businessName;
          branding.logoUrl = wsData.logo_url || undefined;
          branding.signatureUrl = wsData.signature_url || undefined;

          if (wsData.user_id) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('full_name, business_name, email, phone, logo_url, signature_url')
              .eq('id', wsData.user_id)
              .maybeSingle();

            if (profData) {
              branding.freelancerName = profData.full_name || branding.freelancerName;
              branding.businessName = profData.business_name || wsData.name || branding.businessName;
              branding.email = profData.email || '';
              branding.phone = profData.phone || '';
              branding.logoUrl = profData.logo_url || wsData.logo_url || undefined;
              branding.signatureUrl = profData.signature_url || wsData.signature_url || undefined;
            }
          }
        }
      }
    } catch {
      // safe fallback
    }

    return {
      client,
      projects,
      deliverables,
      documents,
      invoices,
      activities,
      notifications,
      comments,
      profile,
      branding,
      fileRequests,
      isConfigured: true,
    };
  },

  // Action proxies delegating to domain client services
  approveDeliverable: async (clientId: string, deliverableId: string, notes?: string) => {
    return ClientDeliverableService.approveDeliverable(clientId, deliverableId, notes);
  },

  requestRevision: async (clientId: string, deliverableId: string, revisionComment: string, attachmentFile?: File) => {
    return ClientDeliverableService.requestRevision(clientId, deliverableId, revisionComment, attachmentFile);
  },

  uploadDocumentFile: async (
    clientId: string,
    docId: string,
    fileData: { fileName: string; size: string; downloadUrl?: string; file?: File; workspaceId?: string }
  ) => {
    return ClientDocumentService.uploadDocumentFile(clientId, docId, fileData);
  },

  uploadDirectDocument: async (
    clientId: string,
    payload: {
      file: File;
      title: string;
      category: any;
      description?: string;
      projectId?: string;
      workspaceId?: string;
    }
  ) => {
    return ClientDocumentService.uploadDirectDocument(clientId, payload);
  },

  initiatePayment: async (clientId: string, invoiceId: string) => {
    return ClientInvoiceService.initiatePayment(clientId, invoiceId);
  },

  postComment: async (
    clientId: string,
    commentData: { text: string; author: string; avatar?: string; replyToId?: string }
  ) => {
    return ClientCommentService.postComment(clientId, commentData);
  },
};
