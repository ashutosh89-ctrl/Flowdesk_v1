'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ClientPortalShell } from './client-portal-shell';
import { Card } from '@/frontend/shared/ui/card';
import { ClientPortalService } from '@/backend/client';
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
  const [branding, setBranding] = useState<InvoiceBranding | null>(null);
  const [fileRequests, setFileRequests] = useState<PortalFileRequest[]>([]);

  const loadPortalData = useCallback(async () => {
    try {
      const data = await ClientPortalService.getPortalData(clientId);
      if (data.client) {
        setClient(data.client);
        setProjects(data.projects);
        setDeliverables(data.deliverables);
        setDocuments(data.documents);
        setInvoices(data.invoices);
        setActivities(data.activities);
        setNotifications(data.notifications);
        setComments(data.comments);
        setProfile(data.profile);
        setBranding(data.branding || null);
        setFileRequests(data.fileRequests);
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
    const run = async () => {
      await loadPortalData();
      if (!isMounted) return;
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [loadPortalData]);

  // Actions with Client Authorization Context
  const handleApproveDeliverable = async (delivId: string, notes?: string) => {
    if (!client) return;
    await ClientPortalService.approveDeliverable(client.id, delivId, notes);
    await loadPortalData();
  };

  const handleRequestRevision = async (
    delivId: string,
    reason: string,
    priority: string,
    comment: string,
    attachmentFile?: File
  ) => {
    if (!client) return;
    await ClientPortalService.requestRevision(
      client.id,
      delivId,
      `[${priority} - ${reason}] ${comment}`,
      attachmentFile
    );
    await loadPortalData();
  };

  const handleUploadDocument = async (
    docId: string,
    fileData: { fileName: string; size: string; file?: File; downloadUrl?: string }
  ) => {
    if (!client) return;
    await ClientPortalService.uploadDocumentFile(client.id, docId, fileData);
    setFileRequests((prev) =>
      prev.map((r) => (r.id === docId ? { ...r, status: 'fulfilled', uploadedAt: 'Just now' } : r))
    );
    await loadPortalData();
  };

  const handleDirectUploadDocument = async (payload: {
    file: File;
    title: string;
    category: any;
    description?: string;
    projectId?: string;
  }) => {
    if (!client) return { success: false, error: 'Authentication required' };
    const res = await ClientPortalService.uploadDirectDocument(client.id, payload);
    if (res.success) {
      await loadPortalData();
    }
    return res;
  };

  const handlePayInvoice = async (invoiceId: string) => {
    if (!client) return;
    await ClientPortalService.initiatePayment(client.id, invoiceId);
    await loadPortalData();
  };

  const handlePostComment = async (text: string, replyToId?: string) => {
    if (!client) return;
    await ClientPortalService.postComment(client.id, {
      text,
      author: client.name,
      avatar: client.avatarUrl,
      replyToId,
    });
    await loadPortalData();
  };

  const handleMarkNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
      branding={branding}
      fileRequests={fileRequests}
      onApproveDeliverable={handleApproveDeliverable}
      onRequestRevision={handleRequestRevision}
      onUploadDocument={handleUploadDocument}
      onDirectUploadDocument={handleDirectUploadDocument}
      onPayInvoice={handlePayInvoice}
      onPostComment={handlePostComment}
      onMarkNotificationsRead={handleMarkNotificationsRead}
    />
  );
};
