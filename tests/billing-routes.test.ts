import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

test('Billing API Routes: Endpoint Security & Verification', async (suite) => {
  process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

  const { POST: handleCheckout } = await import('../app/api/billing/checkout/route');
  const { POST: handleCancel } = await import('../app/api/billing/cancel/route');
  const { POST: handleResume } = await import('../app/api/billing/resume/route');
  const { POST: handleChangePlan } = await import('../app/api/billing/change-plan/route');
  const { GET: handleStatus } = await import('../app/api/billing/status/route');

  // --- Checkout Route ---
  await suite.test('Checkout: rejects unauthenticated caller with 401 in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'pro', interval: 'monthly' }),
    });
    const res = await handleCheckout(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'UNAUTHORIZED');
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Checkout: rejects non-owner client caller with 403 FORBIDDEN', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-flowdesk-role': 'client',
      },
      body: JSON.stringify({ planKey: 'pro', interval: 'monthly' }),
    });
    const res = await handleCheckout(req);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'FORBIDDEN');
    assert.match(data.error || data.message || '', /owners/i);
  });

  await suite.test('Checkout: rejects invalid planKey with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'enterprise_hacked', interval: 'monthly' }),
    });
    const res = await handleCheckout(req);
    assert.equal(res.status, 400);
  });

  await suite.test('Checkout: rejects free plan checkout with 400 (only pro/studio paid tiers allowed)', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'free', interval: 'monthly' }),
    });
    const res = await handleCheckout(req);
    assert.equal(res.status, 400);
  });

  await suite.test('Checkout: rejects client-supplied price via strict schema validation with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Client tries to inject custom price
      body: JSON.stringify({ planKey: 'pro', interval: 'monthly', price: 1 }),
    });
    const res = await handleCheckout(req);
    assert.equal(res.status, 400);
  });

  await suite.test('Checkout: generates server-authoritative checkout in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'pro', interval: 'monthly' }),
    });
    const res = await handleCheckout(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.provider, 'razorpay');
    assert.ok(data.checkoutPayload.amount >= 1000);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  // --- Cancel Route ---
  await suite.test('Cancel: rejects unauthenticated caller with 401 in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/billing/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Too expensive' }),
    });
    const res = await handleCancel(req);
    assert.equal(res.status, 401);
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Cancel: rejects non-owner client caller with 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/cancel', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-flowdesk-role': 'client',
      },
      body: JSON.stringify({ reason: 'Client cancel attempt' }),
    });
    const res = await handleCancel(req);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'FORBIDDEN');
  });

  await suite.test('Cancel: successfully schedules cancellation in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Project completed' }),
    });
    const res = await handleCancel(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  // --- Resume Route ---
  await suite.test('Resume: rejects unauthenticated caller with 401 in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/billing/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handleResume(req);
    assert.equal(res.status, 401);
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Resume: rejects non-owner client caller with 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/resume', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-flowdesk-role': 'client',
      },
      body: JSON.stringify({}),
    });
    const res = await handleResume(req);
    assert.equal(res.status, 403);
  });

  await suite.test('Resume: successfully resumes subscription in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handleResume(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  // --- Change Plan Route ---
  await suite.test('Change Plan: rejects unauthenticated caller with 401 in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/billing/change-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'studio', interval: 'yearly' }),
    });
    const res = await handleChangePlan(req);
    assert.equal(res.status, 401);
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Change Plan: rejects non-owner client caller with 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/change-plan', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-flowdesk-role': 'client',
      },
      body: JSON.stringify({ planKey: 'studio', interval: 'yearly' }),
    });
    const res = await handleChangePlan(req);
    assert.equal(res.status, 403);
  });

  await suite.test('Change Plan: rejects invalid planKey with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/change-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'invalid_super_tier', interval: 'yearly' }),
    });
    const res = await handleChangePlan(req);
    assert.equal(res.status, 400);
  });

  await suite.test('Change Plan: successfully updates plan in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/change-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planKey: 'studio', interval: 'yearly' }),
    });
    const res = await handleChangePlan(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  // --- Status Route ---
  await suite.test('Status: rejects unauthenticated caller with 401 in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/billing/status', {
      method: 'GET',
    });
    const res = await handleStatus(req);
    assert.equal(res.status, 401);
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Status: rejects non-owner client caller with 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/status', {
      method: 'GET',
      headers: { 'x-flowdesk-role': 'client' },
    });
    const res = await handleStatus(req);
    assert.equal(res.status, 403);
  });

  await suite.test('Status: returns current entitlements, plans, and no-store header in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/status', {
      method: 'GET',
    });
    const res = await handleStatus(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.entitlements);
    assert.ok(data.plans);
    assert.equal(data.entitlements.planKey, 'pro');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });
});
