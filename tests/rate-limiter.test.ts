/**
 * FLOWDESK DISTRIBUTED RATE LIMITER & BOUNDARY AUDIT TEST SUITE (SEC-MED-02)
 * 
 * Verifies:
 * 1. Distributed rate limiting across separate limiter instances sharing one store.
 * 2. Counter increments and window TTL expiration / resets.
 * 3. retryAfterSeconds calculations on throttling.
 * 4. Error fallback behavior:
 *    - Fail-closed presets (invitation claim, payment order, payment verify) block on Redis failure.
 *    - Fail-open presets (auth, email, uploads) fall back to local in-memory limiting.
 * 5. Secure getClientIp resolution:
 *    - Platform headers prioritized (x-vercel-forwarded-for, cf-connecting-ip, x-real-ip).
 *    - Untrusted proxy handling: selects rightmost IP in x-forwarded-for to defeat client spoofing.
 *    - Safe fallback to 127.0.0.1.
 * 6. Standard preset configuration integrity.
 * 
 * Zero live credentials required.
 */

import assert from 'assert';
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  getClientIp,
  setRedisClientForTesting,
  resetLimiterStateForTesting,
  createRateLimiterInstance,
  RedisLikeClient,
  FAIL_CLOSED_ON_REDIS_ERROR,
} from '../src/backend/utilities/rate-limiter';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err?.message || err}`);
      failed++;
    });
}

/**
 * In-memory fake Redis implementation for deterministic multi-instance testing.
 */
class FakeRedisClient implements RedisLikeClient {
  public store = new Map<string, { value: number; expiresAt: number }>();
  public shouldFail = false;

  async incr(key: string): Promise<number> {
    if (this.shouldFail) throw new Error('Simulated Redis network connection timeout');
    const existing = this.store.get(key);
    const now = Date.now();
    if (!existing || existing.expiresAt <= now) {
      this.store.set(key, { value: 1, expiresAt: now + 60_000 });
      return 1;
    }
    existing.value += 1;
    return existing.value;
  }

  async ttl(key: string): Promise<number> {
    if (this.shouldFail) throw new Error('Simulated Redis error');
    const existing = this.store.get(key);
    const now = Date.now();
    if (!existing || existing.expiresAt <= now) return -2;
    return Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.shouldFail) throw new Error('Simulated Redis error');
    const existing = this.store.get(key);
    if (!existing) return 0;
    existing.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  pipeline() {
    const queue: Array<() => Promise<any>> = [];
    return {
      incr: (key: string) => {
        queue.push(() => this.incr(key));
        return this.pipeline();
      },
      ttl: (key: string) => {
        queue.push(() => this.ttl(key));
        return this.pipeline();
      },
      expire: (key: string, seconds: number) => {
        queue.push(() => this.expire(key, seconds));
        return this.pipeline();
      },
      exec: async <T extends unknown[]>(): Promise<T> => {
        if (this.shouldFail) throw new Error('Simulated Redis pipeline failure');
        const results: any[] = [];
        for (const op of queue) {
          results.push(await op());
        }
        return results as T;
      },
    };
  }
}

async function runRateLimiterTests() {
  console.log('================================================================');
  console.log('🔒 FLOWDESK DISTRIBUTED RATE LIMITER AUDIT TEST SUITE');
  console.log('================================================================\n');

  resetLimiterStateForTesting();

  // --- SECTION 1: Local In-Memory Fallback Limiter ---
  console.log('--- SECTION 1: Local In-Memory Fallback Limiter ---');

  await test('First request within in-memory window is allowed', async () => {
    const key = `mem-test-1-${Date.now()}`;
    const res = await checkRateLimit(key, { maxRequests: 3, windowSeconds: 2 });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.remaining, 2);
  });

  await test('Second request within in-memory window is allowed', async () => {
    const key = `mem-test-2-${Date.now()}`;
    await checkRateLimit(key, { maxRequests: 3, windowSeconds: 2 });
    const res = await checkRateLimit(key, { maxRequests: 3, windowSeconds: 2 });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.remaining, 1);
  });

  await test('Fourth request exceeding threshold is throttled with retryAfterSeconds', async () => {
    const key = `mem-throttle-${Date.now()}`;
    const cfg = { maxRequests: 3, windowSeconds: 5 };
    await checkRateLimit(key, cfg);
    await checkRateLimit(key, cfg);
    await checkRateLimit(key, cfg);
    const throttled = await checkRateLimit(key, cfg);
    assert.strictEqual(throttled.allowed, false);
    assert.strictEqual(throttled.remaining, 0);
    assert(throttled.retryAfterSeconds >= 1, 'retryAfterSeconds must be >= 1');
  });

  await test('Distinct rate limit keys are completely isolated', async () => {
    const keyA = `mem-iso-A-${Date.now()}`;
    const keyB = `mem-iso-B-${Date.now()}`;
    const cfg = { maxRequests: 2, windowSeconds: 5 };
    await checkRateLimit(keyA, cfg);
    await checkRateLimit(keyA, cfg);
    const throttledA = await checkRateLimit(keyA, cfg);
    const freshB = await checkRateLimit(keyB, cfg);
    assert.strictEqual(throttledA.allowed, false);
    assert.strictEqual(freshB.allowed, true);
    assert.strictEqual(freshB.remaining, 1);
  });

  // --- SECTION 2: Distributed State Across Two Limiter Instances ---
  console.log('\n--- SECTION 2: Distributed State Across Two Limiter Instances ---');

  const sharedFakeRedis = new FakeRedisClient();
  const limiterInstance1 = createRateLimiterInstance(sharedFakeRedis);
  const limiterInstance2 = createRateLimiterInstance(sharedFakeRedis);

  await test('Shared Redis store enforces limit across two independent limiter instances', async () => {
    const sharedKey = `shared-client-777`;
    const cfg = { maxRequests: 3, windowSeconds: 60, prefix: 'shared_test' };

    // Instance 1 consumes 2 tokens
    const r1 = await limiterInstance1.checkLimit(sharedKey, cfg);
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r1.remaining, 2);

    const r2 = await limiterInstance1.checkLimit(sharedKey, cfg);
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r2.remaining, 1);

    // Instance 2 (different instance, same store) consumes 3rd token
    const r3 = await limiterInstance2.checkLimit(sharedKey, cfg);
    assert.strictEqual(r3.allowed, true);
    assert.strictEqual(r3.remaining, 0);

    // Instance 2 consumes 4th attempt -> throttled by shared state!
    const r4 = await limiterInstance2.checkLimit(sharedKey, cfg);
    assert.strictEqual(r4.allowed, false);
    assert.strictEqual(r4.remaining, 0);
    assert(r4.retryAfterSeconds > 0);

    // Instance 1 also sees throttling immediately
    const r5 = await limiterInstance1.checkLimit(sharedKey, cfg);
    assert.strictEqual(r5.allowed, false);
  });

  await test('Window reset restores allowance in shared Redis store', async () => {
    const resetKey = `reset-client-888`;
    const cfg = { maxRequests: 2, windowSeconds: 1, prefix: 'reset_test' };

    await limiterInstance1.checkLimit(resetKey, cfg);
    await limiterInstance1.checkLimit(resetKey, cfg);
    const throttled = await limiterInstance1.checkLimit(resetKey, cfg);
    assert.strictEqual(throttled.allowed, false);

    // Manually expire keys in fake redis to simulate time elapsing
    for (const [k, item] of sharedFakeRedis.store.entries()) {
      if (k.includes(resetKey)) {
        item.expiresAt = Date.now() - 1000;
      }
    }

    // Next request in next window period succeeds
    const allowedAfterWindow = await limiterInstance2.checkLimit(resetKey, cfg);
    assert.strictEqual(allowedAfterWindow.allowed, true);
  });

  // --- SECTION 3: Redis Runtime Failure Policy (Fail-Closed vs Fail-Open) ---
  console.log('\n--- SECTION 3: Redis Runtime Failure Policy (Fail-Closed vs Fail-Open) ---');

  await test('Payment Order preset FAILS CLOSED when Redis encounters runtime failure', async () => {
    const failingRedis = new FakeRedisClient();
    failingRedis.shouldFail = true;
    const paymentLimiter = createRateLimiterInstance(failingRedis);

    const res = await paymentLimiter.checkLimit('user-payment-checkout', RATE_LIMIT_PRESETS.PAYMENT_ORDER);
    assert.strictEqual(res.allowed, false, 'PAYMENT_ORDER must fail closed during Redis downtime');
    assert.strictEqual(res.retryAfterSeconds, RATE_LIMIT_PRESETS.PAYMENT_ORDER.windowSeconds);
  });

  await test('Invitation Claim preset FAILS CLOSED when Redis encounters runtime failure', async () => {
    const failingRedis = new FakeRedisClient();
    failingRedis.shouldFail = true;
    const invLimiter = createRateLimiterInstance(failingRedis);

    const res = await invLimiter.checkLimit('client-invitation-claim', RATE_LIMIT_PRESETS.INVITATION_CLAIM);
    assert.strictEqual(res.allowed, false, 'INVITATION_CLAIM must fail closed to protect against IDOR/takeover');
    assert.strictEqual(res.retryAfterSeconds, RATE_LIMIT_PRESETS.INVITATION_CLAIM.windowSeconds);
  });

  await test('Payment Verify preset FAILS CLOSED when Redis encounters runtime failure', async () => {
    const failingRedis = new FakeRedisClient();
    failingRedis.shouldFail = true;
    const verifyLimiter = createRateLimiterInstance(failingRedis);

    const res = await verifyLimiter.checkLimit('payment-verification-order', RATE_LIMIT_PRESETS.PAYMENT_VERIFY);
    assert.strictEqual(res.allowed, false, 'PAYMENT_VERIFY must fail closed to prevent replay attack');
  });

  await test('Auth preset FAILS OPEN to in-memory limiter when Redis errors to prevent user lockout', async () => {
    const failingRedis = new FakeRedisClient();
    failingRedis.shouldFail = true;
    const authLimiter = createRateLimiterInstance(failingRedis);

    const key = `auth-failover-${Date.now()}`;
    const res = await authLimiter.checkLimit(key, RATE_LIMIT_PRESETS.AUTH);
    assert.strictEqual(res.allowed, true, 'AUTH fails open to in-memory limiter to preserve login access');
  });

  await test('Email preset FAILS OPEN to in-memory limiter when Redis errors to maintain notifications', async () => {
    const failingRedis = new FakeRedisClient();
    failingRedis.shouldFail = true;
    const emailLimiter = createRateLimiterInstance(failingRedis);

    const key = `email-failover-${Date.now()}`;
    const res = await emailLimiter.checkLimit(key, RATE_LIMIT_PRESETS.EMAIL_DISPATCH);
    assert.strictEqual(res.allowed, true, 'EMAIL fails open to in-memory limiter');
  });

  // --- SECTION 4: Client IP Security & Untrusted-Proxy Handling ---
  console.log('\n--- SECTION 4: Client IP Security & Untrusted-Proxy Handling ---');

  await test('Prefers platform-injected x-vercel-forwarded-for header over all others', () => {
    const req = {
      headers: new Headers({
        'x-vercel-forwarded-for': '198.51.100.99',
        'x-forwarded-for': '203.0.113.1, 10.0.0.1',
        'x-real-ip': '10.0.0.1',
      }),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, '198.51.100.99', 'x-vercel-forwarded-for must take precedence');
  });

  await test('Prefers Cloudflare cf-connecting-ip header when present', () => {
    const req = {
      headers: new Headers({
        'cf-connecting-ip': '198.51.100.77',
        'x-forwarded-for': '203.0.113.1, 10.0.0.1',
      }),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, '198.51.100.77', 'cf-connecting-ip must take precedence over x-forwarded-for');
  });

  await test('Prefers trusted fronting proxy x-real-ip header over x-forwarded-for', () => {
    const req = {
      headers: new Headers({
        'x-real-ip': '198.51.100.42',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, '198.51.100.42', 'x-real-ip must take precedence over untrusted x-forwarded-for');
  });

  await test('Selects LAST (rightmost) IP in x-forwarded-for to defeat client header spoofing', () => {
    // Attacker injects leftmost spoofed IP "203.0.113.195", trusted edge proxy appends actual TCP client "150.172.238.178"
    const req = {
      headers: new Headers({
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      }),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, '150.172.238.178', 'Must resolve to rightmost untrusted-proxy-safe IP');
  });

  await test('Single IP in x-forwarded-for is correctly parsed', () => {
    const req = {
      headers: new Headers({
        'x-forwarded-for': '192.0.2.1',
      }),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, '192.0.2.1');
  });

  await test('Falls back safely to 127.0.0.1 when all IP headers are absent', () => {
    const req = {
      headers: new Headers(),
    };
    const ip = getClientIp(req);
    assert.strictEqual(ip, '127.0.0.1');
  });

  // --- SECTION 5: Preset Integrity ---
  console.log('\n--- SECTION 5: Preset Integrity ---');

  await test('Standard presets are properly configured with expected limits', () => {
    assert.strictEqual(RATE_LIMIT_PRESETS.AUTH.maxRequests, 10);
    assert.strictEqual(RATE_LIMIT_PRESETS.INVITATION_CLAIM.maxRequests, 15);
    assert.strictEqual(RATE_LIMIT_PRESETS.PAYMENT_ORDER.maxRequests, 20);
    assert.strictEqual(RATE_LIMIT_PRESETS.PAYMENT_VERIFY.maxRequests, 30);
    assert.strictEqual(RATE_LIMIT_PRESETS.EMAIL_DISPATCH.maxRequests, 30);
    assert.strictEqual(RATE_LIMIT_PRESETS.UPLOADS.maxRequests, 25);
  });

  console.log('\n================================================================');
  console.log(`📊 RATE LIMITER RESULTS: ${passed} Passed, ${failed} Failed`);
  if (failed === 0) {
    console.log('🎉 ALL DISTRIBUTED RATE LIMITER TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runRateLimiterTests().catch((err) => {
  console.error('Fatal error during rate limiter test suite:', err);
  process.exit(1);
});
