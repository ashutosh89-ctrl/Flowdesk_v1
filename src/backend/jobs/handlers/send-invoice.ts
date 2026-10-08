/**
 * Handler: send_invoice
 *
 * Dispatches transactional invoice email with idempotency and state verification.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { EmailService } from '@/backend/email/email-service';
import { getAppBaseUrl } from '@/shared/utils/url';
import { JobHandler } from '../types';

export interface SendInvoicePayload {
  invoiceId: string;
}

export const sendInvoiceHandler: JobHandler<SendInvoicePayload> = async (payload, context) => {
  const { invoiceId } = payload;
  const { workspaceId, isDryRun } = context;

  if (isDryRun) {
    logger.info(`[DryRun] Would send invoice email for invoice ${invoiceId}`, { workspaceId });
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

  // 2. State verification: Never send cancelled or paid invoices
  if (invoice.status === 'cancelled') {
    logger.info(`[SendInvoice] Invoice ${invoiceId} is cancelled. Skipping dispatch.`, { workspaceId });
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
  } catch { /* non-critical fallback */ }

  const baseUrl = getAppBaseUrl();
  const portalUrl = `${baseUrl}/portal/login`;

  // 4. Dispatch Email
  const sendRes = await EmailService.sendInvoiceIssued(
    invoice.client_email,
    {
      clientName: invoice.client_name || 'Client',
      freelancerName: studioName,
      invoiceNumber: invoice.invoice_number,
      amount: `${invoice.currency || '$'} ${(invoice.total_amount || 0).toLocaleString()}`,
      dueDate: invoice.due_date || new Date().toISOString().split('T')[0],
      portalUrl,
    },
    {
      workspaceId,
      invoiceId: invoice.id,
    }
  );

  if (!sendRes.success && !sendRes.suppressed) {
    return {
      success: false,
      error: sendRes.error || 'Failed to dispatch invoice email via provider',
    };
  }

  return { success: true };
};
