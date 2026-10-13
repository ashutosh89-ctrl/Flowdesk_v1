/**
 * Tests: Cron Run-Jobs Route Suite
 *
 * Verifies security, timing-safe authentication, dry-run default,
 * and fail-closed handling for POST /api/cron/run-jobs.
 */

import assert from 'assert';
import test, { describe, beforeEach, afterEach } from 'node:test';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/cron/run-jobs/route';

describe('Cron Run-Jobs Route Verification Suite', () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalCronDryRun = process.env.CRON_DRY_RUN;
  const TEST_SECRET = 'test_cron_secret_jobs_1234567890abcdef';

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_SECRET;
    delete process.env.CRON_DRY_RUN;
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.CRON_DRY_RUN = originalCronDryRun;
  });

  test('Fails closed with 500 CRON_UNCONFIGURED when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost:3000/api/cron/run-jobs', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.code, 'CRON_UNCONFIGURED');
  });

  test('Rejects request with 401 when Authorization header is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/run-jobs', { method: 'POST' });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'UNAUTHORIZED');
  });

  test('Rejects request with 401 when Bearer token is incorrect', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/run-jobs', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid_secret_token_12345' },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.code, 'UNAUTHORIZED');
  });

  test('Succeeds with 200 in dry-run mode by default when dry_run parameter is omitted', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/run-jobs', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.dryRun, true);
    assert.ok(body.sweeper);
    assert.ok(body.runner);
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
    assert.ok(res.headers.get('X-Request-Id'));
  });

  test('Works with GET method as well as POST for flexible webhook triggers', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/run-jobs', {
      method: 'GET',
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });
});
