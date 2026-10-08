import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

test('Batch 4: Account & Settings Server Mutations Suite', async (suite) => {
  process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

  const { PATCH: handleSettings } = await import('../app/api/account/settings/route');
  const { PATCH: handleNotifications } = await import('../app/api/account/notifications/route');
  const { POST: handleDelete } = await import('../app/api/account/delete/route');
  const { POST: handleRestore } = await import('../app/api/account/restore/route');

  await suite.test('Account Settings: rejects unauthenticated caller with 401 in production', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/account/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'EUR' }),
    });
    const res = await handleSettings(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'UNAUTHORIZED');
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Account Settings: rejects tax rate exceeding 100% with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/account/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultTaxRate: 150 }),
    });
    const res = await handleSettings(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PAYLOAD');
  });

  await suite.test('Account Settings: successfully saves settings in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/account/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'EUR',
        timezone: 'Europe/Paris',
        invoicePrefix: 'FACT',
        defaultTaxRate: 20,
      }),
    });
    const res = await handleSettings(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.settings.currency, 'EUR');
    assert.equal(data.settings.invoicePrefix, 'FACT');
  });

  await suite.test('Notification Settings: successfully updates preferences in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/account/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailInvoices: false,
        weeklyDigest: true,
      }),
    });
    const res = await handleNotifications(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.settings.emailInvoices, false);
    assert.equal(data.settings.weeklyDigest, true);
  });

  await suite.test('Account Deletion: schedules freelancer deletion with 5-day window in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'freelancer' }),
    });
    const res = await handleDelete(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.gracePeriodDays, 5);
    assert.ok(data.restoreUntil);
  });

  await suite.test('Account Deletion: schedules client deletion with 30-day window in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'client', clientId: 'c1c1c1c1-1111-4111-8111-111111111111' }),
    });
    const res = await handleDelete(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.gracePeriodDays, 30);
    assert.ok(data.restoreUntil);
  });

  await suite.test('Account Restoration: restores account in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/account/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'freelancer' }),
    });
    const res = await handleRestore(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });
});
