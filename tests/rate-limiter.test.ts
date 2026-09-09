import { checkRateLimit, RATE_LIMIT_PRESETS, getClientIp } from '../src/backend/utilities/rate-limiter';

async function runRateLimiterTests() {
  console.log('================================================================');
  console.log('FLOWDESK RATE LIMITER & BOUNDARY AUDIT TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  // 1. Sliding Window Allow within limit
  const testKey1 = `test-user-${Date.now()}-1`;
  const res1 = await checkRateLimit(testKey1, { maxRequests: 3, windowSeconds: 2 });
  assert(res1.allowed === true && res1.remaining === 2, 'First request within window is allowed');

  const res2 = await checkRateLimit(testKey1, { maxRequests: 3, windowSeconds: 2 });
  assert(res2.allowed === true && res2.remaining === 1, 'Second request within window is allowed');

  const res3 = await checkRateLimit(testKey1, { maxRequests: 3, windowSeconds: 2 });
  assert(res3.allowed === true && res3.remaining === 0, 'Third request reaches maxRequests threshold');

  // 2. Throttled on 4th attempt
  const res4 = await checkRateLimit(testKey1, { maxRequests: 3, windowSeconds: 2 });
  assert(
    res4.allowed === false && res4.remaining === 0 && res4.retryAfterSeconds >= 1,
    'Fourth request exceeding limit is throttled with retryAfterSeconds'
  );

  // 3. Different Keys are isolated
  const testKey2 = `test-user-${Date.now()}-2`;
  const resKey2 = await checkRateLimit(testKey2, { maxRequests: 3, windowSeconds: 2 });
  assert(resKey2.allowed === true && resKey2.remaining === 2, 'Distinct rate limit key is isolated and unthrottled');

  // 4. IP Extraction Helper
  const mockReqWithForwarded = {
    headers: new Headers({
      'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
    }),
  };
  const ip1 = getClientIp(mockReqWithForwarded as any);
  assert(ip1 === '203.0.113.195', 'getClientIp parses primary IP from x-forwarded-for');

  const mockReqWithRealIp = {
    headers: new Headers({
      'x-real-ip': '198.51.100.42',
    }),
  };
  const ip2 = getClientIp(mockReqWithRealIp as any);
  assert(ip2 === '198.51.100.42', 'getClientIp parses IP from x-real-ip header');

  const mockReqEmpty = {
    headers: new Headers(),
  };
  const ip3 = getClientIp(mockReqEmpty as any);
  assert(ip3 === '127.0.0.1', 'getClientIp falls back to 127.0.0.1 safely when headers missing');

  // 5. Presets validation
  assert(RATE_LIMIT_PRESETS.AUTH.maxRequests === 10, 'RATE_LIMIT_PRESETS.AUTH configured');
  assert(RATE_LIMIT_PRESETS.INVITATION_CLAIM.maxRequests === 15, 'RATE_LIMIT_PRESETS.INVITATION_CLAIM configured');
  assert(RATE_LIMIT_PRESETS.PAYMENT_ORDER.maxRequests === 20, 'RATE_LIMIT_PRESETS.PAYMENT_ORDER configured');
  assert(RATE_LIMIT_PRESETS.PAYMENT_VERIFY.maxRequests === 30, 'RATE_LIMIT_PRESETS.PAYMENT_VERIFY configured');
  assert(RATE_LIMIT_PRESETS.EMAIL_DISPATCH.maxRequests === 30, 'RATE_LIMIT_PRESETS.EMAIL_DISPATCH configured');

  console.log('\n----------------------------------------------------------------');
  console.log(`Rate Limiter Test Results: ${passed} passed, ${failed} failed.`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRateLimiterTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
