import './setup-demo-mode';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { razorpaySubscriptionProvider } from '../src/backend/billing/razorpay-subscription-provider';
import { POST as handleBillingWebhook } from '../app/api/webhooks/razorpay-billing/route';

const TEST_SECRET = 'whsec_test_billing_secret_1234567890abcdef';

function makeWebhookRequest(body: string, signature?: string, contentLength?: string): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature !== undefined) {
    headers['x-razorpay-signature'] = signature;
  }
  if (contentLength !== undefined) {
    headers['content-length'] = contentLength;
  }

  return new NextRequest('http://localhost:3000/api/webhooks/razorpay-billing', {
    method: 'POST',
    headers,
    body,
  });
}

function computeSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

test('Razorpay Billing Webhook: Security & Validation', async (suite) => {
  const originalSecret = process.env.RAZORPAY_BILLING_WEBHOOK_SECRET;

  suite.beforeEach(() => {
    process.env.RAZORPAY_BILLING_WEBHOOK_SECRET = TEST_SECRET;
  });

  suite.after(() => {
    if (originalSecret !== undefined) {
      process.env.RAZORPAY_BILLING_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.RAZORPAY_BILLING_WEBHOOK_SECRET;
    }
  });

  await suite.test('fails closed with 500 when webhook secret is unset', async () => {
    delete process.env.RAZORPAY_BILLING_WEBHOOK_SECRET;
    const body = JSON.stringify({ event: 'subscription.activated' });
    const req = makeWebhookRequest(body, 'any_signature');
    const res = await handleBillingWebhook(req);

    assert.equal(res.status, 500);
    const data = await res.json();
    assert.match(data.error, /unavailable/i);
  });

  await suite.test('rejects request with missing signature header with 400', async () => {
    const body = JSON.stringify({ event: 'subscription.activated' });
    const req = makeWebhookRequest(body); // no signature
    const res = await handleBillingWebhook(req);

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Missing webhook signature/i);
  });

  await suite.test('rejects oversized payload (> 100 KB) with 400', async () => {
    const largeBody = 'x'.repeat(101 * 1024);
    const req = makeWebhookRequest(largeBody, 'sig', String(largeBody.length));
    const res = await handleBillingWebhook(req);

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /size limit/i);
  });

  await suite.test('rejects invalid / forged HMAC signature with 401', async () => {
    const body = JSON.stringify({ event: 'subscription.activated', id: 'evt_test_1' });
    const forgedSig = crypto.randomBytes(32).toString('hex');
    const req = makeWebhookRequest(body, forgedSig);
    const res = await handleBillingWebhook(req);

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /Invalid webhook signature/i);
  });

  await suite.test('rejects payload if body was tampered after signing with 401', async () => {
    const originalBody = JSON.stringify({ event: 'subscription.activated', amount: 799 });
    const validSig = computeSignature(originalBody, TEST_SECRET);
    const tamperedBody = JSON.stringify({ event: 'subscription.activated', amount: 0 });

    const req = makeWebhookRequest(tamperedBody, validSig);
    const res = await handleBillingWebhook(req);

    assert.equal(res.status, 401);
  });

  await suite.test('accepts valid HMAC signature and processes successfully with 200', async () => {
    const payload = JSON.stringify({
      id: `evt_valid_${Date.now()}`,
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_12345',
            status: 'active',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
          },
        },
      },
    });
    const validSig = computeSignature(payload, TEST_SECRET);
    const req = makeWebhookRequest(payload, validSig);
    const res = await handleBillingWebhook(req);

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.received, true);
  });

  await suite.test('idempotency: duplicate events return duplicate: true', async () => {
    const eventId = `evt_dup_${Date.now()}_test`;
    const payload = JSON.stringify({
      id: eventId,
      event: 'subscription.charged',
      payload: {
        subscription: {
          entity: { id: 'sub_test_dup' },
        },
      },
    });
    const sig = computeSignature(payload, TEST_SECRET);

    // First arrival
    const res1 = await handleBillingWebhook(makeWebhookRequest(payload, sig));
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.received, true);
    assert.equal(data1.duplicate, undefined);

    // Second arrival (replay)
    const res2 = await handleBillingWebhook(makeWebhookRequest(payload, sig));
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.received, true);
    assert.equal(data2.duplicate, true);
  });
});

test('Razorpay Billing Provider: verifyWebhook Pure Logic', async (suite) => {
  const secret = 'whsec_provider_pure_test_secret';

  await suite.test('returns true for matching rawBody and signature', () => {
    const body = '{"event":"subscription.charged"}';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    assert.equal(razorpaySubscriptionProvider.verifyWebhook(body, sig, secret), true);
  });

  await suite.test('returns false for wrong secret', () => {
    const body = '{"event":"subscription.charged"}';
    const sig = crypto.createHmac('sha256', 'wrong_secret').update(body).digest('hex');
    assert.equal(razorpaySubscriptionProvider.verifyWebhook(body, sig, secret), false);
  });

  await suite.test('returns false for mismatched signature length without crashing', () => {
    const body = '{"event":"subscription.charged"}';
    const shortSig = 'abcd1234';
    assert.equal(razorpaySubscriptionProvider.verifyWebhook(body, shortSig, secret), false);
  });

  await suite.test('returns false for empty or undefined parameters safely', () => {
    assert.equal(razorpaySubscriptionProvider.verifyWebhook('', '', secret), false);
    assert.equal(razorpaySubscriptionProvider.verifyWebhook('body', '', secret), false);
    assert.equal(razorpaySubscriptionProvider.verifyWebhook('body', 'sig', ''), false);
  });
});
