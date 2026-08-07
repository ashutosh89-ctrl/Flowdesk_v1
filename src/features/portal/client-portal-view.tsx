'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FlowDeskStore } from '../../services/storage-store';
import { ClientPortalShell } from './components/client-portal-shell';
import { Card } from '../../components/ui/card';
import {
  DeliverableService,
  DocumentService,
  InvoiceService,
  CommentService,
  NotificationService,
} from '../../services';
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
} from '../../types';
import { AlertCircle } from 'lucide-react';

export interface ClientPortalViewProps {
  clientId: string;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({ clientId }) => {
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activities, setActivities] = useState<PortalActivity[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [fileRequests, setFileRequests] = useState<PortalFileRequest[]>([]);

  const loadPortalData = useCallback(async () => {
    const clientData = FlowDeskStore.getClientById(clientId);

    if (clientData) {
      setClient(clientData);

      // Projects
      const clientProjs = FlowDeskStore.getProjectsByClientId(clientId);
      setProjects(clientProjs);

      // Deliverables
      const clientDelivs = FlowDeskStore.getDeliverables(clientId);
      setDeliverables(clientDelivs);

      // Documents
      const clientDocs = FlowDeskStore.getDocuments(clientId);
      setDocuments(clientDocs);

      // Invoices
      const clientInvs = FlowDeskStore.getInvoices(clientId);
      setInvoices(clientInvs);

      // Comments mapped to PortalComment format
      const wsComments = FlowDeskStore.getComments(clientId);
      const mappedComments: PortalComment[] = wsComments.map((c) => ({
        id: c.id,
        clientId,
        author: c.author,
        authorRole: c.isOwner ? 'freelancer' : 'client',
        text: c.text,
        timestamp: c.time || 'Today',
        unread: !c.read,
        attachments: c.attachments ? c.attachments.map((a) => ({ name: a, size: '1.2 MB', url: '#' })) : undefined,
      }));
      setComments(mappedComments);

      // Mock Client-facing Activities
      const rawActivities = FlowDeskStore.getActivities();
      const mappedActivities: PortalActivity[] = rawActivities.slice(0, 8).map((act, idx) => ({
        id: act.id || `act-${idx}`,
        clientId,
        title: act.action ? act.action.charAt(0).toUpperCase() + act.action.slice(1) : 'Workspace Activity',
        description: `${act.user || 'Alex Rivera'} ${act.action} on ${act.target || 'deliverable'}`,
        timestamp: act.timestamp || 'Today',
        actor: act.user || 'Alex Rivera',
        category: 'deliverable',
        projectId: clientProjs[0]?.id,
      }));
      setActivities(mappedActivities);

      // Notifications
      const rawNotifs = FlowDeskStore.getNotifications();
      const mappedNotifs: PortalNotification[] = rawNotifs.map((n, idx) => ({
        id: n.id || `notif-${idx}`,
        clientId,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp || 'Today',
        read: n.read || false,
        priority: n.type === 'error' || n.type === 'warning' ? 'high' : 'medium',
        type: 'deliverable',
        groupedBy: idx < 2 ? 'today' : 'yesterday',
      }));
      setNotifications(mappedNotifs);

      // Profile
      setProfile({
        id: `prof-${clientId}`,
        clientId,
        company: clientData.company,
        contactPerson: clientData.name,
        email: clientData.email,
        phone: clientData.phone || '+1 (555) 234-5678',
        timezone: 'PST (UTC-8)',
        portalLanguage: 'English (US)',
        recentAccess: 'Active Session',
      });

      // File Requests
      const reqs: PortalFileRequest[] = [
        {
          id: `freq-1`,
          clientId,
          requestedBy: 'Alex Rivera',
          title: 'High-Res Vector Brand Logo (.SVG / .EPS)',
          category: 'Brand Assets',
          status: 'pending',
          dueDate: '2026-08-15',
          requestedAt: '2 days ago',
          description: 'Required for main web app navigation header and brand kit exported files.',
        },
        {
          id: `freq-2`,
          clientId,
          requestedBy: 'Alex Rivera',
          title: 'Brand Typography & Design Guidelines PDF',
          category: 'Briefs' as any,
          status: 'pending',
          dueDate: '2026-08-18',
          requestedAt: 'Yesterday',
          description: 'Primary typefaces and color palette specs.',
        },
      ];
      setFileRequests(reqs);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        loadPortalData();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [loadPortalData]);

  // Actions
  const handleApproveDeliverable = async (delivId: string, notes?: string) => {
    await DeliverableService.approveDeliverable(delivId, notes);
    await loadPortalData();
  };

  const handleRequestRevision = async (delivId: string, reason: string, priority: string, comment: string) => {
    await DeliverableService.requestDeliverableRevision(delivId, `[${priority} - ${reason}] ${comment}`);
    await loadPortalData();
  };

  const handleUploadDocument = async (docId: string, fileData: { fileName: string; size: string }) => {
    await DocumentService.uploadDocumentFile(docId, fileData);
    setFileRequests((prev) =>
      prev.map((r) => (r.id === docId ? { ...r, status: 'fulfilled', uploadedAt: 'Just now' } : r))
    );
    await loadPortalData();
  };

  const handlePayInvoice = async (invoiceId: string) => {
    await InvoiceService.markAsPaid(invoiceId);
    await loadPortalData();
  };

  const handlePostComment = async (text: string, replyToId?: string) => {
    if (!client) return;
    await CommentService.addComment(clientId, {
      text,
      author: client.name,
      avatar: client.avatarUrl,
      isOwner: false,
      replyToId,
    });
    await loadPortalData();
  };

  const handleMarkNotificationsRead = async () => {
    await NotificationService.markAllAsRead();
    await loadPortalData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Initializing Passwordless Client Collaboration Workspace...</p>
        </div>
      </div>
    );
  }

  if (!client || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md p-8 text-center space-y-4 border-white/20">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold">Client Portal Access Unavailable</h2>
          <p className="text-xs text-zinc-400">
            This collaboration workspace URL is invalid or access has been disabled by Rivera Studio.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <ClientPortalShell
      client={client}
      projects={projects}
      deliverables={deliverables}
      documents={documents}
      invoices={invoices}
      activities={activities}
      notifications={notifications}
      comments={comments}
      profile={profile}
      fileRequests={fileRequests}
      onApproveDeliverable={handleApproveDeliverable}
      onRequestRevision={handleRequestRevision}
      onUploadDocument={handleUploadDocument}
      onPayInvoice={handlePayInvoice}
      onPostComment={handlePostComment}
      onMarkNotificationsRead={handleMarkNotificationsRead}
    />
  );
};
