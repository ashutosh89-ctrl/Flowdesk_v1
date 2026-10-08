/**
 * Tests: Background Job Runner Engine
 *
 * Verifies claiming, worker isolation, lease expiry, backoff,
 * dead-letter queue, time budgeting, and error redaction.
 */

import './setup-demo-mode';
import assert from 'assert';
import test, { describe, beforeEach } from 'node:test';
import {
  enqueueJob,
  claimAndRunJobs,
  calculateBackoffMs,
  redactErrorMessage,
  jobRegistry,
  getJobHealth,
  retryJob,
  __clearInMemoryJobs,
  __getInMemoryJobs,
} from '../src/backend/jobs';

describe('Background Job Runner Engine Suite', () => {
  beforeEach(() => {
    __clearInMemoryJobs();
    jobRegistry.clear();
  });

  test('Enqueueing with dedupeKey prevents duplicate job creation', async () => {
    const res1 = await enqueueJob({
      type: 'test_task',
      workspaceId: 'ws-123',
      payload: { value: 42 },
      dedupeKey: 'unique_key_1',
    });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.deduped, false);
    assert.ok(res1.jobId);

    // Second enqueue with same dedupeKey
    const res2 = await enqueueJob({
      type: 'test_task',
      workspaceId: 'ws-123',
      payload: { value: 99 },
      dedupeKey: 'unique_key_1',
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.deduped, true);
    assert.strictEqual(res2.jobId, res1.jobId);
  });

  test('Claiming and executing jobs with success transition', async () => {
    let executed = false;
    jobRegistry.register('test_success', async (payload) => {
      executed = true;
      assert.strictEqual(payload.foo, 'bar');
      return { success: true };
    });

    await enqueueJob({
      type: 'test_success',
      workspaceId: 'ws-123',
      payload: { foo: 'bar' },
    });

    const result = await claimAndRunJobs({ batchSize: 5 });
    assert.strictEqual(result.claimed, 1);
    assert.strictEqual(result.succeeded, 1);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(executed, true);

    const inMem = __getInMemoryJobs();
    const job = Array.from(inMem.values())[0];
    assert.strictEqual(job.status, 'succeeded');
    assert.strictEqual(job.locked_by, null);
  });

  test('Two workers claiming jobs never double-claim the same job', async () => {
    jobRegistry.register('test_concurrent', async () => {
      return { success: true };
    });

    // Enqueue 2 jobs
    await enqueueJob({ type: 'test_concurrent', workspaceId: 'ws-1', payload: { n: 1 } });
    await enqueueJob({ type: 'test_concurrent', workspaceId: 'ws-1', payload: { n: 2 } });

    // Worker A claims 1 job
    const runA = await claimAndRunJobs({ workerId: 'worker_A', batchSize: 1 });
    assert.strictEqual(runA.claimed, 1);

    // Worker B claims the remaining 1 job
    const runB = await claimAndRunJobs({ workerId: 'worker_B', batchSize: 1 });
    assert.strictEqual(runB.claimed, 1);

    // Worker C claims nothing (all claimed/succeeded)
    const runC = await claimAndRunJobs({ workerId: 'worker_C', batchSize: 1 });
    assert.strictEqual(runC.claimed, 0);
  });

  test('Expired lease recovery allows reclamation of stalled jobs', async () => {
    jobRegistry.register('test_stalled', async () => {
      return { success: true };
    });

    const enq = await enqueueJob({
      type: 'test_stalled',
      workspaceId: 'ws-1',
      payload: {},
    });

    // Simulate stalled worker lease in past
    const inMem = __getInMemoryJobs();
    const job = inMem.get(enq.jobId!)!;
    job.status = 'running';
    job.locked_by = 'crashed_worker';
    job.locked_until = new Date(Date.now() - 5000).toISOString(); // expired 5s ago

    // Fresh worker claims the stalled job
    const recoveryRun = await claimAndRunJobs({ workerId: 'new_worker', batchSize: 5 });
    assert.strictEqual(recoveryRun.claimed, 1);
    assert.strictEqual(recoveryRun.succeeded, 1);
    assert.strictEqual(job.status, 'succeeded');
  });

  test('Retry, exponential backoff, and dead-lettering after max attempts', async () => {
    jobRegistry.register('test_fail', async () => {
      return { success: false, error: 'Database connection failed' };
    });

    const enq = await enqueueJob({
      type: 'test_fail',
      workspaceId: 'ws-1',
      payload: {},
      maxAttempts: 2,
    });

    // Attempt 1: Fails, resets to queued for retry
    const run1 = await claimAndRunJobs({ batchSize: 1 });
    assert.strictEqual(run1.failed, 1);
    assert.strictEqual(run1.dead, 0);

    const job = __getInMemoryJobs().get(enq.jobId!)!;
    assert.strictEqual(job.status, 'queued');
    assert.strictEqual(job.attempts, 1);

    // Fast-forward run_at to now for attempt 2
    job.run_at = new Date(Date.now() - 1000).toISOString();

    // Attempt 2: Reaches max_attempts (2) -> Dead letter
    const run2 = await claimAndRunJobs({ batchSize: 1 });
    assert.strictEqual(run2.failed, 1);
    assert.strictEqual(run2.dead, 1);
    assert.strictEqual(job.status, 'dead');
  });

  test('Manual retry of a dead job resets status to queued', async () => {
    const enq = await enqueueJob({
      type: 'test_dlq',
      workspaceId: 'ws-1',
      payload: {},
      maxAttempts: 1,
    });

    const job = __getInMemoryJobs().get(enq.jobId!)!;
    job.status = 'dead';
    job.attempts = 1;

    const retryRes = await retryJob(job.id, 'ws-1');
    assert.strictEqual(retryRes.success, true);
    assert.strictEqual(job.status, 'queued');
    assert.strictEqual(job.attempts, 0);
  });

  test('Serverless time budget stops loop cleanly', async () => {
    jobRegistry.register('test_slow', async () => {
      // Small delay
      await new Promise((r) => setTimeout(r, 15));
      return { success: true };
    });

    // Enqueue 5 jobs
    for (let i = 0; i < 5; i++) {
      await enqueueJob({ type: 'test_slow', workspaceId: 'ws-1', payload: { i } });
    }

    // Set tiny time budget of 10ms
    const result = await claimAndRunJobs({ timeBudgetMs: 10, batchSize: 5 });
    assert.strictEqual(result.timedOut, true);
    assert.ok(result.succeeded < 5);
  });

  test('Error redaction strips tokens, API keys, and email addresses', () => {
    const rawError = 'Payment failed with Bearer secret_token_xyz for user john.doe@example.com using xkeysib-1234567890abcdef';
    const redacted = redactErrorMessage(rawError);

    assert.ok(!redacted.includes('secret_token_xyz'));
    assert.ok(!redacted.includes('john.doe@example.com'));
    assert.ok(!redacted.includes('xkeysib-1234567890abcdef'));
    assert.ok(redacted.includes('[REDACTED]'));
    assert.ok(redacted.includes('[REDACTED_EMAIL]'));
    assert.ok(redacted.includes('[REDACTED_API_KEY]'));
  });

  test('Exponential backoff calculation returns escalating delay with jitter', () => {
    const b1 = calculateBackoffMs(1);
    const b2 = calculateBackoffMs(2);
    const b3 = calculateBackoffMs(3);

    // 15s * 2^0 = 15s (+ 0..5s jitter)
    assert.ok(b1 >= 15000 && b1 <= 20000);
    // 15s * 2^1 = 30s (+ 0..5s jitter)
    assert.ok(b2 >= 30000 && b2 <= 35000);
    // 15s * 2^2 = 60s (+ 0..5s jitter)
    assert.ok(b3 >= 60000 && b3 <= 65000);
  });
});
