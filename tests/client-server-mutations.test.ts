import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

test('Batch 3: Client Management & Invitations Server Mutations Suite', async (suite) => {
  process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

  const { POST: handleCreateClient } = await import('../app/api/clients/route');
  const { PATCH: handleUpdateClient, DELETE: handleDeleteClient } = await import('../app/api/clients/[clientId]/route');
  const { POST: handleCreateInvitation, DELETE: handleRevokeInvitation } = await import('../app/api/clients/[clientId]/invitation/route');

  await suite.test('Client Create: rejects unauthenticated caller with 401 in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Acme Corp',
        email: 'acme@example.com',
      }),
    });
    const res = await handleCreateClient(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'UNAUTHORIZED');
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Client Create: rejects invalid email with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Acme Corp',
        email: 'not-an-email',
      }),
    });
    const res = await handleCreateClient(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PAYLOAD');
  });

  await suite.test('Client Create: successfully provisions client in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Stark Industries',
        email: 'tony@stark.com',
        company: 'Stark Industries LLC',
        hourlyRate: 250,
      }),
    });
    const res = await handleCreateClient(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.client.name, 'Stark Industries');
    assert.equal(data.client.email, 'tony@stark.com');
  });

  await suite.test('Client Update: rejects invalid UUID parameter with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/clients/invalid-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'Updated LLC' }),
    });
    const res = await handleUpdateClient(req, {
      params: Promise.resolve({ clientId: 'invalid-uuid' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PARAM');
  });

  await suite.test('Client Update: updates client fields in demo mode', async () => {
    const clientId = 'c1c1c1c1-1111-4111-8111-111111111111';
    const req = new NextRequest(`http://localhost:3000/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'Avengers Initiative',
        hourlyRate: 300,
        portalAccessEnabled: true,
      }),
    });
    const res = await handleUpdateClient(req, {
      params: Promise.resolve({ clientId }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.client.company, 'Avengers Initiative');
    assert.equal(data.client.portalAccessEnabled, true);
  });

  await suite.test('Client Delete: deletes client in demo mode', async () => {
    const clientId = 'c1c1c1c1-1111-4111-8111-111111111111';
    const req = new NextRequest(`http://localhost:3000/api/clients/${clientId}`, {
      method: 'DELETE',
    });
    const res = await handleDeleteClient(req, {
      params: Promise.resolve({ clientId }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  await suite.test('Client Invitation: creates one-time connection link in demo mode', async () => {
    const clientId = 'c1c1c1c1-1111-4111-8111-111111111111';
    const req = new NextRequest(`http://localhost:3000/api/clients/${clientId}/invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceNew: true, recipientEmail: 'client@partner.com' }),
    });
    const res = await handleCreateInvitation(req, {
      params: Promise.resolve({ clientId }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.url.includes('/connect/'));
    assert.ok(data.rawToken);
  });

  await suite.test('Client Invitation: revokes invitations in demo mode', async () => {
    const clientId = 'c1c1c1c1-1111-4111-8111-111111111111';
    const req = new NextRequest(`http://localhost:3000/api/clients/${clientId}/invitation`, {
      method: 'DELETE',
    });
    const res = await handleRevokeInvitation(req, {
      params: Promise.resolve({ clientId }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });
});
