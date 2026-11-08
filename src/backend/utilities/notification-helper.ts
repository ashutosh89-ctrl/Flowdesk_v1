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
      const client = supabaseAdmin || supabase;
      let wsId = params.workspaceId;

      // 1. Resolve workspace ID from clientId if not provided
      if (!wsId && params.clientId && client) {
        try {
          const { data: clientRow } = await client
            .from('clients')
            .select('workspace_id')
            .eq('id', params.clientId)
            .maybeSingle();
          if (clientRow?.workspace_id) {
            wsId = clientRow.workspace_id;
          }
        } catch {
          // ignore
        }
      }

      // 2. Fallback to active workspace session
      if (!wsId) {
        try {
          wsId = (await getCurrentWorkspace())?.id;
        } catch {
          // ignore
        }
      }

      if (!wsId) return;

      let targetUserId = params.userId || null;
      if (!targetUserId && client) {
        try {
          const { data: wsRow } = await client
            .from('workspaces')
            .select('owner_id')
            .eq('id', wsId)
            .maybeSingle();
          if (wsRow?.owner_id) {
            targetUserId = wsRow.owner_id;
          }
        } catch {
          // ignore
        }
      }

      if (!targetUserId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          targetUserId = user?.id || null;
        } catch {
          // In server/webhook context auth.getUser() may fail gracefully
        }
      }

      if (client) {
        await client.from('notifications').insert({
          workspace_id: wsId,
          user_id: targetUserId,
          client_id: null, // Freelancer notifications must have client_id: null so they don't leak to client portal
          title: params.title,
          message: params.message,
          category: params.category || 'info',
          link: params.link || null,
          priority: params.priority || 'medium',
          read: false,
        });

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('flowdesk:notifications-updated'));
        }
      }
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
    workspaceId?: string;
  }): Promise<void> => {
    try {
      const client = supabaseAdmin || supabase;
      let wsId = params.workspaceId;

      if (!wsId && client) {
        try {
          const { data: clientRow } = await client
            .from('clients')
            .select('workspace_id')
            .eq('id', params.clientId)
            .maybeSingle();
          if (clientRow?.workspace_id) {
            wsId = clientRow.workspace_id;
          }
        } catch {
          // ignore
        }
      }

      if (!wsId) {
        try {
          const ws = await getCurrentWorkspace();
          if (ws?.id) wsId = ws.id;
        } catch {
          // ignore
        }
      }

      if (!wsId) return;

      if (client) {
        await client.from('notifications').insert({
          workspace_id: wsId,
          user_id: null,
          client_id: params.clientId,
          title: params.title,
          message: params.message,
          category: params.category || 'info',
          link: params.link || null,
          priority: params.priority || 'medium',
          read: false,
        });

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('flowdesk:client-notifications-updated'));
        }
      }
    } catch (err) {
      console.warn('Failed to create client notification:', err);
    }
  },

  // --- Convenience methods for common business events ---

  deliverableSubmitted: async (deliverableTitle: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Deliverable Submitted',
      message: `"${deliverableTitle}" has been submitted for your review.`,
      category: 'deliverable',
      link: 'deliverables',
      priority: 'high',
    });
  },

  deliverableApproved: async (deliverableTitle: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Deliverable Approved',
      message: `"${deliverableTitle}" has been approved.`,
      category: 'deliverable',
      link: 'deliverables',
    });
  },

  revisionRequested: async (deliverableTitle: string, clientId?: string, workspaceId?: string) => {
    await NotificationHelper.notifyFreelancer({
      clientId,
      workspaceId,
      title: 'Revision Requested',
      message: `Client requested revision for "${deliverableTitle}".`,
      category: 'deliverable',
      link: 'deliverables',
      priority: 'high',
    });
  },

  clientDocumentUploaded: async (docTitle: string, clientName: string, category: string, clientId?: string, workspaceId?: string) => {
    await NotificationHelper.notifyFreelancer({
      clientId,
      workspaceId,
      title: 'Client Uploaded Document',
      message: `${clientName} uploaded "${docTitle}" (${category}).`,
      category: 'document',
      link: 'documents',
      priority: 'medium',
    });
  },

  documentUploaded: async (docTitle: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Document Uploaded',
      message: `"${docTitle}" has been uploaded successfully.`,
      category: 'document',
      link: 'documents',
    });
  },

  documentRequested: async (docTitle: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Document Requested',
      message: `A new document "${docTitle}" has been requested.`,
      category: 'document',
      link: 'documents',
      priority: 'medium',
    });
  },

  documentVerified: async (docTitle: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Document Verified',
      message: `"${docTitle}" has been verified and accepted.`,
      category: 'document',
      link: 'documents',
    });
  },

  documentRejected: async (docTitle: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Document Rejected',
      message: `"${docTitle}" has been rejected. Please re-upload.`,
      category: 'document',
      link: 'documents',
      priority: 'high',
    });
  },

  invoiceCreated: async (invoiceNumber: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: 'Invoice Created',
      message: `Invoice ${invoiceNumber} has been created and is available for review.`,
      category: 'invoice',
      link: 'invoices',
    });
  },

  invoicePaid: async (invoiceNumber: string, clientId?: string, workspaceId?: string) => {
    await NotificationHelper.notifyFreelancer({
      clientId,
      workspaceId,
      title: 'Invoice Paid',
      message: `Invoice ${invoiceNumber} has been marked as paid.`,
      category: 'invoice',
      link: 'invoices',
      priority: 'medium',
    });
    if (clientId) {
      await NotificationHelper.notifyClient({
        clientId,
        workspaceId,
        title: 'Payment Received',
        message: `Payment confirmed for Statement #${invoiceNumber}. Receipt generated.`,
        category: 'invoice',
        link: 'invoices',
        priority: 'medium',
      });
    }
  },

  paymentSubmitted: async (invoiceNumber: string, clientName: string, utrNumber?: string, clientId?: string, workspaceId?: string) => {
    await NotificationHelper.notifyFreelancer({
      clientId,
      workspaceId,
      title: 'Payment Submitted (Pending Verification)',
      message: `${clientName} submitted payment details for #${invoiceNumber}${utrNumber ? ` (UTR: ${utrNumber})` : ''}. Please verify in Invoices.`,
      category: 'invoice',
      link: 'invoices',
      priority: 'high',
    });
  },

  invoiceReminderSent: async (invoiceNumber: string, reminderNum: number, amountFormatted: string, clientId: string, workspaceId?: string) => {
    await NotificationHelper.notifyClient({
      clientId,
      workspaceId,
      title: `Payment Reminder: Invoice #${invoiceNumber}`,
      message: `Payment reminder #${reminderNum} for ${amountFormatted} on Invoice #${invoiceNumber}.`,
      category: 'invoice',
      link: 'invoices',
      priority: 'high',
    });
  },

  newComment: async (commenterName: string, entityTitle: string, recipientClientId?: string, workspaceId?: string) => {
    if (recipientClientId) {
      await NotificationHelper.notifyClient({
        clientId: recipientClientId,
        workspaceId,
        title: 'New Comment',
        message: `${commenterName} commented on "${entityTitle}".`,
        category: 'comment',
        link: 'activity',
      });
    } else {
      await NotificationHelper.notifyFreelancer({
        workspaceId,
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

  /**
   * Dispatched when a workspace subscription changes/downgrades to Starter and custom branding is inactivated.
   * Deduplicated so it only triggers once per downgrade event.
   */
  billingBrandingTemporarilyUnavailable: async (meta: { workspaceId: string; userId?: string | null }) => {
    const client = supabaseAdmin || supabase;
    if (client) {
      try {
        const { data: existing } = await client
          .from('notifications')
          .select('id')
          .eq('workspace_id', meta.workspaceId)
          .eq('category', 'branding_downgrade')
          .limit(1)
          .maybeSingle();

        if (existing) {
          return; // Already notified for this downgrade state
        }
      } catch {
        // Fallback safe
      }
    }

    await NotificationHelper.notifyFreelancer({
      title: 'Custom branding temporarily unavailable',
      message:
        'Your FlowDesk subscription has changed to Starter. Your previously uploaded logo and signature are safely retained, but custom branding is not available on the Starter plan. FlowDesk\'s official branding will now appear on your client portal. Upgrade to Standard or Studio to reactivate your saved branding.',
      category: 'branding_downgrade',
      link: 'pricing',
      priority: 'high',
      workspaceId: meta.workspaceId,
      userId: meta.userId || undefined,
    });
  },
};
