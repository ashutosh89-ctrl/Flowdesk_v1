'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ClientPortalShell } from './components/client-portal-shell';
import { Card } from '../../components/ui/card';
import {
  ClientService,
  ProjectService,
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
    try {
      const clientData = await ClientService.getClientById(clientId);

      if (clientData) {
        setClient(clientData);

        // Filter all resources strictly by clientId
        const clientProjs = await ProjectService.getProjectsByClientId(clientId);
        setProjects(clientProjs);

        const clientDelivs = await DeliverableService.getDeliverables(clientId);
        setDeliverables(clientDelivs);

        const clientDocs = await DocumentService.getDocuments(clientId);
        setDocuments(clientDocs);

        const clientInvs = await InvoiceService.getInvoices(clientId);
        setInvoices(clientInvs);

        const wsComments = await CommentService.getComments(clientId);
        const mappedComments: PortalComment[] = wsComments.map((c) => ({
          id: c.id,
          clientId,
          author: c.author,
          authorRole: c.isOwner ? 'freelancer' : 'client',
          text: c.text,
          timestamp: c.time || 'Today',
          unread: false,
          attachments: c.attachments ? c.attachments.map((a) => ({ name: a, size: '1.2 MB', url: '#' })) : undefined,
        }));
        setComments(mappedComments);

        const mappedActivities: PortalActivity[] = clientDelivs.map((act, idx) => ({
          id: act.id || `act-${idx}`,
          clientId,
          title: act.title,
          description: `${act.clientName || 'Client'} updated status to ${act.status}`,
          timestamp: act.dueDate || 'Today',
          actor: act.clientName || 'Member',
          category: 'deliverable',
          projectId: act.projectId,
        }));
        setActivities(mappedActivities);

        setNotifications([]);

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

        setFileRequests([]);
      } else {
        setClient(null);
      }
    } catch (err) {
      console.warn('Error loading client portal data:', err);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    let isMounted = true;
    loadPortalData().then(() => {
      if (!isMounted) return;
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
          <p className="text-xs text-zinc-400 font-mono">Initializing Client Workspace...</p>
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
            This collaboration workspace URL is invalid or access has been disabled by workspace owner.
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
