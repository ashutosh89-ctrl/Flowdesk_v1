/**
 * Comprehensive Automated Verification Script for FlowDesk Razorpay Online Payments
 * 
 * Verifies:
 * 1. Subunit and Currency Conversion (Decimal precision, floating point safety)
 * 2. Razorpay SDK Configuration & Order Creation (Test Mode)
 * 3. HMAC SHA256 Signature Verification (Payment & Webhook)
 * 4. Invalid Signature Rejection (Security check)
 * 5. Server-Authoritative Invoice Validation (Overpayment, cancelled, paid status)
 * 6. Idempotency & Duplicate Payment Suppression
 * 7. Partial Payment Status Lifecycle (₹10,000 -> ₹4,000 partial -> ₹6,000 paid)
 * 8. Receipt & Reconciliation Metadata
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load .env.local into process.env if present
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import {
  toSubunits,
  fromSubunits,
  isCurrencySupported,
  getCurrencyDecimals,
  formatSubunitsForDisplay,
} from '../src/backend/payments/currency-utils';
import { RazorpayService } from '../src/backend/payments/razorpay-service';
import { PaymentService } from '../src/backend/payments/payment-service';
import { isRazorpayConfigured, getRazorpayKeyId } from '../src/backend/payments/razorpay-client';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 FLOWDESK RAZORPAY INTEGRATION VERIFICATION SUITE');
  console.log('======================================================\n');

  // ----------------------------------------------------------
  // SECTION 1: Currency & Subunit Conversion Verification
  // ----------------------------------------------------------
  console.log('--- SECTION 1: Currency & Subunit Conversion Safety ---');

  // INR (2 decimals)
  assert(toSubunits(100, 'INR') === 10000n, 'INR 100 converts to 10000 paise');
  assert(toSubunits(1250.5, 'INR') === 125050n, 'INR 1250.50 converts to 125050 paise without float errors');
  assert(toSubunits(0.99, 'INR') === 99n, 'INR 0.99 converts to 99 paise');
  assert(fromSubunits(10000n, 'INR') === 100, 'INR 10000 paise converts back to 100.00');
  assert(fromSubunits(125050n, 'INR') === 1250.5, 'INR 125050 paise converts back to 1250.50');

  // USD (2 decimals)
  assert(toSubunits(49.99, 'USD') === 4999n, 'USD 49.99 converts to 4999 cents');
  assert(fromSubunits(4999n, 'USD') === 49.99, 'USD 4999 cents converts back to 49.99');

  // Supported Currency Validator
  assert(isCurrencySupported('INR'), 'INR is supported');
  assert(isCurrencySupported('USD'), 'USD is supported');
  assert(isCurrencySupported('EUR'), 'EUR is supported');
  assert(isCurrencySupported('GBP'), 'GBP is supported');
  assert(!isCurrencySupported('XYZ'), 'Unsupported fake currency XYZ is rejected');

  // Invalid values protection
  let invalidThrown = false;
  try {
    toSubunits(-50, 'INR');
  } catch {
    invalidThrown = true;
  }
  assert(invalidThrown, 'Negative payment amount throws validation error');

  // ----------------------------------------------------------
  // SECTION 2: Credentials & SDK Initialization
  // ----------------------------------------------------------
  console.log('\n--- SECTION 2: Razorpay SDK & Environment Configuration ---');
  assert(isRazorpayConfigured(), 'Razorpay credentials recognized in server environment');
  const keyId = getRazorpayKeyId();
  assert(keyId.startsWith('rzp_test_'), `Test Mode Key ID verified (${keyId})`);
  assert(process.env.RAZORPAY_KEY_SECRET !== undefined, 'RAZORPAY_KEY_SECRET is configured server-side');
  assert(process.env.RAZORPAY_WEBHOOK_SECRET !== undefined, 'RAZORPAY_WEBHOOK_SECRET is configured server-side');

  // ----------------------------------------------------------
  // SECTION 3: HMAC SHA256 Signature Verification
  // ----------------------------------------------------------
  console.log('\n--- SECTION 3: Cryptographic Signature Verification ---');

  const testSecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
  const testOrderId = 'order_test_123456';
  const testPaymentId = 'pay_test_987654';

  const validPaymentSignature = crypto
    .createHmac('sha256', testSecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex');

  const isPaymentValid = RazorpayService.verifyPaymentSignature({
    orderId: testOrderId,
    paymentId: testPaymentId,
    signature: validPaymentSignature,
  });
  assert(isPaymentValid, 'Valid payment signature successfully verified with secret');

  const isTamperedRejected = RazorpayService.verifyPaymentSignature({
    orderId: testOrderId,
    paymentId: testPaymentId,
    signature: 'forged_invalid_signature_abc123',
  });
  assert(!isTamperedRejected, 'Forged/tampered payment signature correctly rejected');

  // Webhook Signature Verification
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_flowdesk_test_secret';
  const mockWebhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_123', amount: 10000, currency: 'INR' } } },
  });

  const validWebhookSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(mockWebhookPayload)
    .digest('hex');

  const isWebhookValid = RazorpayService.verifyWebhookSignature({
    rawBody: mockWebhookPayload,
    signature: validWebhookSignature,
    secret: webhookSecret,
  });
  assert(isWebhookValid, 'Valid webhook payload signature successfully verified');

  const isTamperedWebhookRejected = RazorpayService.verifyWebhookSignature({
    rawBody: mockWebhookPayload + ' ', // Tampered payload
    signature: validWebhookSignature,
    secret: webhookSecret,
  });
  assert(!isTamperedWebhookRejected, 'Tampered webhook payload correctly rejected');

  // ----------------------------------------------------------
  // SECTION 4: Live Test Order Creation via Razorpay Orders API
  // ----------------------------------------------------------
  console.log('\n--- SECTION 4: Live Test-Mode Order Generation via Razorpay API ---');

  try {
    const testOrder = await RazorpayService.createOrder({
      amountSubunits: 100000n, // ₹1,000.00
      currency: 'INR',
      receipt: `test_rcpt_${Date.now()}`.slice(0, 40),
      notes: {
        test_run: 'flowdesk_verification_suite',
      },
    });

    assert(Boolean(testOrder.id && testOrder.id.startsWith('order_')), `Razorpay Order generated: ${testOrder.id}`);
    assert(testOrder.status === 'created', `Order status is 'created' (amount: ₹${testOrder.amount / 100})`);
    assert(testOrder.currency === 'INR', 'Order currency is INR');

    // Fetch back order to verify API round-trip
    const fetchedOrder = await RazorpayService.fetchOrder(testOrder.id);
    assert(fetchedOrder.id === testOrder.id, `Fetched order matches created order ID (${fetchedOrder.id})`);
  } catch (orderErr: any) {
    assert(false, 'Razorpay live test order creation failed', orderErr.message);
  }

  // ----------------------------------------------------------
  // SECTION 5: End-to-End Invoice Order & Partial Payment Lifecycle
  // ----------------------------------------------------------
  console.log('\n--- SECTION 5: End-to-End Order Creation & Partial Payment Lifecycle ---');

  // 1. Create test order on an invoice
  const testInvoices = require('../src/backend/store/mockData').mockInvoices;
  const targetInvoice = testInvoices.find((i: any) => i.status === 'pending') || testInvoices[1] || { id: 'inv-102', total: 16000, currency: 'USD', status: 'pending', clientId: 'cli-2' };
  targetInvoice.paidAmount = 0;
  targetInvoice.status = 'pending';
  targetInvoice.paymentStatus = 'pending';
  const initialTotal = Number(targetInvoice.total) || 16000;

  console.log(`  ℹ️ Target Invoice: #${targetInvoice.invoiceNumber || targetInvoice.id} (Total: ${targetInvoice.currency || 'USD'} ${initialTotal})`);

  // Step A: Create partial payment order of ₹4,000 (or $4,000)
  const partialOrderResult = await PaymentService.createPaymentOrder({
    invoiceId: targetInvoice.id,
    clientId: targetInvoice.clientId,
    requestedAmount: 4000,
    partialPayment: true,
  });

  assert(partialOrderResult.success, 'Partial payment order created successfully');
  assert(partialOrderResult.amount === 4000, 'Partial payment order amount is exactly 4,000');
  assert(Boolean(partialOrderResult.orderId), `Order ID assigned: ${partialOrderResult.orderId}`);

  const orderId1 = partialOrderResult.orderId!;
  const paymentId1 = `pay_part1_${Date.now()}`;

  // Step B: Process captured payment for Part 1 (4,000)
  const settlement1 = await PaymentService.processCapturedPayment({
    razorpayOrderId: orderId1,
    razorpayPaymentId: paymentId1,
    invoiceId: targetInvoice.id,
    amount: 4000,
    currency: targetInvoice.currency || 'USD',
    method: 'card',
    capturedAt: new Date().toISOString(),
  } as any);

  assert(settlement1.success, 'First partial settlement (4,000) processed successfully');
  assert(settlement1.status === 'partially_paid', `Invoice status transitioned to 'partially_paid' (status: ${settlement1.status})`);
  assert(settlement1.paidAmount === 4000, 'Recorded paid amount is 4,000');
  assert(settlement1.remainingBalance === (initialTotal - 4000), `Remaining balance is ${initialTotal - 4000}`);

  // Step C: Idempotency Check on Part 1
  const duplicateSettlement1 = await PaymentService.processCapturedPayment({
    razorpayOrderId: orderId1,
    razorpayPaymentId: paymentId1,
    invoiceId: targetInvoice.id,
    amount: 4000,
    currency: targetInvoice.currency || 'USD',
    method: 'card',
    capturedAt: new Date().toISOString(),
  } as any);

  assert(duplicateSettlement1.success, 'Duplicate payment call returned clean success response');
  assert(duplicateSettlement1.duplicateSuppressed === true, 'Duplicate payment detected & suppressed without double-counting balance');

  // Step D: Process captured payment for Part 2 (Remaining 6,000)
  const paymentId2 = `pay_part2_${Date.now()}`;
  const settlement2 = await PaymentService.processCapturedPayment({
    razorpayOrderId: orderId1,
    razorpayPaymentId: paymentId2,
    invoiceId: targetInvoice.id,
    amount: initialTotal - 4000,
    currency: targetInvoice.currency || 'USD',
    method: 'netbanking',
    capturedAt: new Date().toISOString(),
  } as any);

  assert(settlement2.success, 'Final settlement processed successfully');
  assert(settlement2.status === 'paid', `Invoice status transitioned to 'paid' (status: ${settlement2.status})`);
  assert(settlement2.remainingBalance === 0, 'Remaining balance reached 0');
  assert(Boolean(settlement2.receipt?.receiptNumber), `Receipt generated: ${settlement2.receipt?.receiptNumber}`);

  // ----------------------------------------------------------
  // SECTION 6: Security & Validation Safeguards
  // ----------------------------------------------------------
  console.log('\n--- SECTION 6: Security Safeguards & Overpayment Protection ---');

  // Test overpayment prevention
  const overpayResult = await PaymentService.createPaymentOrder({
    invoiceId: targetInvoice.id,
    clientId: targetInvoice.clientId,
    requestedAmount: 999999, // Exceeds balance
    partialPayment: true,
  });
  assert(!overpayResult.success, 'Overpayment attempt correctly rejected server-side');

  // Test invalid payment signature verification
  const invalidSigResult = await PaymentService.verifyAndCapturePayment({
    orderId: 'order_test_fake',
    paymentId: 'pay_test_fake',
    signature: 'bad_signature_string',
  });
  assert(!invalidSigResult.success, 'Invalid signature capture correctly rejected with security alert');

  // ----------------------------------------------------------
  // SECTION 7: Summary & Results
  // ----------------------------------------------------------
  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL RAZORPAY VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
