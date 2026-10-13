/**
 * FlowDesk Phase 4A: Logger & Error Sanitization Test Suite
 * 
 * Verifies production logging and error disclosure protections:
 * 1. Email masking (maskEmail)
 * 2. Phone masking (maskPhone)
 * 3. Key-based sensitive field redaction (password, token, secret, apiKey, etc.)
 * 4. Value-based token & secret detection (Bearer, JWT, whsec_, rzp_)
 * 5. String truncation (>2000 chars) and max depth recursion limits
 * 6. Circular reference neutralization (WeakSet)
 * 7. Array truncation (>50 items)
 * 8. Error object sanitization
 * 9. Safe API error response generation (createApiErrorResponse)
 */

import assert from 'assert';
import {
  maskEmail,
  maskPhone,
  sanitizeLogData,
  createApiErrorResponse,
  getOrCreateRequestId,
} from '../src/backend/utilities/logger';

async function runLoggerRedactionTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       LOGGER & ERROR SANITIZATION VERIFICATION SUITE         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        return (res as Promise<void>)
          .then(() => {
            console.log(`  ✅ PASS: ${name}`);
            passed++;
          })
          .catch((err: any) => {
            console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
            failed++;
          });
      } else {
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  console.log('--- SECTION 1: Masking Functions ---');

  test('maskEmail obfuscates local part while preserving domain', () => {
    assert.strictEqual(maskEmail('alex@example.com'), 'a***@example.com');
    assert.strictEqual(maskEmail('shubham.dev@flowdesk.io'), 's***@flowdesk.io');
    assert.strictEqual(maskEmail('x@test.com'), 'x***@test.com');
    assert.strictEqual(maskEmail('invalid-email'), '[REDACTED]');
    assert.strictEqual(maskEmail(null), '[REDACTED]');
  });

  test('maskPhone preserves first and last 2 characters', () => {
    assert.strictEqual(maskPhone('+1234567890'), '+1***90');
    assert.strictEqual(maskPhone('9876543210'), '98***10');
    assert.strictEqual(maskPhone('123'), '[REDACTED]');
    assert.strictEqual(maskPhone(undefined), '[REDACTED]');
  });

  console.log('--- SECTION 2: Key-based Sensitive Data Redaction ---');

  test('sanitizeLogData redacts sensitive keys at any level of nesting', () => {
    const raw = {
      username: 'john_doe',
      password: 'superSecretPassword123!',
      nested: {
        api_key: 'sk_live_1234567890abcdef',
        token: 'eyJhbGciOi...',
        secret: 'whsec_987654321',
        authorization: 'Bearer token123',
        account_number: '123456789012',
        cvv: '123',
        normalField: 'safeValue',
      },
    };

    const sanitized = sanitizeLogData(raw);

    assert.strictEqual(sanitized.username, 'john_doe');
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.nested.api_key, '[REDACTED]');
    assert.strictEqual(sanitized.nested.token, '[REDACTED]');
    assert.strictEqual(sanitized.nested.secret, '[REDACTED]');
    assert.strictEqual(sanitized.nested.authorization, '[REDACTED]');
    assert.strictEqual(sanitized.nested.account_number, '[REDACTED]');
    assert.strictEqual(sanitized.nested.cvv, '[REDACTED]');
    assert.strictEqual(sanitized.nested.normalField, 'safeValue');
  });

  test('sanitizeLogData masks email and phone field names', () => {
    const raw = {
      email: 'client@flowdesk.dev',
      billing_email: 'billing@agency.co',
      phone: '+919876543210',
      contact_phone: '+14155552671',
    };

    const sanitized = sanitizeLogData(raw);
    assert.strictEqual(sanitized.email, 'c***@flowdesk.dev');
    assert.strictEqual(sanitized.billing_email, 'b***@agency.co');
    assert.strictEqual(sanitized.phone, '+9***10');
    assert.strictEqual(sanitized.contact_phone, '+1***71');
  });

  console.log('--- SECTION 3: Value-based Pattern Detection ---');

  test('sanitizeLogData detects and masks bearer tokens and live secrets in values', () => {
    const longJwt = `eyJ_dummy_placeholder_${'A'.repeat(60)}`;
    const raw = {
      headerString: `Bearer ${longJwt}`,
      webhookSecretString: `whsec_dummy_placeholder_${'B'.repeat(40)}`,
      embeddedEmail: 'standalone@provider.com',
    };

    const sanitized = sanitizeLogData(raw);
    assert.strictEqual(sanitized.headerString.includes('[REDACTED]'), true);
    assert.strictEqual(sanitized.webhookSecretString.includes('[REDACTED]'), true);
    assert.strictEqual(sanitized.embeddedEmail, 's***@provider.com');
  });

  test('sanitizeLogData truncates strings exceeding 2000 characters', () => {
    const longString = 'A'.repeat(2500);
    const sanitized = sanitizeLogData({ text: longString });
    assert.strictEqual(sanitized.text.length < 600, true);
    assert.strictEqual(sanitized.text.includes('[Truncated: 2500 chars]'), true);
  });

  console.log('--- SECTION 4: Circular References, Arrays, and Max Depth ---');

  test('sanitizeLogData handles circular references without throwing stack overflow', () => {
    const objA: any = { name: 'Alpha' };
    const objB: any = { name: 'Beta', a: objA };
    objA.b = objB;

    let sanitized: any;
    assert.doesNotThrow(() => {
      sanitized = sanitizeLogData(objA);
    });

    assert.strictEqual(sanitized.name, 'Alpha');
    assert.strictEqual(sanitized.b.name, 'Beta');
    assert.strictEqual(sanitized.b.a, '[Circular]');
  });

  test('sanitizeLogData stops recursion beyond maximum depth', () => {
    let deep: any = { level: 0 };
    let cur = deep;
    for (let i = 1; i <= 10; i++) {
      cur.next = { level: i };
      cur = cur.next;
    }

    const sanitized = sanitizeLogData(deep);
    let check = sanitized;
    let reachedTruncation = false;
    for (let i = 0; i <= 10; i++) {
      if (check.next === '[Truncated: Max Depth]') {
        reachedTruncation = true;
        break;
      }
      check = check.next;
    }
    assert.strictEqual(reachedTruncation, true);
  });

  test('sanitizeLogData bounds large arrays to 50 items', () => {
    const largeArray = Array.from({ length: 65 }, (_, i) => ({ index: i, note: `item-${i}` }));
    const sanitized = sanitizeLogData(largeArray);

    assert.strictEqual(Array.isArray(sanitized), true);
    assert.strictEqual(sanitized.length, 51); // 50 items + 1 truncation marker
    assert.strictEqual(sanitized[50], '[Truncated: 15 more items]');
  });

  console.log('--- SECTION 5: Error and API Response Hardening ---');

  test('sanitizeLogData preserves error message and name without leaking in prod', () => {
    const err = new Error('Database connection failed on port 5432');
    const sanitized = sanitizeLogData(err);
    assert.strictEqual(sanitized.name, 'Error');
    assert.strictEqual(sanitized.message, 'Database connection failed on port 5432');
  });

  test('getOrCreateRequestId generates or validates UUID correlation IDs', () => {
    const generated = getOrCreateRequestId();
    assert.strictEqual(typeof generated, 'string');
    assert.strictEqual(generated.length >= 16, true);

    const validIncoming = new Request('http://localhost', {
      headers: { 'x-request-id': 'custom-req-id-12345' },
    });
    assert.strictEqual(getOrCreateRequestId(validIncoming), 'custom-req-id-12345');

    const invalidIncoming = new Request('http://localhost', {
      headers: { 'x-request-id': 'bad<script>id' },
    });
    const sanitizedId = getOrCreateRequestId(invalidIncoming);
    assert.notStrictEqual(sanitizedId, 'bad<script>id');
  });

  await test('createApiErrorResponse attaches correlation ID and cache-control', async () => {
    const res = createApiErrorResponse({
      message: 'Resource not found',
      code: 'NOT_FOUND',
      status: 404,
      requestId: 'test-req-999',
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers.get('X-Request-Id'), 'test-req-999');
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, 'Resource not found');
    assert.strictEqual(body.code, 'NOT_FOUND');
    assert.strictEqual(body.requestId, 'test-req-999');
  });

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLoggerRedactionTests();
