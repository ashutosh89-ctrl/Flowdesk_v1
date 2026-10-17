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
  isPendingApproval?: boolean;
}

const portalDataCache = new Map<string, { data: ClientPortalDataset; timestamp: number }>();
const PORTAL_CACHE_TTL_MS = 25000;

export const invalidatePortalCache = (clientId?: string) => {
  if (clientId) {
    portalDataCache.delete(clientId);
  } else {
    portalDataCache.clear();
  }
};

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

    const cleanId = clientIdOrToken.trim();
    const cached = portalDataCache.get(cleanId);
    if (cached && Date.now() - cached.timestamp < PORTAL_CACHE_TTL_MS && cached.data.client) {
      return cached.data;
    }

    // Demo mode: return mock data directly
    if (isDemoModeActive()) {
      if (cleanId === 'cli-demo-pending') {
        const pendingMockClient: Client = {
          id: 'cli-demo-pending',
          name: 'Sarah Jenkins',
          company: 'Vanguard Media Group',
          email: 'sarah.jenkins@vanguardmedia.io',
          status: 'pending',
          currency: 'USD',
          country: 'US',
          totalBilled: 0,
          activeProjectsCount: 0,
          createdAt: new Date().toISOString().split('T')[0],
        };
        const demoPendingResult: ClientPortalDataset = {
          client: pendingMockClient,
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
          isPendingApproval: true,
        };
        portalDataCache.set(cleanId, { data: demoPendingResult, timestamp: Date.now() });
        return demoPendingResult;
      }

      const mockClient = DemoDataProvider.getClientById(cleanId) || DemoDataProvider.getClients()[0] || {
        id: cleanId || 'cli-demo-001',
        name: 'Eleanor Vance',
        company: 'Apex Digital',
        email: 'eleanor@apexdigital.io',
        phone: '+1 555-0199',
        status: 'active',
        totalBilled: 12500,
        currency: 'USD',
        activeProjectsCount: 1,
        createdAt: '2026-01-01',
      };
      const foundProjs = DemoDataProvider.getProjectsByClientId(mockClient.id);
      const foundDelivs = DemoDataProvider.getDeliverables(mockClient.id);
      const mockDocs = DemoDataProvider.getDocuments(mockClient.id);
      const mockInvs = DemoDataProvider.getInvoices(mockClient.id);

      const mockProjs = foundProjs && foundProjs.length > 0 ? foundProjs : [
        {
          id: 'proj-demo-1',
          clientId: mockClient.id,
          clientName: mockClient.company,
          title: 'Brand Identity & Web Design',
          description: 'Comprehensive rebrand and product design.',
          status: 'in_progress' as const,
          budget: 15000,
          spent: 8000,
          startDate: '2026-01-10',
          dueDate: '2026-04-30',
          completionPercentage: 65,
          tags: ['branding', 'design'],
          milestones: [],
        },
      ];

      const mockDelivs: Deliverable[] = foundDelivs && foundDelivs.length > 0 ? foundDelivs : [
        {
          id: 'deliv-demo-1',
          projectId: 'proj-demo-1',
          clientId: mockClient.id,
          clientName: mockClient.company,
          title: 'Design System & Figma Tokens',
          description: 'Figma UI library and component tokens.',
          status: 'ready_for_review',
          approvalStatus: 'pending',
          priority: 'high',
          dueDate: '2026-03-15',
          version: 'v1.0',
          commentsCount: 2,
          filesCount: 3,
          createdAt: '2026-01-15',
          updatedAt: '2026-02-01',
        },
      ];

      const demoResult: ClientPortalDataset = {
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
      portalDataCache.set(cleanId, { data: demoResult, timestamp: Date.now() });
      return demoResult;
    }

    // 1. Resolve client record safely without filter injection
    let client: Client | null = null;

    const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

    // Supabase query
      try {
        let query = supabase.from('clients').select('*');

        if (UUID_PATTERN.test(cleanId)) {
          query = query.or(`id.eq.${cleanId},user_id.eq.${cleanId}`);
        } else if (EMAIL_PATTERN.test(cleanId)) {
          query = query.eq('email', cleanId.toLowerCase());
        } else if (TOKEN_PATTERN.test(cleanId)) {
          query = query.eq('portal_token', cleanId);
        } else {
          // Reject malformed inputs containing PostgREST filter injection operators
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }

        const { data } = await query.maybeSingle();


        if (data) {
          let canonicalData = data;
          if (data.email && data.workspace_id) {
            try {
              const { data: siblings } = await supabase
                .from('clients')
                .select('*')
                .eq('workspace_id', data.workspace_id)
                .ilike('email', data.email.trim().toLowerCase())
                .neq('status', 'pending_deletion');

              if (siblings && siblings.length > 1) {
                for (const s of siblings) {
                  const { data: dCount } = await supabase
                    .from('deliverables')
                    .select('id')
                    .eq('client_id', s.id)
                    .limit(1);
                  if (dCount && dCount.length > 0) {
                    canonicalData = s;
                    break;
                  }
                }
              }
            } catch {
              // ignore
            }
          }

          client = {
            id: canonicalData.id,
            userId: canonicalData.user_id,
            portalToken: canonicalData.portal_token,
            name: canonicalData.name,
            company: canonicalData.company,
            email: canonicalData.email,
            phone: canonicalData.phone || '',
            avatarUrl: canonicalData.avatar_url || '',
            status: canonicalData.status || 'active',
            healthBadge: canonicalData.health_badge || 'healthy',
            totalBilled: Number(canonicalData.total_billed) || 0,
            activeProjectsCount: canonicalData.active_projects_count || 0,
            country: canonicalData.country || 'India',
            currency: canonicalData.currency || 'USD',
            createdAt: canonicalData.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          };
          (client as any).workspace_id = canonicalData.workspace_id;
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

    // Strict Security Isolation: Pending or rejected clients must NEVER receive deliverables, documents, invoices or projects!
    if (client.status === 'pending' || client.status === 'rejected') {
      return {
        client,
        projects: [],
        deliverables: [],
        documents: [],
        invoices: [],
        activities: [],
        notifications: [],
        comments: [],
        profile: {
          id: `prof-${client.id}`,
          clientId: client.id,
          company: client.company,
          contactPerson: client.name,
          email: client.email,
          phone: client.phone || '',
          timezone: 'Pending Verification',
          portalLanguage: 'English (US)',
          recentAccess: 'Awaiting Freelancer Approval',
        },
        fileRequests: [],
        isConfigured: false,
        isPendingApproval: client.status === 'pending',
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
      phone: client.phone || '+91 98765 43210',
      timezone: client.timezone || 'Asia/Kolkata (IST +5:30)',
      portalLanguage: 'English',
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

    const result: ClientPortalDataset = {
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

    portalDataCache.set(cleanId, { data: result, timestamp: Date.now() });
    if (client.id && client.id !== cleanId) {
      portalDataCache.set(client.id, { data: result, timestamp: Date.now() });
    }

    return result;
  },

  // Action proxies delegating to domain client services
  approveDeliverable: async (clientId: string, deliverableId: string, notes?: string) => {
    invalidatePortalCache(clientId);
    return ClientDeliverableService.approveDeliverable(clientId, deliverableId, notes);
  },

  requestRevision: async (clientId: string, deliverableId: string, revisionComment: string, attachmentFile?: File) => {
    invalidatePortalCache(clientId);
    return ClientDeliverableService.requestRevision(clientId, deliverableId, revisionComment, attachmentFile);
  },

  uploadDocumentFile: async (
    clientId: string,
    docId: string,
    fileData: { fileName: string; size: string; downloadUrl?: string; file?: File; workspaceId?: string }
  ) => {
    invalidatePortalCache(clientId);
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
    invalidatePortalCache(clientId);
    return ClientDocumentService.uploadDirectDocument(clientId, payload);
  },

  initiatePayment: async (clientId: string, invoiceId: string) => {
    invalidatePortalCache(clientId);
    return ClientInvoiceService.initiatePayment(clientId, invoiceId);
  },

  postComment: async (
    clientId: string,
    commentData: { text: string; author: string; avatar?: string; replyToId?: string }
  ) => {
    invalidatePortalCache(clientId);
    return ClientCommentService.postComment(clientId, commentData);
  },
};
