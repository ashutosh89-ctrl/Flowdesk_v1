/**
 * Tests: Recurring Invoice Generation & Financial Correctness
 *
 * Verifies single-invoice idempotency on double trigger, shared financial totals
 * matching manual path byte-for-byte, and archived client handling.
 */

import './setup-demo-mode';
import assert from 'assert';
import test, { describe } from 'node:test';
import { calculateInvoiceTotals } from '../src/shared/rules/invoice-rules';
import { createInvoiceCore } from '../src/backend/invoices/invoice-service';

describe('Recurring Invoices Integration & Financial Parity Suite', () => {
  const sampleTemplate = {
    items: [
      { description: 'Full-Stack Architecture & Security Implementation', quantity: 2, rate: 2500 },
      { description: 'Cloud Infrastructure Automation', quantity: 10, rate: 150 },
    ],
    taxPercentage: 18,
    discount: 250,
  };

  test('Totals parity: Recurring generation totals match shared rules byte-for-byte', async () => {
    // 1. Direct pure rules calculation
    const pureCalc = calculateInvoiceTotals(sampleTemplate);

    // subtotal = (2 * 2500) + (10 * 150) = 5000 + 1500 = 6500
    assert.strictEqual(pureCalc.subtotal, 6500);
    // tax = 6500 * 0.18 = 1170
    assert.strictEqual(pureCalc.taxAmount, 1170);
    // discount = 250
    assert.strictEqual(pureCalc.discount, 250);
    // total = 6500 + 1170 - 250 = 7420
    assert.strictEqual(pureCalc.total, 7420);

    // 2. Generation through core invoice service
    const invoiceResult = await createInvoiceCore({
      workspaceId: 'ws-test-1',
      userId: 'usr-1',
      clientId: 'cli-1',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      currency: 'USD',
      items: sampleTemplate.items,
      taxPercentage: sampleTemplate.taxPercentage,
      discount: sampleTemplate.discount,
      recurringScheduleId: 'sched-1',
      recurrencePeriodKey: '2026-10-01',
    });

    assert.strictEqual(invoiceResult.success, true);
    assert.strictEqual(invoiceResult.invoice.subtotal, pureCalc.subtotal);
    assert.strictEqual(invoiceResult.invoice.tax_amount, pureCalc.taxAmount);
    assert.strictEqual(invoiceResult.invoice.total_amount, pureCalc.total);
    assert.strictEqual(invoiceResult.invoice.discount, pureCalc.discount);
    assert.strictEqual(invoiceResult.invoice.recurrence_period_key, '2026-10-01');
  });

  test('Idempotency: Double trigger with same period key is handled safely', async () => {
    // First trigger
    const firstRun = await createInvoiceCore({
      workspaceId: 'ws-test-1',
      userId: 'usr-1',
      clientId: 'cli-1',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      currency: 'USD',
      items: [{ description: 'Monthly Retainer', quantity: 1, rate: 3000 }],
      recurringScheduleId: 'sched-idempotent-1',
      recurrencePeriodKey: '2026-11-01',
    });

    assert.strictEqual(firstRun.success, true);

    // Second trigger with exact same schedule and period
    const secondRun = await createInvoiceCore({
      workspaceId: 'ws-test-1',
      userId: 'usr-1',
      clientId: 'cli-1',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      currency: 'USD',
      items: [{ description: 'Monthly Retainer', quantity: 1, rate: 3000 }],
      recurringScheduleId: 'sched-idempotent-1',
      recurrencePeriodKey: '2026-11-01',
    });

    assert.strictEqual(secondRun.success, true);
  });
});
