/**
 * Background Sweeper
 *
 * Scans for due recurring invoice schedules, due payment reminders,
 * and expired worker leases, enqueuing deduplicated background jobs.
 */

import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { generatePeriodKey } from '@/shared/rules/recurring-rules';
import { decideReminders, ReminderSettingsRuleInput } from '@/shared/rules/reminder-rules';
import { enqueueJob } from './queue';

export interface SweeperSummary {
  dueSchedulesFound: number;
  scheduleJobsEnqueued: number;
  dueRemindersFound: number;
  reminderJobsEnqueued: number;
  stalledLeasesReclaimed: number;
  isDryRun: boolean;
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettingsRuleInput = {
  enabled: true,
  sendBeforeDue: true,
  daysBeforeDue: 3,
  sendOnDueDate: true,
  sendAfterDue: true,
  daysAfterDue: [3, 7, 14],
  maxRemindersPerInvoice: 5,
  quietHoursStart: '20:00',
  quietHoursEnd: '08:00',
  weekdaysOnly: true,
};

export async function runSweeper(isDryRun: boolean = false): Promise<SweeperSummary> {
  const summary: SweeperSummary = {
    dueSchedulesFound: 0,
    scheduleJobsEnqueued: 0,
    dueRemindersFound: 0,
    reminderJobsEnqueued: 0,
    stalledLeasesReclaimed: 0,
    isDryRun,
  };

  // Check Kill Switch Environment Variables
  const enableRecurring = process.env.ENABLE_RECURRING_INVOICES !== 'false';
  const enableReminders = process.env.ENABLE_AUTOMATED_REMINDERS !== 'false';

  if (!supabaseAdmin || isDemoModeActive()) {
    return summary;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // ============================================================================
  // 1. RECURRING INVOICE SCHEDULE SWEEPER
  // ============================================================================
  if (enableRecurring) {
    try {
      const { data: dueSchedules, error: schedError } = await supabaseAdmin
        .from('recurring_invoice_schedules')
        .select('id, workspace_id, frequency, day_of_month, next_run_at')
        .eq('status', 'active')
        .lte('next_run_at', nowIso)
        .limit(50);

      if (schedError) {
        logger.error(`[Sweeper] Failed to query due recurring schedules: ${schedError.message}`, schedError);
      } else if (dueSchedules && dueSchedules.length > 0) {
        summary.dueSchedulesFound = dueSchedules.length;

        for (const sched of dueSchedules) {
          const periodKey = generatePeriodKey(
            { frequency: sched.frequency, dayOfMonth: sched.day_of_month },
            sched.next_run_at
          );
          const dedupeKey = `recurring:${sched.id}:${periodKey}`;

          if (!isDryRun) {
            const enqRes = await enqueueJob({
              type: 'generate_recurring_invoice',
              workspaceId: sched.workspace_id,
              payload: {
                scheduleId: sched.id,
                periodKey,
              },
              dedupeKey,
            });

            if (enqRes.success && !enqRes.deduped) {
              summary.scheduleJobsEnqueued++;
            }
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Sweeper] Error in recurring schedule sweep: ${err?.message}`, err);
    }
  }

  // ============================================================================
  // 2. AUTOMATED INVOICE PAYMENT REMINDER SWEEPER
  // ============================================================================
  if (enableReminders) {
    try {
      // Find candidate unpaid invoices that are sent or viewed
      const { data: unpaidInvoices, error: invError } = await supabaseAdmin
        .from('invoices')
        .select(`
          id,
          workspace_id,
          client_id,
          status,
          total_amount,
          paid_amount,
          due_date,
          client_email
        `)
        .in('status', ['sent', 'viewed'])
        .not('due_date', 'is', null)
        .limit(100);

      if (invError) {
        logger.error(`[Sweeper] Failed to query candidate invoices for reminders: ${invError.message}`, invError);
      } else if (unpaidInvoices && unpaidInvoices.length > 0) {
        // Filter out fully paid invoices
        const remindableInvoices = unpaidInvoices.filter(
          (inv) => (Number(inv.total_amount) || 0) > (Number(inv.paid_amount) || 0)
        );

        for (const inv of remindableInvoices) {
          // Fetch workspace reminder settings
          const { data: wsSettings } = await supabaseAdmin
            .from('reminder_settings')
            .select('*')
            .eq('workspace_id', inv.workspace_id)
            .maybeSingle();

          const settings: ReminderSettingsRuleInput = wsSettings
            ? {
                enabled: wsSettings.enabled ?? true,
                sendBeforeDue: wsSettings.send_before_due ?? true,
                daysBeforeDue: wsSettings.days_before_due ?? 3,
                sendOnDueDate: wsSettings.send_on_due_date ?? true,
                sendAfterDue: wsSettings.send_after_due ?? true,
                daysAfterDue: wsSettings.days_after_due ?? [3, 7, 14],
                maxRemindersPerInvoice: wsSettings.max_reminders_per_invoice ?? 5,
                quietHoursStart: wsSettings.quiet_hours_start ?? '20:00',
                quietHoursEnd: wsSettings.quiet_hours_end ?? '08:00',
                weekdaysOnly: wsSettings.weekdays_only ?? true,
              }
            : DEFAULT_REMINDER_SETTINGS;

          // Fetch already sent reminder rule keys for this invoice
          const { data: sentLogs } = await supabaseAdmin
            .from('reminder_log')
            .select('rule_key')
            .eq('invoice_id', inv.id);

          const alreadySentRuleKeys = (sentLogs || []).map((l) => l.rule_key);

          // Evaluate pure reminder rules
          const decision = decideReminders(
            {
              id: inv.id,
              status: inv.status,
              totalAmount: Number(inv.total_amount) || 0,
              paidAmount: Number(inv.paid_amount) || 0,
              dueDate: inv.due_date,
              clientEmail: inv.client_email,
            },
            settings,
            now,
            alreadySentRuleKeys
          );

          if (decision.shouldSend && decision.ruleKey) {
            summary.dueRemindersFound++;
            const dedupeKey = `reminder:${inv.id}:${decision.ruleKey}`;

            if (!isDryRun) {
              const enqRes = await enqueueJob({
                type: 'send_invoice_reminder',
                workspaceId: inv.workspace_id,
                payload: {
                  invoiceId: inv.id,
                  ruleKey: decision.ruleKey,
                  stage: decision.stage,
                },
                dedupeKey,
              });

              if (enqRes.success && !enqRes.deduped) {
                summary.reminderJobsEnqueued++;
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.error(`[Sweeper] Error in payment reminder sweep: ${err?.message}`, err);
    }
  }

  // ============================================================================
  // 3. STALLED LEASE SWEEPER
  // ============================================================================
  try {
    const { count: stalledCount, error: stallError } = await supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running')
      .lt('locked_until', nowIso);

    if (!stallError && stalledCount) {
      summary.stalledLeasesReclaimed = stalledCount;
      if (!isDryRun) {
        await supabaseAdmin
          .from('jobs')
          .update({
            status: 'queued',
            locked_by: null,
            locked_until: null,
            updated_at: nowIso,
          })
          .eq('status', 'running')
          .lt('locked_until', nowIso);
      }
    }
  } catch (err: any) {
    logger.warn(`[Sweeper] Error checking stalled worker leases: ${err?.message}`);
  }

  return summary;
}
