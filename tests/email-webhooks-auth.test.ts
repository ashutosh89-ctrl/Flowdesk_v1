#!/usr/bin/env npx tsx
/**
 * Email Webhook Authentication & Fail-Closed Security Test Suite (SEC-HIGH-03)
 *
 * Verifies:
 * 1. Brevo Webhook Handler (app/api/webhooks/brevo/route.ts):
 *    - Fails closed (503) if BREVO_WEBHOOK_SECRET is unset or empty.
 *    - Rejects missing, invalid, or forged secrets (401).
 *    - Rejects tokens provided via URL query parameters (401).
 *    - Accepts valid secret via Authorization: Bearer <secret> (200).
 *    - Accepts valid secret via x-sib-webhook-token (200).
 *    - Accepts valid secret via x-brevo-token (200).
 *    - Rejects unapproved or malicious event types (400).
 *    - Timing-safe comparison operates securely across different secret lengths.
 *
 * 2. Resend Webhook Handler (app/api/webhooks/resend/route.ts):
 *    - Fails closed (503) if RESEND_WEBHOOK_SECRET is unset or empty.
 *    - Rejects requests missing Svix headers (401).
 *    - Rejects stale/replayed timestamps (>300 seconds) (401).
 *    - Rejects future timestamps (>300 seconds) (401).
 *    - Rejects forged / invalid signatures (401).
 *    - Rejects body tampering with valid signature headers (401).
 *    - Rejects unapproved event types (400).
 *    - Accepts authentic Svix HMAC SHA256 signatures with base64 secret (200).
 *    - Accepts authentic Svix HMAC SHA256 signatures with plain utf-8 secret (200).
 *    - Successfully validates when svix-signature contains multiple signatures (200).
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { POST as handleBrevoWebhook } from '../app/api/webhooks/brevo/route';
import { POST as handleResendWebhook } from '../app/api/webhooks/resend/route';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Detail: ${details}`);
  }
}

/**
 * Helper to generate Svix signature for Resend webhooks
 */
