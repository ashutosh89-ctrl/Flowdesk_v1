/**
 * Handler: send_invoice_reminder
 *
 * Dispatches automated payment reminder, re-verifies stop conditions,
 * and records forensic audit entry in reminder_log.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { EmailService } from '@/backend/email/email-service';
import { getAppBaseUrl } from '@/shared/utils/url';
import { JobHandler } from '../types';

export interface SendInvoiceReminderPayload {
  invoiceId: string;
  ruleKey: string;
  stage?: 'before_due' | 'due_date' | 'after_due';
}

export const sendInvoiceReminderHandler: JobHandler<SendInvoiceReminderPayload> = async (
  payload,
  context
) => {
  const { invoiceId, ruleKey, stage = 'after_due' } = payload;
  const { workspaceId, isDryRun } = context;

  if (isDryRun) {
    logger.info(`[DryRun] Would send payment reminder for invoice ${invoiceId}, rule ${ruleKey}`, {
      workspaceId,
    });
    return { success: true };
  }

  if (!supabaseAdmin || isDemoModeActive()) {
    return { success: true };
  }

  // 1. Re-load invoice
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (invErr || !invoice) {
    return {
      success: false,
      error: `Invoice not found: ${invErr?.message || 'Missing record'}`,
    };
  }

  // 2. Re-check Stop Conditions
  if (!['sent', 'viewed'].includes(invoice.status)) {
    logger.info(`[SendReminder] Invoice ${invoiceId} status is '${invoice.status}'. Suppressing reminder.`, {
      workspaceId,
    });
    return { success: true };
  }

  const total = Number(invoice.total_amount) || 0;
  const paid = Number(invoice.paid_amount) || 0;
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);

  if (remaining <= 0 || paid >= total) {
    logger.info(`[SendReminder] Invoice ${invoiceId} is fully paid. Suppressing reminder.`, {
      workspaceId,
    });
    return { success: true };
  }

  if (!invoice.client_email || !invoice.client_email.includes('@')) {
    return {
      success: false,
      error: 'Client email is missing or invalid',
    };
  }

  // 3. Resolve Studio Name
  let studioName = 'FlowDesk Studio';
  try {
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();

    if (ws?.owner_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('business_name, full_name')
        .eq('id', ws.owner_id)
        .maybeSingle();

      if (profile?.business_name) studioName = profile.business_name;
      else if (profile?.full_name) studioName = profile.full_name;
    }
  } catch { /* non-critical */ }

  const baseUrl = getAppBaseUrl();
  const portalUrl = `${baseUrl}/portal/login`;
  const curr = invoice.currency || '$';

  // 4. Dispatch Reminder Email
  const sendRes = await EmailService.sendInvoiceReminder(
    invoice.client_email,
    {
      clientName: invoice.client_name || 'Client',
      freelancerName: studioName,
      invoiceNumber: invoice.invoice_number,
      amountFormatted: `${curr} ${total.toLocaleString()}`,
      remainingBalanceFormatted: `${curr} ${remaining.toLocaleString()}`,
      dueDate: invoice.due_date || new Date().toISOString().split('T')[0],
      portalUrl,
      stage,
    },
    {
      workspaceId,
      invoiceId: invoice.id,
      ruleKey,
    }
  );

  if (!sendRes.success && !sendRes.suppressed) {
    return {
      success: false,
      error: sendRes.error || 'Failed to dispatch reminder email',
    };
  }

  // 5. Record entry in reminder_log
  try {
    const { error: logErr } = await supabaseAdmin.from('reminder_log').insert({
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      rule_key: ruleKey,
      recipient_email: invoice.client_email,
      sent_at: new Date().toISOString(),
    });

    if (logErr && logErr.code !== '23505') {
      logger.warn(`[SendReminder] Failed to record reminder_log: ${logErr.message}`, {
        workspaceId,
        invoiceId,
      });
    }
  } catch (err: any) {
    logger.warn(`[SendReminder] Exception logging reminder: ${err?.message}`, {
      workspaceId,
      invoiceId,
    });
  }

  return { success: true };
};
