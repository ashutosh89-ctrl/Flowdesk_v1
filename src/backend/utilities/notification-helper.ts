import { supabase, supabaseAdmin } from '@/backend/utilities/supabase';
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
    workspaceId?: string;
    userId?: string;
  }): Promise<void> => {
    try {
      const wsId = params.workspaceId || (await getCurrentWorkspace())?.id;
      if (!wsId) return;

      let targetUserId = params.userId || null;
      if (!targetUserId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          targetUserId = user?.id || null;
        } catch {
          // In server/webhook context auth.getUser() may fail gracefully
        }
      }

      const client = supabaseAdmin || supabase;
      await client.from('notifications').insert({
        workspace_id: wsId,
        user_id: targetUserId,
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

  // --- Billing & Subscription Notifications ---

  billingPaymentFailed: async (planName: string, reason?: string, meta?: { workspaceId?: string; userId?: string }) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Subscription Payment Failed',
      message: `Payment failed for your ${planName} subscription.${reason ? ` (${reason})` : ''} Please update payment details.`,
      category: 'billing',
      link: 'settings',
      priority: 'high',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  billingGraceEndingSoon: async (daysRemaining: number, meta?: { workspaceId?: string; userId?: string }) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Grace Period Ending Soon',
      message: `Your workspace grace period concludes in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Feature creation will be locked thereafter.`,
      category: 'billing',
      link: 'settings',
      priority: 'high',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  billingSubscriptionActivated: async (planName: string, meta?: { workspaceId?: string; userId?: string }) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Subscription Active',
      message: `Your workspace has been upgraded to ${planName}. All tier benefits are live.`,
      category: 'billing',
      link: 'settings',
      priority: 'medium',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  billingSubscriptionCanceled: async (planName: string, effectiveDate: string, meta?: { workspaceId?: string; userId?: string }) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Subscription Cancelled',
      message: `Your ${planName} subscription has been cancelled and will end on ${effectiveDate}.`,
      category: 'billing',
      link: 'settings',
      priority: 'medium',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  billingPlanChanged: async (oldPlan: string, newPlan: string, meta?: { workspaceId?: string; userId?: string }) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Plan Updated',
      message: `Your workspace subscription was changed from ${oldPlan} to ${newPlan}.`,
      category: 'billing',
      link: 'settings',
      priority: 'medium',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  billingTrialEnding: async (daysRemaining: number, meta?: { workspaceId?: string; userId?: string }) => {
    await NotificationHelper.notifyFreelancer({
      title: 'Trial Ending Soon',
      message: `Your free Pro trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Upgrade to keep premium features.`,
      category: 'billing',
      link: 'settings',
      priority: 'medium',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },
};
