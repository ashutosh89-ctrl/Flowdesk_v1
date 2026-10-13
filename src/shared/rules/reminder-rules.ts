/**
 * Pure Business Rules: Automated Payment Reminders
 *
 * ZERO I/O: Deterministic evaluation of reminder stop conditions, stage tone,
 * quiet hours window enforcement, and boundary rules.
 */

export interface ReminderSettingsRuleInput {
  enabled: boolean;
  sendBeforeDue: boolean;
  daysBeforeDue: number;
  sendOnDueDate: boolean;
  sendAfterDue: boolean;
  daysAfterDue: number[];
  maxRemindersPerInvoice: number;
  quietHoursStart: string; // e.g. "20:00"
  quietHoursEnd: string;   // e.g. "08:00"
  weekdaysOnly: boolean;
  timezone?: string;
}

export interface ReminderInvoiceInput {
  id: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string | Date;
  clientEmail?: string | null;
  clientArchived?: boolean;
  workspaceRemindersEnabled?: boolean;
  planEntitled?: boolean;
}

export type ReminderStage = 'before_due' | 'due_date' | 'after_due';

export interface ReminderDecision {
  shouldSend: boolean;
  ruleKey?: string;
  stage?: ReminderStage;
  reason?: string;
  remainingBalance?: number;
}

/**
 * Parses time string "HH:MM" into total minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = (timeStr || '').split(':').map((s) => parseInt(s.trim(), 10));
  const hours = isNaN(parts[0]) ? 0 : parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  return (hours * 60 + minutes) % 1440;
}

/**
 * Checks whether a given timestamp falls into quiet hours or non-weekday windows.
 */
export function isDeliveryBlockedBySchedule(
  date: Date,
  settings: {
    quietHoursStart: string;
    quietHoursEnd: string;
    weekdaysOnly: boolean;
  }
): { blocked: boolean; reason?: 'quiet_hours' | 'weekend' } {
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (settings.weekdaysOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return { blocked: true, reason: 'weekend' };
  }

  const currentMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const startMinutes = parseTimeToMinutes(settings.quietHoursStart);
  const endMinutes = parseTimeToMinutes(settings.quietHoursEnd);

  // If start < end (e.g. 01:00 to 06:00)
  if (startMinutes < endMinutes) {
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return { blocked: true, reason: 'quiet_hours' };
    }
  } else if (startMinutes > endMinutes) {
    // Overnight quiet hours (e.g. 20:00 to 08:00)
    if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
      return { blocked: true, reason: 'quiet_hours' };
    }
  }

  return { blocked: false };
}

/**
 * Computes calendar day difference (targetDate - baseDate) in whole days.
 */
export function getCalendarDayDiff(targetDate: Date, baseDate: Date): number {
  const utcTarget = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
  const utcBase = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((utcTarget - utcBase) / msPerDay);
}

/**
 * Pure decision engine: determines whether an automated payment reminder should be sent.
 */
export function decideReminders(
  invoice: ReminderInvoiceInput,
  settings: ReminderSettingsRuleInput,
  nowInput: Date | string = new Date(),
  alreadySentRuleKeys: string[] = []
): ReminderDecision {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);

  // 1. Workspace enabled check
  if (!settings.enabled || invoice.workspaceRemindersEnabled === false) {
    return { shouldSend: false, reason: 'reminders_disabled' };
  }

  // 2. Plan Entitlement check (e.g. Free plan does not have automated reminders)
  if (invoice.planEntitled === false) {
    return { shouldSend: false, reason: 'plan_not_entitled' };
  }

  // 3. Invoice lifecycle state: Only sent or viewed invoices are eligible
  const eligibleStatuses = ['sent', 'viewed'];
  if (!eligibleStatuses.includes(invoice.status)) {
    return { shouldSend: false, reason: `invoice_status_not_eligible: ${invoice.status}` };
  }

  // 4. Financial settlement check: Paid or zero balance stops reminders
  const total = Number(invoice.totalAmount) || 0;
  const paid = Number(invoice.paidAmount) || 0;
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);

  if (remaining <= 0 || paid >= total) {
    return { shouldSend: false, reason: 'invoice_fully_paid' };
  }

  // 5. Client accessibility check
  if (invoice.clientArchived || !invoice.clientEmail || !invoice.clientEmail.includes('@')) {
    return { shouldSend: false, reason: 'client_archived_or_missing_email' };
  }

  // 6. Max reminders limit check
  const maxLimit = Math.max(1, settings.maxRemindersPerInvoice || 5);
  if (alreadySentRuleKeys.length >= maxLimit) {
    return { shouldSend: false, reason: 'max_reminders_reached' };
  }

  // 7. Time & day delivery window (Quiet hours / weekend)
  const windowCheck = isDeliveryBlockedBySchedule(now, settings);
  if (windowCheck.blocked) {
    return { shouldSend: false, reason: windowCheck.reason };
  }

  // 8. Day boundary rule matching
  // diffDays > 0 means past due date; diffDays === 0 is due date; diffDays < 0 is before due date
  const diffDays = getCalendarDayDiff(now, dueDate);

  let candidateRuleKey: string | null = null;
  let stage: ReminderStage | undefined;

  if (diffDays < 0) {
    // Upcoming milestone
    const daysBefore = Math.abs(diffDays);
    if (settings.sendBeforeDue && daysBefore === settings.daysBeforeDue) {
      candidateRuleKey = `before_due_${daysBefore}d`;
      stage = 'before_due';
    }
  } else if (diffDays === 0) {
    // Due today
    if (settings.sendOnDueDate) {
      candidateRuleKey = 'on_due_date';
      stage = 'due_date';
    }
  } else {
    // Overdue
    const daysAfter = diffDays;
    if (settings.sendAfterDue && settings.daysAfterDue.includes(daysAfter)) {
      candidateRuleKey = `after_due_${daysAfter}d`;
      stage = 'after_due';
    }
  }

  if (!candidateRuleKey || !stage) {
    return { shouldSend: false, reason: 'no_rule_matched_for_day' };
  }

  // 9. Deduplication check against already sent rules
  if (alreadySentRuleKeys.includes(candidateRuleKey)) {
    return { shouldSend: false, ruleKey: candidateRuleKey, reason: 'rule_already_sent' };
  }

  return {
    shouldSend: true,
    ruleKey: candidateRuleKey,
    stage,
    remainingBalance: remaining,
  };
}
