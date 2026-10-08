/**
 * Tests: Reminder Rules (Pure Business Rules)
 *
 * Verifies stop conditions, quiet hours, stage transitions,
 * deduplication, and partial payment handling.
 */

import assert from 'assert';
import test, { describe } from 'node:test';
import {
  decideReminders,
  isDeliveryBlockedBySchedule,
  getCalendarDayDiff,
  ReminderSettingsRuleInput,
} from '../src/shared/rules/reminder-rules';

describe('Pure Reminder Rules Suite', () => {
  const baseSettings: ReminderSettingsRuleInput = {
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

  test('Calendar day diff calculation', () => {
    const d1 = new Date('2026-10-15T12:00:00.000Z');
    const d2 = new Date('2026-10-12T08:00:00.000Z');
    assert.strictEqual(getCalendarDayDiff(d1, d2), 3);
    assert.strictEqual(getCalendarDayDiff(d2, d1), -3);
    assert.strictEqual(getCalendarDayDiff(d1, d1), 0);
  });

  test('Stage 1: Dispatches before_due_3d reminder 3 days before due date', () => {
    // Due Date: Oct 15. Now: Oct 12 at noon (Monday)
    const now = new Date('2026-10-12T12:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1000,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    const decision = decideReminders(invoice, baseSettings, now, []);
    assert.strictEqual(decision.shouldSend, true);
    assert.strictEqual(decision.ruleKey, 'before_due_3d');
    assert.strictEqual(decision.stage, 'before_due');
    assert.strictEqual(decision.remainingBalance, 1000);
  });

  test('Stage 2: Dispatches on_due_date reminder on exact due date', () => {
    // Due Date: Oct 15. Now: Oct 15 at 10:00 AM (Thursday)
    const now = new Date('2026-10-15T10:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1500,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    const decision = decideReminders(invoice, baseSettings, now, ['before_due_3d']);
    assert.strictEqual(decision.shouldSend, true);
    assert.strictEqual(decision.ruleKey, 'on_due_date');
    assert.strictEqual(decision.stage, 'due_date');
  });

  test('Stage 3: Dispatches overdue reminder after_due_7d with partial payment balance', () => {
    // Due Date: Oct 15. Now: Oct 22 at 14:00 (Thursday = +7 days)
    const now = new Date('2026-10-22T14:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'viewed',
      totalAmount: 2000,
      paidAmount: 500, // partially paid
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    const decision = decideReminders(invoice, baseSettings, now, ['before_due_3d', 'on_due_date']);
    assert.strictEqual(decision.shouldSend, true);
    assert.strictEqual(decision.ruleKey, 'after_due_7d');
    assert.strictEqual(decision.stage, 'after_due');
    assert.strictEqual(decision.remainingBalance, 1500);
  });

  test('Stop condition: Suppressed when invoice is fully paid', () => {
    const now = new Date('2026-10-15T10:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1000,
      paidAmount: 1000,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    const decision = decideReminders(invoice, baseSettings, now, []);
    assert.strictEqual(decision.shouldSend, false);
    assert.strictEqual(decision.reason, 'invoice_fully_paid');
  });

  test('Stop condition: Suppressed for draft or cancelled invoices', () => {
    const now = new Date('2026-10-15T10:00:00.000Z');
    const draftInvoice = {
      id: 'inv-1',
      status: 'draft',
      totalAmount: 1000,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    const decisionDraft = decideReminders(draftInvoice, baseSettings, now, []);
    assert.strictEqual(decisionDraft.shouldSend, false);

    const cancelledInvoice = { ...draftInvoice, status: 'cancelled' };
    const decisionCancelled = decideReminders(cancelledInvoice, baseSettings, now, []);
    assert.strictEqual(decisionCancelled.shouldSend, false);
  });

  test('Stop condition: Suppressed when plan does not have emailReminders entitlement', () => {
    const now = new Date('2026-10-15T10:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1000,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
      planEntitled: false,
    };

    const decision = decideReminders(invoice, baseSettings, now, []);
    assert.strictEqual(decision.shouldSend, false);
    assert.strictEqual(decision.reason, 'plan_not_entitled');
  });

  test('Stop condition: Suppressed when client is archived or missing email', () => {
    const now = new Date('2026-10-15T10:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1000,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
      clientArchived: true,
    };

    const decision = decideReminders(invoice, baseSettings, now, []);
    assert.strictEqual(decision.shouldSend, false);
    assert.strictEqual(decision.reason, 'client_archived_or_missing_email');
  });

  test('Stop condition: Suppressed when max reminders limit is reached', () => {
    const now = new Date('2026-10-15T10:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1000,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    // Already 5 reminders sent
    const alreadySent = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'];
    const decision = decideReminders(invoice, baseSettings, now, alreadySent);
    assert.strictEqual(decision.shouldSend, false);
    assert.strictEqual(decision.reason, 'max_reminders_reached');
  });

  test('Stop condition: Idempotency deduplication suppresses already sent rule', () => {
    const now = new Date('2026-10-15T10:00:00.000Z');
    const invoice = {
      id: 'inv-1',
      status: 'sent',
      totalAmount: 1000,
      paidAmount: 0,
      dueDate: '2026-10-15T00:00:00.000Z',
      clientEmail: 'client@example.com',
    };

    // 'on_due_date' already sent
    const decision = decideReminders(invoice, baseSettings, now, ['on_due_date']);
    assert.strictEqual(decision.shouldSend, false);
    assert.strictEqual(decision.reason, 'rule_already_sent');
  });

  test('Delivery window: Suppressed during quiet hours and on weekends', () => {
    // 23:00 UTC (quiet hours: 20:00 - 08:00)
    const lateNight = new Date('2026-10-15T23:00:00.000Z');
    const quietCheck = isDeliveryBlockedBySchedule(lateNight, baseSettings);
    assert.strictEqual(quietCheck.blocked, true);
    assert.strictEqual(quietCheck.reason, 'quiet_hours');

    // Sunday (Oct 18, 2026)
    const sunday = new Date('2026-10-18T12:00:00.000Z');
    const weekendCheck = isDeliveryBlockedBySchedule(sunday, baseSettings);
    assert.strictEqual(weekendCheck.blocked, true);
    assert.strictEqual(weekendCheck.reason, 'weekend');
  });
});
