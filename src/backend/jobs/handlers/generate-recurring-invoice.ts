/**
 * Handler: generate_recurring_invoice
 *
 * Atomically generates a recurring invoice, enforces catch-up policy,
 * idempotently guards via UNIQUE(recurring_schedule_id, recurrence_period_key),
 * advances schedule next_run_at, and enqueues send_invoice job if auto_send is true.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { computeNextRunAt, formatIsoDateOnly } from '@/shared/rules/recurring-rules';
import { createInvoiceCore } from '@/backend/invoices/invoice-service';
import { enqueueJob } from '../queue';
import { JobHandler } from '../types';

export interface GenerateRecurringInvoicePayload {
  scheduleId: string;
  periodKey: string;
}

export const generateRecurringInvoiceHandler: JobHandler<GenerateRecurringInvoicePayload> = async (
  payload,
  context
) => {
  const { scheduleId, periodKey } = payload;
  const { workspaceId, isDryRun } = context;

  if (isDryRun) {
    logger.info(`[DryRun] Would generate recurring invoice for schedule ${scheduleId}, period ${periodKey}`, {
      workspaceId,
    });
    return { success: true };
  }

  if (!supabaseAdmin || isDemoModeActive()) {
    return { success: true };
  }

  // 1. Re-load the schedule inside the job
  const { data: schedule, error: schedErr } = await supabaseAdmin
    .from('recurring_invoice_schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (schedErr || !schedule) {
    return {
      success: false,
      error: `Schedule not found or error loading: ${schedErr?.message || 'Not found'}`,
    };
  }

  // 2. Re-check schedule status
  if (schedule.status !== 'active') {
    logger.info(`[RecurringInvoice] Schedule ${scheduleId} is no longer active (status=${schedule.status}). Skipping.`, {
      workspaceId,
    });
    return { success: true };
  }

  // 3. Compute Issue & Due Dates
  const scheduledDate = new Date(schedule.next_run_at);
  const issueDateStr = formatIsoDateOnly(scheduledDate);
  const dueDays = schedule.due_in_days || 14;
  const dueDateObj = new Date(scheduledDate.getTime() + dueDays * 24 * 60 * 60 * 1000);
  const dueDateStr = formatIsoDateOnly(dueDateObj);

  const template = schedule.template || {};
  const items = Array.isArray(template.items) ? template.items : [];

  // 4. Generate the invoice via the shared core invoice service
  const createResult = await createInvoiceCore({
    workspaceId: schedule.workspace_id,
    userId: schedule.created_by,
    clientId: schedule.client_id,
    projectId: schedule.project_id,
    status: schedule.auto_send ? 'sent' : 'draft',
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    currency: schedule.currency || 'USD',
    items,
    taxPercentage: template.taxPercentage,
    taxName: template.taxName,
    discount: template.discount,
    notes: template.notes,
    paymentInstructions: template.paymentInstructions,
    recurringScheduleId: schedule.id,
    recurrencePeriodKey: periodKey,
  });

  if (!createResult.success && !createResult.deduped) {
    // If client is archived, pause schedule and notify owner
    if (createResult.errorCode === 'CLIENT_ARCHIVED') {
      await supabaseAdmin
        .from('recurring_invoice_schedules')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule.id);

      logger.warn(`[RecurringInvoice] Paused schedule ${schedule.id} because client is archived.`, {
        workspaceId,
      });
      return { success: true };
    }

    return {
      success: false,
      error: createResult.error || 'Failed to generate recurring invoice',
    };
  }

  // 5. Catch-up policy & Schedule advancement
  // If the server was down for multiple periods, generate at most ONE invoice
  // and advance next_run_at until it is in the future.
  const now = new Date();
  const currentCount = (schedule.occurrences_count || 0) + 1;
  let nextRun = computeNextRunAt(
    {
      frequency: schedule.frequency,
      intervalDays: schedule.interval_days,
      anchorDate: schedule.anchor_date,
      dayOfMonth: schedule.day_of_month,
      timezone: schedule.timezone,
      endsOn: schedule.ends_on,
      maxOccurrences: schedule.max_occurrences,
      occurrencesCount: currentCount,
    },
    scheduledDate
  );

  let skippedPeriods = 0;
  while (nextRun && nextRun.getTime() <= now.getTime()) {
    nextRun = computeNextRunAt(
      {
        frequency: schedule.frequency,
        intervalDays: schedule.interval_days,
        anchorDate: schedule.anchor_date,
        dayOfMonth: schedule.day_of_month,
        timezone: schedule.timezone,
        endsOn: schedule.ends_on,
        maxOccurrences: schedule.max_occurrences,
        occurrencesCount: currentCount + skippedPeriods + 1,
      },
      nextRun
    );
    skippedPeriods++;
  }

  const nextStatus = nextRun === null ? 'completed' : 'active';
  const nowIso = now.toISOString();

  await supabaseAdmin
    .from('recurring_invoice_schedules')
    .update({
      occurrences_count: currentCount,
      last_run_at: nowIso,
      next_run_at: nextRun ? nextRun.toISOString() : schedule.next_run_at,
      status: nextStatus,
      updated_at: nowIso,
    })
    .eq('id', schedule.id);

  if (skippedPeriods > 0) {
    logger.info(`[RecurringInvoice] Catch-up policy skipped ${skippedPeriods} overdue periods for schedule ${schedule.id}`, {
      workspaceId,
    });
  }

  // 6. Enqueue send_invoice job if auto_send is true and invoice was freshly generated
  if (schedule.auto_send && createResult.invoice?.id && !createResult.deduped) {
    await enqueueJob({
      type: 'send_invoice',
      workspaceId: schedule.workspace_id,
      payload: {
        invoiceId: createResult.invoice.id,
      },
      dedupeKey: `send_invoice:${createResult.invoice.id}`,
    });
  }

  return { success: true };
};