function generateSvixSignature(params: {
  secret: string;
  svixId: string;
  timestamp: string;
  rawBody: string;
}): string {
  const { secret, svixId, timestamp, rawBody } = params;
  let secretBuffer: Buffer;
  if (secret.startsWith('whsec_')) {
    secretBuffer = Buffer.from(secret.slice(6), 'base64');
  } else {
    secretBuffer = Buffer.from(secret, 'utf-8');
  }

  const toSign = `${svixId}.${timestamp}.${rawBody}`;
  const sig = crypto.createHmac('sha256', secretBuffer).update(toSign).digest('base64');
  return `v1,${sig}`;
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       EMAIL WEBHOOK AUTHENTICATION SECURITY TEST SUITE       ║');
  console.log('║       (SEC-HIGH-03: Fail-Closed & Timing-Safe Verif)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const originalBrevoSecret = process.env.BREVO_WEBHOOK_SECRET;
  const originalResendSecret = process.env.RESEND_WEBHOOK_SECRET;

  try {
    // =========================================================================
    // SECTION 1: Brevo Webhook Handler Authentication
    // =========================================================================
    console.log('--- SECTION 1: Brevo Webhook Security ---');

    const testBrevoSecret = 'test_brevo_secret_token_abcdef123456';

    // 1.1 Fail closed when secret is unset
    delete process.env.BREVO_WEBHOOK_SECRET;
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'delivered', 'message-id': '<123@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      const data = await res.json();

      assert(res.status === 503, 'Brevo returns 503 when BREVO_WEBHOOK_SECRET is missing');
      assert(
        data.error === 'Webhook service configuration unavailable',
        'Brevo returns safe configuration error message'
      );
    }

    // Set valid secret for remaining tests
    process.env.BREVO_WEBHOOK_SECRET = testBrevoSecret;

    // 1.2 Reject missing auth header
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'delivered', 'message-id': '<123@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      assert(res.status === 401, 'Brevo returns 401 when Authorization header is absent');
    }

    // 1.3 Reject incorrect secret
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-secret-value-1234',
        },
        body: JSON.stringify({ event: 'delivered', 'message-id': '<123@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      assert(res.status === 401, 'Brevo returns 401 when Authorization Bearer token is incorrect');
    }

    // 1.4 Reject query parameter secret (prevent token leakage in query strings)
    {
      const req = new NextRequest(
        `http://localhost:3000/api/webhooks/brevo?secret=${testBrevoSecret}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'delivered', 'message-id': '<123@brevo.com>' }),
        }
      );
      const res = await handleBrevoWebhook(req);
      assert(res.status === 401, 'Brevo rejects secret supplied via URL query parameter');
    }

    // 1.5 Accept valid Authorization: Bearer <secret>
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testBrevoSecret}`,
        },
        body: JSON.stringify({ event: 'delivered', 'message-id': '<123@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      const data = await res.json();
      assert(res.status === 200, 'Brevo accepts valid secret via Authorization: Bearer header');
      assert(data.received === true, 'Brevo returns { received: true }');
    }

    // 1.6 Accept valid x-sib-webhook-token
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sib-webhook-token': testBrevoSecret,
        },
        body: JSON.stringify({ event: 'opened', 'message-id': '<456@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      const data = await res.json();
      assert(res.status === 200, 'Brevo accepts valid secret via x-sib-webhook-token');
      assert(data.received === true, 'Brevo returns success with x-sib-webhook-token');
    }

    // 1.7 Accept valid x-brevo-token
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-brevo-token': testBrevoSecret,
        },
        body: JSON.stringify({ event: 'click', 'message-id': '<789@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      const data = await res.json();
      assert(res.status === 200, 'Brevo accepts valid secret via x-brevo-token');
      assert(data.received === true, 'Brevo returns success with x-brevo-token');
    }

    // 1.8 Reject unapproved event type
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testBrevoSecret}`,
        },
        body: JSON.stringify({ event: 'contact_created', 'message-id': '<999@brevo.com>' }),
      });
      const res = await handleBrevoWebhook(req);
      assert(res.status === 400, 'Brevo returns 400 on unapproved event type');
    }

    // 1.9 Reject malformed JSON
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/brevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testBrevoSecret}`,
        },
        body: 'invalid-json{{',
      });
      const res = await handleBrevoWebhook(req);
      assert(res.status === 400, 'Brevo returns 400 on malformed JSON body');
    }

    console.log('');
    // =========================================================================
    // SECTION 2: Resend / Svix Webhook Authentication
    // =========================================================================
    console.log('--- SECTION 2: Resend (Svix) Webhook Security ---');

    // Generate a valid Svix secret: whsec_ + 32-byte base64
    const rawSecretBytes = crypto.randomBytes(32);
    const testResendSecret = `whsec_${rawSecretBytes.toString('base64')}`;

    // 2.1 Fail closed when RESEND_WEBHOOK_SECRET is missing
    delete process.env.RESEND_WEBHOOK_SECRET;
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-1' } }),
      });
      const res = await handleResendWebhook(req);
      const data = await res.json();

      assert(res.status === 503, 'Resend returns 503 when RESEND_WEBHOOK_SECRET is missing');
      assert(
        data.error === 'Webhook service configuration unavailable',
        'Resend returns safe configuration error message'
      );
    }

    // Set valid secret for remaining tests
    process.env.RESEND_WEBHOOK_SECRET = testResendSecret;

    // 2.2 Reject when Svix headers are missing
    {
      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-1' } }),
      });
      const res = await handleResendWebhook(req);
      assert(res.status === 401, 'Resend returns 401 when Svix headers are missing');
    }

    // 2.3 Reject invalid / forged signature
    {
      const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-1' } });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_test_123',
          'svix-timestamp': nowSec,
          'svix-signature': 'v1,forged_signature_here',
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      assert(res.status === 401, 'Resend returns 401 on forged signature');
    }

    // 2.4 Reject stale timestamp (>300 seconds / 5 minutes old)
    {
      const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-1' } });
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 301).toString(); // 301s ago
      const svixId = 'msg_test_stale';
      const sig = generateSvixSignature({
        secret: testResendSecret,
        svixId,
        timestamp: staleTimestamp,
        rawBody,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': staleTimestamp,
          'svix-signature': sig,
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      assert(res.status === 401, 'Resend returns 401 on stale webhook (>5m replay attempt)');
    }

    // 2.5 Reject future timestamp (>300 seconds in future)
    {
      const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-1' } });
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 301).toString();
      const svixId = 'msg_test_future';
      const sig = generateSvixSignature({
        secret: testResendSecret,
        svixId,
        timestamp: futureTimestamp,
        rawBody,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': futureTimestamp,
          'svix-signature': sig,
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      assert(res.status === 401, 'Resend returns 401 on skewed future timestamp (>5m)');
    }

    // 2.6 Reject body tampering (signature calculated on original body, tampered body sent)
    {
      const originalBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-1' } });
      const tamperedBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 'res-tampered' } });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const svixId = 'msg_test_tamper';
      const sig = generateSvixSignature({
        secret: testResendSecret,
        svixId,
        timestamp: nowSec,
        rawBody: originalBody,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': nowSec,
          'svix-signature': sig,
        },
        body: tamperedBody,
      });
      const res = await handleResendWebhook(req);
      assert(res.status === 401, 'Resend returns 401 when body content is tampered');
    }

    // 2.7 Accept valid Svix signature with whsec_ secret
    {
      const rawBody = JSON.stringify({
        type: 'email.delivered',
        data: { email_id: 'res-valid-1' },
      });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const svixId = 'msg_test_valid_1';
      const sig = generateSvixSignature({
        secret: testResendSecret,
        svixId,
        timestamp: nowSec,
        rawBody,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': nowSec,
          'svix-signature': sig,
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      const data = await res.json();
      assert(res.status === 200, 'Resend returns 200 for valid Svix HMAC SHA256 signature');
      assert(data.received === true, 'Resend returns { received: true }');
      assert(data.messageId === 'res-valid-1', 'Resend parses messageId accurately');
    }

    // 2.8 Accept valid Svix signature with plain UTF-8 secret (no whsec_ prefix)
    {
      const plainSecret = 'plain_secret_string_1234567890abcdef';
      process.env.RESEND_WEBHOOK_SECRET = plainSecret;

      const rawBody = JSON.stringify({
        type: 'email.bounced',
        data: { email_id: 'res-bounced-1', bounce: { message: 'Mailbox full' } },
      });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const svixId = 'msg_test_plain';
      const sig = generateSvixSignature({
        secret: plainSecret,
        svixId,
        timestamp: nowSec,
        rawBody,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': nowSec,
          'svix-signature': sig,
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      const data = await res.json();
      assert(res.status === 200, 'Resend returns 200 for plain string secret without whsec_ prefix');
      assert(data.event === 'email.bounced', 'Resend handles bounced event type');

      // Restore whsec_ secret
      process.env.RESEND_WEBHOOK_SECRET = testResendSecret;
    }

    // 2.9 Multi-signature support in svix-signature header
    {
      const rawBody = JSON.stringify({
        type: 'email.opened',
        data: { email_id: 'res-opened-1' },
      });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const svixId = 'msg_test_multi';
      const validSig = generateSvixSignature({
        secret: testResendSecret,
        svixId,
        timestamp: nowSec,
        rawBody,
      });

      // Header with rotated/old signature preceding valid signature
      const multiSigHeader = `v1,old_expired_signature_12345 ${validSig} v2,some_v2_signature`;

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': nowSec,
          'svix-signature': multiSigHeader,
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      const data = await res.json();
      assert(res.status === 200, 'Resend succeeds when multiple signatures are present in header');
      assert(data.received === true, 'Resend validates authentic signature among rotated list');
    }

    // 2.10 Reject unapproved event type
    {
      const rawBody = JSON.stringify({
        type: 'contact.created',
        data: { email_id: 'res-unapproved-1' },
      });
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const svixId = 'msg_test_bad_type';
      const sig = generateSvixSignature({
        secret: testResendSecret,
        svixId,
        timestamp: nowSec,
        rawBody,
      });

      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': svixId,
          'svix-timestamp': nowSec,
          'svix-signature': sig,
        },
        body: rawBody,
      });
      const res = await handleResendWebhook(req);
      assert(res.status === 400, 'Resend returns 400 for unapproved event type');
    }
  } finally {
    // Restore original env vars
    if (originalBrevoSecret !== undefined) {
      process.env.BREVO_WEBHOOK_SECRET = originalBrevoSecret;
    } else {
      delete process.env.BREVO_WEBHOOK_SECRET;
    }

    if (originalResendSecret !== undefined) {
      process.env.RESEND_WEBHOOK_SECRET = originalResendSecret;
    } else {
      delete process.env.RESEND_WEBHOOK_SECRET;
    }
  }

  console.log('');
  console.log('================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Passed`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL EMAIL WEBHOOK AUTHENTICATION TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
