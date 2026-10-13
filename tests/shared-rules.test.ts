import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionInvoiceWorkflow,
  canTransitionInvoicePayment,
  calculateInvoiceTotals,
  calculateRemainingBalance,
  derivePaymentStatus,
  formatInvoiceNumber,
  canTransitionDeliverableStatus,
  canApproveDeliverable,
  canRequestDeliverableRevision,
  canSubmitDeliverable,
} from '../src/shared/rules';

test('Shared Rules: Invoice Workflow Transitions', async (t) => {
  await t.test('allows freelancer to transition draft -> sent and draft -> cancelled', () => {
    assert.equal(canTransitionInvoiceWorkflow('draft', 'sent', 'freelancer').allowed, true);
    assert.equal(canTransitionInvoiceWorkflow('draft', 'cancelled', 'freelancer').allowed, true);
  });

  await t.test('blocks client from transitioning draft -> sent', () => {
    const res = canTransitionInvoiceWorkflow('draft', 'sent', 'client');
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /not authorized/);
  });

  await t.test('allows client to record invoice view (sent -> viewed)', () => {
    assert.equal(canTransitionInvoiceWorkflow('sent', 'viewed', 'client').allowed, true);
    assert.equal(canTransitionInvoiceWorkflow('sent', 'viewed', 'freelancer').allowed, true);
    assert.equal(canTransitionInvoiceWorkflow('sent', 'viewed', 'system').allowed, true);
  });

  await t.test('blocks reviving cancelled invoice (cancelled -> draft)', () => {
    const res = canTransitionInvoiceWorkflow('cancelled', 'draft', 'freelancer');
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /Cannot transition/);
  });

  await t.test('handles idempotent self-transition', () => {
    assert.equal(canTransitionInvoiceWorkflow('sent', 'sent', 'freelancer').allowed, true);
    assert.equal(canTransitionInvoiceWorkflow('draft', 'draft', 'client').allowed, true);
  });

  await t.test('rejects unknown status strings gracefully', () => {
    assert.equal(canTransitionInvoiceWorkflow('nonexistent', 'sent').allowed, false);
    assert.equal(canTransitionInvoiceWorkflow('draft', 'invalid').allowed, false);
  });
});

test('Shared Rules: Invoice Payment Transitions', async (t) => {
  await t.test('allows normal payment state progression', () => {
    assert.equal(canTransitionInvoicePayment('pending', 'partially_paid', 'system').allowed, true);
    assert.equal(canTransitionInvoicePayment('partially_paid', 'paid', 'system').allowed, true);
    assert.equal(canTransitionInvoicePayment('paid', 'refunded', 'system').allowed, true);
  });

  await t.test('blocks client from self-marking payment as paid', () => {
    const res = canTransitionInvoicePayment('pending', 'paid', 'client');
    assert.equal(res.allowed, false);
    assert.match(res.reason || '', /Clients cannot/);
  });

  await t.test('blocks invalid transition from refunded -> pending', () => {
    const res = canTransitionInvoicePayment('refunded', 'pending', 'system');
    assert.equal(res.allowed, false);
  });
});

