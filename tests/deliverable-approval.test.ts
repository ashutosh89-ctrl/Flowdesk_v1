/**
 * FlowDesk Phase 4B: Deliverable Approval Route Handler Test Suite
 * 
 * Verifies security and architectural boundary controls of the pilot endpoint:
 * 1. Authentication requirement (rejects unauthenticated callers with 401)
 * 2. Route param validation (rejects invalid UUIDs with 400)
 * 3. Body schema validation (rejects invalid payload / unknown properties)
 * 4. Body size limit enforcement (rejects payloads > 10KB)
 * 5. Demo mode execution & correct status transition output
 * 6. Security headers (Cache-Control: no-store, X-Request-Id)
 */

import assert from 'assert';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/deliverables/[deliverableId]/approve/route';

async function runDeliverableApprovalTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      DELIVERABLE APPROVAL ROUTE VERIFICATION SUITE           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const INVALID_UUID = 'not-a-valid-uuid-1234';

  console.log('--- SECTION 1: Authentication & Identity ---');

  await test('Rejects unauthenticated request when not in demo mode', async () => {
    const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;
    delete process.env.NEXT_PUBLIC_AUTH_MODE;

    const req = new NextRequest(`http://localhost:3000/api/deliverables/${VALID_UUID}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Looks good' }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliverableId: VALID_UUID }) });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'UNAUTHORIZED');

    if (originalAuthMode !== undefined) {
      process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;
    }
  });

  console.log('--- SECTION 2: Input & Param Validation ---');

  await test('Rejects malformed deliverableId that is not a UUID', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

    const req = new NextRequest(`http://localhost:3000/api/deliverables/${INVALID_UUID}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Looks good' }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliverableId: INVALID_UUID }) });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'INVALID_PARAM');
  });

  await test('Rejects unknown extra fields in request body', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

    const req = new NextRequest(`http://localhost:3000/api/deliverables/${VALID_UUID}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: 'Valid notes', unauthorizedField: 'malicious' }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliverableId: VALID_UUID }) });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'INVALID_PAYLOAD');
  });

  await test('Rejects oversized payload exceeding 10KB limit', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

    const largeNotes = 'x'.repeat(15 * 1024);
    const req = new NextRequest(`http://localhost:3000/api/deliverables/${VALID_UUID}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes: largeNotes }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliverableId: VALID_UUID }) });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'PAYLOAD_TOO_LARGE');
  });

  console.log('--- SECTION 3: Successful Processing & Response Headers ---');

  await test('Approves deliverable in demo mode and returns structured response', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

    const req = new NextRequest(`http://localhost:3000/api/deliverables/${VALID_UUID}/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'custom-approval-req-777',
      },
      body: JSON.stringify({ notes: 'Approved for launch' }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliverableId: VALID_UUID }) });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
    assert.strictEqual(res.headers.get('X-Request-Id'), 'custom-approval-req-777');

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.deliverable.id, VALID_UUID);
    assert.strictEqual(body.deliverable.status, 'approved');
    assert.strictEqual(body.deliverable.notes, 'Approved for launch');
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

runDeliverableApprovalTests();
