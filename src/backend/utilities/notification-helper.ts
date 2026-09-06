import { supabase } from '@/backend/utilities/supabase';
import { getCurrentWorkspace } from '@/backend/utilities/workspace';

/**
 * Centralized notification creation helper.
 * Generates persistent Supabase notifications for business events.
 *
 * All notification creation should go through this helper to ensure
 * consistent format, correct recipients, and proper RLS-safe inserts.
 */
export const NotificationHelper = {
  /**
   * Create a notification for the workspace owner (freelancer).
   */
  notifyFreelancer: async (params: {
    title: string;
    message: string;
    category?: string;
    link?: string;
    clientId?: string;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<void> => {
    try {
      const ws = await getCurrentWorkspace();
      if (!ws?.id) return;

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('notifications').insert({
        workspace_id: ws.id,
        user_id: user?.id || null,
        client_id: params.clientId || null,
        title: params.title,
        message: params.message,
        category: params.category || 'info',
        link: params.link || null,
        priority: params.priority || 'medium',
        read: false,
      });
    } catch (err) {
      console.warn('Failed to create freelancer notification:', err);
    }
  },

  /**
   * Create a notification for a specific client.
   */
  notifyClient: async (params: {
    clientId: string;
    title: string;
    message: string;
    category?: string;
    link?: string;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<void> => {
    try {
      const ws = await getCurrentWorkspace();
      if (!ws?.id) return;

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('notifications').insert({
        workspace_id: ws.id,
        user_id: null,
        client_id: params.clientId,
        title: params.title,
        message: params.message,
        category: params.category || 'info',
        link: params.link || null,
        priority: params.priority || 'medium',
        read: false,
      });
    } catch (err) {
      console.warn('Failed to create client notification:', err);
    }
  },

  // --- Convenience methods for common business events ---

  deliverableSubmitted: async (deliverableTitle: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Deliverable Submitted',
      message: `"${deliverableTitle}" has been submitted for your review.`,
      category: 'deliverable',
      link: 'deliverables',
      priority: 'high',
    });
  },

  deliverableApproved: async (deliverableTitle: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Deliverable Approved',
      message: `"${deliverableTitle}" has been approved.`,
      category: 'deliverable',
      link: 'deliverables',
    });
  },

  revisionRequested: async (deliverableTitle: string) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Revision Requested',
      message: `Client requested revision for "${deliverableTitle}".`,
      category: 'deliverable',
      link: 'deliverables',
      priority: 'high',
    });
  },

  clientDocumentUploaded: async (docTitle: string, clientName: string, category: string) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Client Uploaded Document',
      message: `${clientName} uploaded "${docTitle}" (${category}).`,
      category: 'document',
      link: 'documents',
      priority: 'medium',
    });
  },

  documentUploaded: async (docTitle: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Document Uploaded',
      message: `"${docTitle}" has been uploaded successfully.`,
      category: 'document',
      link: 'documents',
    });
  },

  documentRequested: async (docTitle: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Document Requested',
      message: `A new document "${docTitle}" has been requested.`,
      category: 'document',
      link: 'documents',
      priority: 'medium',
    });
  },

  documentVerified: async (docTitle: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Document Verified',
      message: `"${docTitle}" has been verified and accepted.`,
      category: 'document',
      link: 'documents',
    });
  },

  documentRejected: async (docTitle: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Document Rejected',
      message: `"${docTitle}" has been rejected. Please re-upload.`,
      category: 'document',
      link: 'documents',
      priority: 'high',
    });
  },

  invoiceCreated: async (invoiceNumber: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'Invoice Created',
      message: `Invoice ${invoiceNumber} has been created.`,
      category: 'invoice',
      link: 'invoices',
    });
  },

  invoicePaid: async (invoiceNumber: string) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Invoice Paid',
      message: `Invoice ${invoiceNumber} has been marked as paid.`,
      category: 'invoice',
      link: 'invoices',
    });
  },

  newComment: async (commenterName: string, entityTitle: string, recipientClientId?: string) => {
    if (recipientClientId) {
      await NotificationHelper.notifyClient({
        clientId: recipientClientId,
        title: 'New Comment',
        message: `${commenterName} commented on "${entityTitle}".`,
        category: 'comment',
        link: 'activity',
      });
    } else {
      await NotificationHelper.notifyFreelancer({
        title: 'New Comment',
        message: `${commenterName} commented on "${entityTitle}".`,
        category: 'comment',
        link: 'activity',
      });
    }
  },

  versionUploaded: async (deliverableTitle: string, versionNumber: string, clientId: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      title: 'New Version Uploaded',
      message: `Version ${versionNumber} of "${deliverableTitle}" is available for review.`,
      category: 'deliverable',
      link: 'deliverables',
    });
  },
};