test('Shared Rules: Pure Invoice Totals Calculation', async (t) => {
  await t.test('calculates basic line items with tax and discount', () => {
    const res = calculateInvoiceTotals({
      items: [
        { quantity: 2, rate: 100 }, // 200
        { quantity: 1, rate: 50 },  // 50
      ],
      taxPercentage: 10, // 25
      discount: 20,      // clamped to subtotal
    });

    assert.equal(res.subtotal, 250);
    assert.equal(res.taxAmount, 25);
    assert.equal(res.discount, 20);
    assert.equal(res.total, 255); // 250 + 25 - 20
    assert.deepEqual(res.lineAmounts, [200, 50]);
  });

  await t.test('preserves 0% tax rate accurately', () => {
    const res = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 100 }],
      taxPercentage: 0,
    });
    assert.equal(res.subtotal, 100);
    assert.equal(res.taxPercentage, 0);
    assert.equal(res.taxAmount, 0);
    assert.equal(res.total, 100);
  });

  await t.test('clamps discount to never exceed subtotal', () => {
    const res = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 50 }],
      discount: 1000, // exceeds subtotal 50
    });
    assert.equal(res.subtotal, 50);
    assert.equal(res.discount, 50);
    assert.equal(res.total, 0);
  });

  await t.test('handles negative discount gracefully', () => {
    const res = calculateInvoiceTotals({
      items: [{ quantity: 1, rate: 50 }],
      discount: -50,
    });
    assert.equal(res.discount, 0);
    assert.equal(res.total, 50);
  });

  await t.test('calculates remaining balance correctly', () => {
    assert.equal(calculateRemainingBalance(100, 40), 60);
    assert.equal(calculateRemainingBalance(100, 100), 0);
    assert.equal(calculateRemainingBalance(100, 150), 0); // overpayment clamped
  });

  await t.test('derives payment status correctly', () => {
    assert.equal(derivePaymentStatus(100, 0), 'pending');
    assert.equal(derivePaymentStatus(100, 50), 'partially_paid');
    assert.equal(derivePaymentStatus(100, 100), 'paid');
    assert.equal(derivePaymentStatus(100, 120), 'paid');
    assert.equal(derivePaymentStatus(0, 0), 'paid');
  });
});

test('Shared Rules: Sequential Invoice Number Formatting', async (t) => {
  await t.test('formats default invoice number with prefix and year', () => {
    const formatted = formatInvoiceNumber(
      { prefix: 'INV', separator: '-', includeYear: true, padding: 4 },
      7,
      2026
    );
    assert.equal(formatted, 'INV-2026-0007');
  });

  await t.test('formats without year when includeYear is false', () => {
    const formatted = formatInvoiceNumber(
      { prefix: 'BILL', separator: '/', includeYear: false, padding: 3 },
      12
    );
    assert.equal(formatted, 'BILL/012');
  });

  await t.test('formats bare sequence when prefix is empty and year is disabled', () => {
    const formatted = formatInvoiceNumber(
      { prefix: '', includeYear: false, padding: 5 },
      42
    );
    assert.equal(formatted, '00042');
  });
});

test('Shared Rules: Deliverable Status Transitions & Approvals', async (t) => {
  await t.test('allows freelancer to submit draft for review', () => {
    assert.equal(canTransitionDeliverableStatus('draft', 'submitted', 'freelancer').allowed, true);
    assert.equal(canSubmitDeliverable('draft', 'freelancer'), true);
  });

  await t.test('blocks client from submitting draft for review', () => {
    assert.equal(canTransitionDeliverableStatus('draft', 'submitted', 'client').allowed, false);
    assert.equal(canSubmitDeliverable('draft', 'client'), false);
  });

  await t.test('allows client to approve submitted or in_review deliverable', () => {
    assert.equal(canTransitionDeliverableStatus('submitted', 'approved', 'client').allowed, true);
    assert.equal(canTransitionDeliverableStatus('in_review', 'approved', 'client').allowed, true);
    assert.equal(canApproveDeliverable('submitted', 'client'), true);
  });

  await t.test('allows client to request revision on submitted deliverable', () => {
    assert.equal(canTransitionDeliverableStatus('submitted', 'revision_requested', 'client').allowed, true);
    assert.equal(canRequestDeliverableRevision('submitted', 'client'), true);
  });

  await t.test('allows freelancer to re-submit deliverable after revision_requested', () => {
    assert.equal(canTransitionDeliverableStatus('revision_requested', 'submitted', 'freelancer').allowed, true);
  });

  await t.test('blocks client from re-submitting deliverable after revision_requested', () => {
    assert.equal(canTransitionDeliverableStatus('revision_requested', 'submitted', 'client').allowed, false);
  });

  await t.test('blocks approving deliverable that is still in draft state', () => {
    const res = canTransitionDeliverableStatus('draft', 'approved', 'client');
    assert.equal(res.allowed, false);
  });
});
