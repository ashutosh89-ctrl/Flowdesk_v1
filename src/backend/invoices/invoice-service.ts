/**
 * Shared Core Invoice Service
 *
 * Single source of truth for invoice creation across manual API route handlers
 * and automated background recurring invoice generators.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { calculateInvoiceTotals, formatInvoiceNumber } from '@/shared/rules';
import { assertWithinLimit } from '@/backend/billing';

export interface CreateInvoiceCoreInput {
  workspaceId: string;
  userId: string;
  clientId: string;
  projectId?: string | null;
  invoiceNumber?: string;
  status?: 'draft' | 'sent';
  issueDate: string;
  dueDate: string;
  currency: string;
  items: { description: string; quantity: number; rate: number }[];
  taxPercentage?: number | null;
  taxName?: string | null;
  discount?: number | null;
  notes?: string;
  paymentInstructions?: string;
  internalNotes?: string;
  recurringScheduleId?: string | null;
  recurrencePeriodKey?: string | null;
}

export interface CreateInvoiceCoreResult {
  success: boolean;
  invoice?: any;
  deduped?: boolean;
  error?: string;
  errorCode?: string;
}

export async function createInvoiceCore(
  input: CreateInvoiceCoreInput
): Promise<CreateInvoiceCoreResult> {
  const {
    workspaceId,
    userId,
    clientId,
    projectId,
    status = 'draft',
    issueDate,
    dueDate,
    currency,
    items,
    taxPercentage,
    taxName,
    discount,
    notes = '',
    paymentInstructions = '',
    internalNotes = '',
    recurringScheduleId,
    recurrencePeriodKey,
  } = input;

  // 1. Calculate financials via pure business rules
  const calc = calculateInvoiceTotals({
    items,
    taxPercentage,
    discount,
  });

  // 2. Demo mode / Mock fallback
  if (!supabaseAdmin || isDemoModeActive()) {
    const invId = `inv-mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const invoiceNumber = input.invoiceNumber || `INV-${new Date().getFullYear()}-0001`;
    return {
      success: true,
      deduped: false,
      invoice: {
        id: invId,
        workspace_id: workspaceId,
        client_id: clientId,
        project_id: projectId || null,
        invoice_number: invoiceNumber,
        status,
        issue_date: issueDate,
        due_date: dueDate,
        currency,
        subtotal: calc.subtotal,
        tax_percentage: calc.taxPercentage,
        tax_amount: calc.taxAmount,
        total_amount: calc.total,
        discount: calc.discount,
        paid_amount: 0,
        recurring_schedule_id: recurringScheduleId || null,
        recurrence_period_key: recurrencePeriodKey || null,
        items,
      },
    };
  }

  try {
    // 3. Verify Client exists and belongs to workspace
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, name, email, status')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (clientErr || !client) {
      return {
        success: false,
        error: 'Client not found in workspace',
        errorCode: 'CLIENT_NOT_FOUND',
      };
    }

    if (client.status === 'archived' || client.status === 'pending_deletion') {
      return {
        success: false,
        error: 'Cannot generate invoice for archived or deleted client',
        errorCode: 'CLIENT_ARCHIVED',
      };
    }

    // 4. Monthly Invoices Plan Quota Check
    try {
      await assertWithinLimit(workspaceId, 'invoicesPerMonth', 1);
    } catch (limitErr: any) {
      return {
        success: false,
        error: limitErr.message || 'Invoice monthly quota reached for this plan',
        errorCode: limitErr.code || 'PLAN_LIMIT_REACHED',
      };
    }

    // 5. Atomic Invoice Number Generation (if omitted)
    let invoiceNumber = input.invoiceNumber?.trim();
    if (!invoiceNumber) {
      const { data: existingInvs } = await supabaseAdmin
        .from('invoices')
        .select('invoice_number')
        .eq('workspace_id', workspaceId);

      const existingNumbers = (existingInvs || []).map((i) => i.invoice_number);
      const year = new Date().getFullYear();
      let maxSeq = 0;
      for (const num of existingNumbers) {
        if (!num) continue;
        const match = num.match(/\d+$/);
        if (match) {
          const parsed = parseInt(match[0], 10);
          if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
        }
      }
      invoiceNumber = formatInvoiceNumber({ prefix: 'INV', includeYear: true }, maxSeq + 1, year);
    }

    // 6. Insert Invoice Record
    const nowIso = new Date().toISOString();
    const { data: insertedInvoice, error: insertError } = await supabaseAdmin
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        user_id: userId,
        client_name: client.name || 'Client',
        client_email: client.email || '',
        project_id: projectId || null,
        invoice_number: invoiceNumber,
        status,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: calc.subtotal,
        tax_percentage: calc.taxPercentage,
        tax_name: taxName || 'Tax',
        tax_amount: calc.taxAmount,
        total_amount: calc.total,
        discount: calc.discount,
        paid_amount: 0,
        currency,
        notes,
        payment_instructions: paymentInstructions,
        internal_notes: internalNotes,
        recurring_schedule_id: recurringScheduleId || null,
        recurrence_period_key: recurrencePeriodKey || null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (insertError) {
      // 23505 Unique Violation on (recurring_schedule_id, recurrence_period_key) or invoice_number
      if (insertError.code === '23505') {
        if (recurringScheduleId && recurrencePeriodKey) {
          logger.info(`[InvoiceService] Recurring invoice period already generated (deduped): schedule=${recurringScheduleId}, period=${recurrencePeriodKey}`, {
            workspaceId,
          });
          return { success: true, deduped: true };
        }
        return {
          success: false,
          error: 'An invoice with this number already exists.',
          errorCode: 'DUPLICATE_INVOICE_NUMBER',
        };
      }
      logger.error(`[InvoiceService] Database insert error: ${insertError.message}`, insertError, { workspaceId });
      return { success: false, error: insertError.message, errorCode: 'DATABASE_ERROR' };
    }

    // 7. Insert Line Items
    if (items.length > 0) {
      const itemsPayload = items.map((it) => ({
        invoice_id: insertedInvoice.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.rate,
        amount: Math.round(it.quantity * it.rate * 100) / 100,
      }));

      await supabaseAdmin.from('invoice_items').insert(itemsPayload);
    }

    // 8. Log Activity
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: workspaceId,
        client_id: clientId,
        action: 'created_invoice',
        title: `Created Invoice #${invoiceNumber}`,
        description: `Created invoice #${invoiceNumber} for ${client.name}`,
        resource_type: 'invoice',
        resource_id: insertedInvoice.id,
      });
    } catch { /* non-critical */ }

    return {
      success: true,
      deduped: false,
      invoice: insertedInvoice,
    };
  } catch (err: any) {
    logger.error(`[InvoiceService] Unexpected error: ${err?.message}`, err, { workspaceId });
    return { success: false, error: err?.message || 'Failed to create invoice' };
  }
}
