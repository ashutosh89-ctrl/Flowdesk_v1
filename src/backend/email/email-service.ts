import { getAppBaseUrl } from '@/shared/utils/url';
import { supabase, supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import {
  renderClientInvitationEmail,
  renderDeliverableReadyEmail,
  renderDeliverableApprovedEmail,
  renderRevisionRequestedEmail,
  renderDocumentUploadedEmail,
  renderInvoiceIssuedEmail,
  renderPaymentReceivedEmail,
  renderAccountLifecycleEmail,
  renderSecurityAlertEmail,
  ClientInvitationParams,
  DeliverableReadyParams,
  DeliverableApprovedParams,
  RevisionRequestedParams,
  DocumentUploadedParams,
  InvoiceIssuedParams,
  PaymentReceivedParams,
  AccountLifecycleParams,
  SecurityAlertParams,
} from './templates';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  eventType: string;
  referenceType?: string;
  referenceId?: string;
  workspaceId?: string;
  userId?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  suppressed?: boolean;
}

export const EmailService = {
  /**
   * Check if Resend API is ready for server-side dispatch
   */
  isConfigured: (): boolean => {
    if (typeof window !== 'undefined') return false;
    const key = process.env.RESEND_API_KEY || '';
    return Boolean(key && key.startsWith('re_'));
  },

  /**
   * Core server-side dispatch with atomic outbox claiming, idempotency, and retry capability
   */
  send: async (options: SendEmailOptions): Promise<EmailSendResult> => {
    const { to, subject, html, text, eventType, referenceType, referenceId, workspaceId, userId } = options;

    if (!to || !to.includes('@')) {
      console.warn(`[EmailService] Invalid recipient email: ${to}`);
      return { success: false, error: 'Invalid recipient email address.' };
    }

    // 0. Client-side browser dispatch via /api/email endpoint
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ options }),
        });
        const data = await res.json();
        return data;
      } catch (err: any) {
        console.warn('[EmailService] Browser API dispatch notice:', err);
        return { success: false, error: err.message || 'Client email request failed.' };
      }
    }

    const db = supabaseAdmin || supabase;
    const recipientNorm = to.toLowerCase().trim();
    const workerId = `worker_${process.pid || 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 0.5 Email preference enforcement.
    //    Non-critical transactional emails respect the workspace owner's
    //    user_settings preferences. Security-critical events (client invitation,
    //    account lifecycle, security alerts) are always delivered.
    const PREFERENCE_MAP: Record<string, string> = {
      deliverable_ready: 'email_deliverables',
      deliverable_approved: 'email_deliverables',
      revision_requested: 'email_deliverables',
      document_uploaded: 'email_documents',
      invoice_issued: 'email_invoices',
      payment_received: 'email_invoices',
      receipt_issued: 'email_invoices',
    };
    const MANDATORY_EVENTS = new Set(['client_invitation', 'account_deleted', 'account_restored', 'security_alert']);

    if (workspaceId && !MANDATORY_EVENTS.has(eventType)) {
      const prefColumn = PREFERENCE_MAP[eventType];
      if (prefColumn) {
        try {
          const { data: ws } = await db.from('workspaces').select('owner_id').eq('id', workspaceId).maybeSingle();
          if (ws?.owner_id) {
            const { data: prefs } = await db
              .from('user_settings')
              .select(prefColumn)
              .eq('id', ws.owner_id)
              .maybeSingle();
            // Default to enabled when no explicit preference row exists.
            const prefsRecord = prefs as Record<string, unknown> | null;
            const enabled = prefsRecord ? prefsRecord[prefColumn] !== false : true;
            if (!enabled) {
              console.info(`[EmailService] ${eventType} suppressed by workspace email preference (${prefColumn}=false).`);
              try {
                await db.from('email_events').insert({
                  workspace_id: workspaceId || null,
                  user_id: ws.owner_id,
                  recipient: recipientNorm,
                  event_type: eventType,
                  reference_type: referenceType || null,
                  reference_id: referenceId || null,
                  status: 'suppressed',
                  last_error: `Suppressed by ${prefColumn} preference`,
                });
              } catch { /* non-critical */ }
              return { success: true, suppressed: true, messageId: 'suppressed_by_preference' };
            }
          }
        } catch (err) {
          console.warn('[EmailService] Preference lookup notice (defaulting to enabled):', err);
        }
      }
    }

    // 1. Check & Claim Idempotency (Atomic Outbox Claiming)
    let eventRecordId: string | null = null;

    if (referenceId) {
      try {
        // Check if an event for this reference + eventType + recipient is already sent
        const { data: existing } = await db
          .from('email_events')
          .select('id, status, provider_message_id, attempt_count')
          .eq('event_type', eventType)
          .eq('reference_id', referenceId)
          .eq('recipient', recipientNorm)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'sent' || existing.status === 'delivered') {
            console.info(`[EmailService] Duplicate send suppressed for ${eventType} (ref: ${referenceId}) to ${recipientNorm}`);
            return {
              success: true,
              messageId: existing.provider_message_id || 'duplicate_suppressed',
              suppressed: true,
            };
          }

          if (existing.status === 'processing') {
            console.info(`[EmailService] Concurrent send in-flight suppressed for ${eventType} (ref: ${referenceId})`);
            return {
              success: true,
              messageId: 'concurrent_in_flight',
              suppressed: true,
            };
          }

          // If failed, claim the existing record for retry
          const { data: claimed } = await db
            .from('email_events')
            .update({
              status: 'processing',
              claimed_at: new Date().toISOString(),
              locked_by: workerId,
              attempt_count: (existing.attempt_count || 1) + 1,
            })
            .eq('id', existing.id)
            .eq('status', existing.status)
            .select('id')
            .maybeSingle();

          if (claimed) {
            eventRecordId = claimed.id;
          }
        } else {
          // Insert new outbox record with processing status atomically
          const { data: inserted, error: insErr } = await db
            .from('email_events')
            .insert({
              workspace_id: workspaceId || null,
              user_id: userId || null,
              recipient: recipientNorm,
              event_type: eventType,
              reference_type: referenceType || null,
              reference_id: referenceId || null,
              status: 'processing',
              claimed_at: new Date().toISOString(),
              locked_by: workerId,
              attempt_count: 1,
            })
            .select('id')
            .maybeSingle();

          if (!insErr && inserted) {
            eventRecordId = inserted.id;
          } else if (insErr?.code === '23505') {
            // Unique index collision: Another process created the record simultaneously!
            console.info(`[EmailService] TOCTOU collision avoided for ${eventType} (ref: ${referenceId})`);
            return {
              success: true,
              messageId: 'concurrent_claim_suppressed',
              suppressed: true,
            };
          }
        }
      } catch (err) {
        console.warn('[EmailService] Outbox state management notice:', err);
      }
    }

    const resendModule = typeof window === 'undefined' ? (await import('./resend-client')) : null;
    const resendClient = resendModule?.getResendClient() || null;
    const isConfigured = resendModule?.isResendConfigured || false;
    const fromAddress = resendModule?.defaultSender || process.env.EMAIL_FROM || 'FlowDesk <onboarding@resend.dev>';

    // 2. Simulated delivery ONLY in explicitly configured demo environments.
    //    Production NEVER fabricates a successful send when Resend is not
    //    configured — that would claim delivery that never happened.
    if (!resendClient || !isConfigured) {
      if (isDemoModeActive()) {
        console.info(`[EmailService - Demo Mode] Simulated email to ${recipientNorm}: "${subject}"`);
        const mockMsgId = `mock_${Date.now()}`;
        if (eventRecordId) {
          try {
            await db.from('email_events').update({
              provider: 'resend_mock',
              provider_message_id: mockMsgId,
              status: 'sent',
              sent_at: new Date().toISOString(),
            }).eq('id', eventRecordId);
          } catch {}
        } else {
          try {
            await db.from('email_events').insert({
              workspace_id: workspaceId || null,
              user_id: userId || null,
              recipient: recipientNorm,
              event_type: eventType,
              reference_type: referenceType || null,
              reference_id: referenceId || null,
              provider: 'resend_mock',
              provider_message_id: mockMsgId,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          } catch {}
        }
        return { success: true, messageId: mockMsgId };
      }

      // Production: fail closed — do NOT claim delivery. Record a configuration
      // failure on the outbox record so it can be retried once Resend is configured.
      console.error(`[EmailService] Resend is not configured; email NOT sent to ${recipientNorm} (${eventType}).`);
      if (eventRecordId) {
        try {
          await db.from('email_events').update({
            status: 'failed',
            last_error: 'Resend is not configured on the server.',
            next_attempt_at: new Date(Date.now() + 60 * 1000).toISOString(),
          }).eq('id', eventRecordId);
        } catch {}
      }
      return { success: false, error: 'Email provider is not configured. Delivery was not attempted.' };
    }

    // 3. Send via Official Resend SDK
    try {
      const { data, error } = await resendClient.emails.send({
        from: fromAddress,
        to: [recipientNorm],
        subject,
        html,
        text,
      });

      if (error) {
        console.warn(`[EmailService] Resend delivery error for ${eventType}:`, error.message);
        const retryDelaySec = 60; // 1 minute backoff for retry
        const nextAttempt = new Date(Date.now() + retryDelaySec * 1000).toISOString();

        if (eventRecordId) {
          try {
            await db.from('email_events').update({
              status: 'failed',
              last_error: error.message,
              next_attempt_at: nextAttempt,
            }).eq('id', eventRecordId);
          } catch {}
        }
        return { success: false, error: error.message };
      }

      const messageId = data?.id || `resend_${Date.now()}`;

      // 4. Mark Outbox Record as sent
      if (eventRecordId) {
        try {
          await db.from('email_events').update({
            provider: 'resend',
            provider_message_id: messageId,
            status: 'sent',
            sent_at: new Date().toISOString(),
          }).eq('id', eventRecordId);
        } catch {}
      } else {
        try {
          await db.from('email_events').insert({
            workspace_id: workspaceId || null,
            user_id: userId || null,
            recipient: recipientNorm,
            event_type: eventType,
            reference_type: referenceType || null,
            reference_id: referenceId || null,
            provider: 'resend',
            provider_message_id: messageId,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
        } catch {}
      }

      return { success: true, messageId };
    } catch (err: any) {
      console.warn(`[EmailService] Unexpected dispatch error for ${eventType}:`, err);
      if (eventRecordId) {
        try {
          await db.from('email_events').update({
            status: 'failed',
            last_error: err.message || 'Unexpected dispatch exception',
          }).eq('id', eventRecordId);
        } catch {}
      }
      return { success: false, error: err.message || 'Email dispatch failed' };
    }
  },

  // --- Specialized Transactional Email Dispatchers ---

  sendClientInvitation: async (
    recipientEmail: string,
    params: ClientInvitationParams,
    meta?: { workspaceId?: string; clientId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderClientInvitationEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'client_invitation',
      referenceType: 'client',
      referenceId: meta?.clientId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendDeliverableReady: async (
    recipientEmail: string,
    params: DeliverableReadyParams,
    meta?: { workspaceId?: string; deliverableId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderDeliverableReadyEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'deliverable_ready',
      referenceType: 'deliverable',
      referenceId: meta?.deliverableId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendDeliverableApproved: async (
    recipientEmail: string,
    params: DeliverableApprovedParams,
    meta?: { workspaceId?: string; deliverableId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderDeliverableApprovedEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'deliverable_approved',
      referenceType: 'deliverable',
      referenceId: meta?.deliverableId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendRevisionRequested: async (
    recipientEmail: string,
    params: RevisionRequestedParams,
    meta?: { workspaceId?: string; deliverableId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderRevisionRequestedEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'revision_requested',
      referenceType: 'deliverable',
      referenceId: meta?.deliverableId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendDocumentUploaded: async (
    recipientEmail: string,
    params: DocumentUploadedParams,
    meta?: { workspaceId?: string; documentId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderDocumentUploadedEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'document_uploaded',
      referenceType: 'document',
      referenceId: meta?.documentId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendInvoiceIssued: async (
    recipientEmail: string,
    params: InvoiceIssuedParams,
    meta?: { workspaceId?: string; invoiceId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderInvoiceIssuedEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'invoice_issued',
      referenceType: 'invoice',
      referenceId: meta?.invoiceId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendPaymentReceived: async (
    recipientEmail: string,
    params: PaymentReceivedParams,
    meta?: { workspaceId?: string; paymentId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderPaymentReceivedEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'payment_received',
      referenceType: 'payment',
      referenceId: meta?.paymentId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendReceipt: async (
    recipientEmail: string,
    params: PaymentReceivedParams,
    meta?: { workspaceId?: string; receiptId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderPaymentReceivedEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: `Receipt for Invoice #${params.invoiceNumber}`,
      html: template.html,
      text: template.text,
      eventType: 'receipt_issued',
      referenceType: 'receipt',
      referenceId: meta?.receiptId,
      workspaceId: meta?.workspaceId,
    });
  },

  sendAccountDeleted: async (
    recipientEmail: string,
    params: AccountLifecycleParams,
    meta?: { workspaceId?: string; userId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderAccountLifecycleEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'account_deleted',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  sendAccountRestored: async (
    recipientEmail: string,
    params: AccountLifecycleParams,
    meta?: { workspaceId?: string; userId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderAccountLifecycleEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'account_restored',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },

  sendSecurityAlert: async (
    recipientEmail: string,
    params: SecurityAlertParams,
    meta?: { workspaceId?: string; userId?: string }
  ): Promise<EmailSendResult> => {
    const template = renderSecurityAlertEmail(params);
    return EmailService.send({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      eventType: 'security_alert',
      workspaceId: meta?.workspaceId,
      userId: meta?.userId,
    });
  },
};
