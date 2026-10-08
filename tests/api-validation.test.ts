/**
 * FlowDesk Phase 4A: API Route Validation & Security Controls Test Suite
 * 
 * Verifies strict input validation across route schemas and parseJsonBody helper:
 * 1. Extra fields rejected (.strict() enforcement)
 * 2. Wrong types and negative amounts rejected
 * 3. Oversized request body rejected with size limit enforcement
 * 4. Valid payload accepted and correctly typed
 * 5. Error responses contain machine-readable code and NO echo of raw inputs or schema internals
 * 6. Path parameter validation (UUIDs, tokens, payment IDs)
 */

import assert from 'assert';
import {
  parseJsonBody,
  validateRouteParam,
  uuidSchema,
  tokenParamSchema,
  paymentIdParamSchema,
  CreatePaymentOrderSchema,
  EmailDispatchRouteSchema,
  VerifyPaymentSchema,
} from '../src/shared/validation';

async function runApiValidationTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        API INPUT VALIDATION & BOUNDARY TEST SUITE            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  console.log('--- SECTION 1: parseJsonBody Helper Mechanics ---');

  await asyncTest('Valid JSON payload is parsed and accepted', async () => {
    const validPayload = {
      invoiceId: '123e4567-e89b-12d3-a456-426614174000',
      requestedAmount: 500,
      partialPayment: true,
    };
    const req = new Request('http://localhost/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await parseJsonBody(req, CreatePaymentOrderSchema);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.invoiceId, validPayload.invoiceId);
      assert.strictEqual(res.data.requestedAmount, 500);
      assert.strictEqual(res.data.partialPayment, true);
    }
  });

  await asyncTest('Extra unknown fields are strictly rejected', async () => {
    const maliciousPayload = {
      invoiceId: '123e4567-e89b-12d3-a456-426614174000',
      role: 'admin', // Injected extra key
      __proto__: { backdoor: true },
    };
    const req = new Request('http://localhost/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousPayload),
    });

    const res = await parseJsonBody(req, CreatePaymentOrderSchema);
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.response.status, 400);
      const data = await res.response.json();
      assert.strictEqual(data.code, 'INVALID_PAYLOAD');
      // Assert NO reflection of raw input
      assert.strictEqual(JSON.stringify(data).includes('admin'), false);
    }
  });

  await asyncTest('Oversized body exceeding maxBytes is rejected', async () => {
    const largeHtml = 'A'.repeat(120 * 1024); // 120 KB
    const req = new Request('http://localhost/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(largeHtml.length + 50),
      },
      body: JSON.stringify({
        options: {
          to: 'client@example.com',
          eventType: 'invoice_issued',
          subject: 'Test',
          html: largeHtml,
        },
      }),
    });

    const res = await parseJsonBody(req, EmailDispatchRouteSchema, { maxBytes: 100 * 1024 });
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.response.status, 400);
      const data = await res.response.json();
      assert.strictEqual(data.code, 'PAYLOAD_TOO_LARGE');
    }
  });

  await asyncTest('Error body contains generic message without raw input echo', async () => {
    const toxicInput = "<script>alert('xss')</script>";
    const req = new Request('http://localhost/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: toxicInput, // Invalid UUID
      }),
    });

    const res = await parseJsonBody(req, CreatePaymentOrderSchema);
    assert.strictEqual(res.success, false);
    if (!res.success) {
      const data = await res.response.json();
      assert.strictEqual(data.code, 'INVALID_PAYLOAD');
      assert.strictEqual(JSON.stringify(data).includes('<script>'), false);
    }
  });

  console.log('\n--- SECTION 2: Payment Order Schema Rules ---');

  test('Payment order rejects negative and zero amounts', () => {
    const neg = CreatePaymentOrderSchema.safeParse({
      invoiceId: '123e4567-e89b-12d3-a456-426614174000',
      requestedAmount: -50,
    });
    assert.strictEqual(neg.success, false);

    const zero = CreatePaymentOrderSchema.safeParse({
      invoiceId: '123e4567-e89b-12d3-a456-426614174000',
      requestedAmount: 0,
    });
    assert.strictEqual(zero.success, false);
  });

  test('Payment order rejects excessive maximum amounts', () => {
    const huge = CreatePaymentOrderSchema.safeParse({
      invoiceId: '123e4567-e89b-12d3-a456-426614174000',
      requestedAmount: 999_999_999,
    });
    assert.strictEqual(huge.success, false);
  });

  console.log('\n--- SECTION 3: Email Dispatch Schema Rules ---');

  test('Email dispatch accepts valid payload and trims subject', () => {
    const valid = EmailDispatchRouteSchema.safeParse({
      options: {
        to: 'alex@flowdesk.dev',
        eventType: 'deliverable_ready',
        subject: '  Deliverable v1 ready for review  ',
        html: '<p>Please review deliverable</p>',
      },
    });
    assert.strictEqual(valid.success, true);
    if (valid.success) {
      assert.strictEqual(valid.data.options.subject, 'Deliverable v1 ready for review');
    }
  });

  test('Email dispatch rejects unsupported event types', () => {
    const invalid = EmailDispatchRouteSchema.safeParse({
      options: {
        to: 'alex@flowdesk.dev',
        eventType: 'malicious_event_type',
        subject: 'Hello',
        html: '<p>Test</p>',
      },
    });
    assert.strictEqual(invalid.success, false);
  });

  test('Email dispatch rejects invalid email format', () => {
    const invalid = EmailDispatchRouteSchema.safeParse({
      options: {
        to: 'not-an-email',
        eventType: 'invoice_issued',
        subject: 'Invoice',
        html: '<p>Test</p>',
      },
    });
    assert.strictEqual(invalid.success, false);
  });

  console.log('\n--- SECTION 4: Payment Verification Schema Rules ---');

  test('Payment verification strictly requires orderId, paymentId, and signature', () => {
    const missing = VerifyPaymentSchema.safeParse({
      orderId: 'order_123456789',
      paymentId: 'pay_123456789',
      // signature missing
    });
    assert.strictEqual(missing.success, false);

    const valid = VerifyPaymentSchema.safeParse({
      orderId: 'order_1234567890abcdef',
      paymentId: 'pay_1234567890abcdef',
      signature: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });
    assert.strictEqual(valid.success, true);
  });

  console.log('\n--- SECTION 5: Path Parameter Format Validation ---');

  test('validateRouteParam validates valid UUIDs', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const res = validateRouteParam(validUuid, uuidSchema, 'invoiceId');
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data, validUuid);
    }
  });

  test('validateRouteParam rejects SQL injection in UUID param', () => {
    const sqlInjection = "123e4567-e89b-12d3-a456-426614174000' OR '1'='1";
    const res = validateRouteParam(sqlInjection, uuidSchema, 'invoiceId');
    assert.strictEqual(res.success, false);
    if (!res.success) {
      assert.strictEqual(res.response.status, 400);
    }
  });

  test('validateRouteParam validates invitation token format', () => {
    const validToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const res = validateRouteParam(validToken, tokenParamSchema, 'token');
    assert.strictEqual(res.success, true);

    const shortToken = 'abc';
    const resShort = validateRouteParam(shortToken, tokenParamSchema, 'token');
    assert.strictEqual(resShort.success, false);
  });

  test('validateRouteParam validates Razorpay paymentId format', () => {
    const validPayId = 'pay_M1234567890abc';
    const res = validateRouteParam(validPayId, paymentIdParamSchema, 'paymentId');
    assert.strictEqual(res.success, true);

    const validUuidPay = '123e4567-e89b-12d3-a456-426614174000';
    const resUuid = validateRouteParam(validUuidPay, paymentIdParamSchema, 'paymentId');
    assert.strictEqual(resUuid.success, true);

    const invalidPay = 'invalid@pay/123';
    const resInv = validateRouteParam(invalidPay, paymentIdParamSchema, 'paymentId');
    assert.strictEqual(resInv.success, false);
  });

  console.log('\n================================================================');
  console.log(`📊 API VALIDATION RESULTS: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('🎉 ALL API VALIDATION TESTS PASSED!');
    console.log('================================================================');
  }
}

runApiValidationTests().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
