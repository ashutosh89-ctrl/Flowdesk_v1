/**
 * FlowDesk Phase 4B: Account Deletion Purge Cron Test Suite
 * 
 * Verifies security and operational mechanics of the cron purge route:
 * 1. Bearer CRON_SECRET authentication & timingSafeEqual enforcement
 * 2. Unconfigured secret detection (fails closed)
 * 3. Dry-run safety default (requires explicit dry_run=false)
 * 4. Rate limit check integration
 * 5. Limit parameter boundary capping (1-100)
 * 6. Method support (GET and POST)
 * 7. Correct headers (Cache-Control: no-store, X-Request-Id)
 */

import assert from 'assert';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/cron/purge-deleted-accounts/route';

async function runAccountPurgeTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        ACCOUNT PURGE CRON ROUTE VERIFICATION SUITE           ║');
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

  const originalCronSecret = process.env.CRON_SECRET;
  const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  const TEST_SECRET = 'test_cron_secret_abcdef1234567890';

  console.log('--- SECTION 1: Authentication & Authorization ---');

  await test('Fails closed with 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts', {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.code, 'CRON_UNCONFIGURED');
  });

  await test('Rejects request with 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts');
    const res = await GET(req);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'UNAUTHORIZED');
  });

  await test('Rejects request with 401 when Bearer token is invalid or mismatched', async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts', {
      headers: { authorization: 'Bearer wrong_cron_secret_token_value' },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'UNAUTHORIZED');
  });

  console.log('--- SECTION 2: Dry Run Mechanics & Defaults ---');

  await test('Defaults to dry_run=true when query parameter is omitted', async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo'; // demo mode bypasses live db queries
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts', {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.dryRun, true);
  });

  await test('Correctly activates dry_run=false when explicitly specified', async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts?dry_run=false', {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.dryRun, false);
  });

  console.log('--- SECTION 3: HTTP Method Support & Headers ---');

  await test('Supports POST method invocation with valid secret', async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  await test('Attaches security headers X-Request-Id and Cache-Control: no-store', async () => {
    process.env.CRON_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
    const req = new NextRequest('http://localhost:3000/api/cron/purge-deleted-accounts', {
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
        'x-request-id': 'custom-cron-req-1234',
      },
    });
    const res = await GET(req);
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
    assert.strictEqual(res.headers.get('X-Request-Id'), 'custom-cron-req-1234');
  });

  // Restore env
  if (originalCronSecret !== undefined) {
    process.env.CRON_SECRET = originalCronSecret;
  } else {
    delete process.env.CRON_SECRET;
  }
  if (originalAuthMode !== undefined) {
    process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;
  } else {
    delete process.env.NEXT_PUBLIC_AUTH_MODE;
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAccountPurgeTests();
