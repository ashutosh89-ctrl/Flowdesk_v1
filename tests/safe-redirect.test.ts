#!/usr/bin/env npx tsx
/**
 * Safe Redirect Validation & Anti-Open-Redirect Test Suite (SEC-HIGH-04)
 *
 * Validates getSafeRedirectPath under adversarial redirect payloads.
 */

import { getSafeRedirectPath } from '../src/shared/utils/safe-redirect';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Detail: ${details}`);
  }
}

function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        SAFE REDIRECT VALIDATION & AUDIT TEST SUITE           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const FALLBACK = '/auth/post-login';

  console.log('--- SECTION 1: Valid Relative Same-Site Paths ---');

  // Test 1: Simple relative path
  assert(
    getSafeRedirectPath('/dashboard', FALLBACK) === '/dashboard',
    'Valid internal path /dashboard is preserved'
  );

  // Test 2: Nested path with query parameters
  assert(
    getSafeRedirectPath('/portal/abc?x=1&mode=active', FALLBACK) === '/portal/abc?x=1&mode=active',
    'Valid path with query parameters is preserved'
  );

  // Test 3: Path with fragment
  assert(
    getSafeRedirectPath('/client/dashboard#invoices', FALLBACK) === '/client/dashboard#invoices',
    'Valid path with hash fragment is preserved'
  );

  console.log('');
  console.log('--- SECTION 2: External Schemes & Open Redirect Attacks ---');

  // Test 4: External absolute URL (https)
  assert(
    getSafeRedirectPath('https://evil.com', FALLBACK) === FALLBACK,
    'External https:// URL returns fallback',
    getSafeRedirectPath('https://evil.com', FALLBACK)
  );

  // Test 5: External absolute URL (http)
  assert(
    getSafeRedirectPath('http://attacker.org/steal', FALLBACK) === FALLBACK,
    'External http:// URL returns fallback',
    getSafeRedirectPath('http://attacker.org/steal', FALLBACK)
  );

  // Test 6: Protocol-relative URL (//evil.com)
  assert(
    getSafeRedirectPath('//evil.com', FALLBACK) === FALLBACK,
    'Protocol-relative //evil.com returns fallback',
    getSafeRedirectPath('//evil.com', FALLBACK)
  );

  // Test 7: Triple-slash URL (///evil.com)
  assert(
    getSafeRedirectPath('///evil.com', FALLBACK) === FALLBACK,
    'Triple-slash ///evil.com returns fallback'
  );

  console.log('');
  console.log('--- SECTION 3: Backslash & Browser Normalization Bypasses ---');

  // Test 8: Backslash protocol-relative (/\\evil.com)
  assert(
    getSafeRedirectPath('/\\evil.com', FALLBACK) === FALLBACK,
    'Backslash trick /\\evil.com returns fallback'
  );

  // Test 9: Pure backslash start (\\evil.com)
  assert(
    getSafeRedirectPath('\\\\evil.com', FALLBACK) === FALLBACK,
    'UNC / Windows backslash path \\\\evil.com returns fallback'
  );

  // Test 10: Single backslash start (\evil.com)
  assert(
    getSafeRedirectPath('\\evil.com', FALLBACK) === FALLBACK,
    'Single backslash \\evil.com returns fallback'
  );

  console.log('');
  console.log('--- SECTION 4: Script Schemes & XSS Injection ---');

  // Test 11: javascript: scheme
  assert(
    getSafeRedirectPath('javascript:alert(1)', FALLBACK) === FALLBACK,
    'javascript: scheme returns fallback'
  );

  // Test 12: Leading slash javascript (/javascript:alert(1))
  assert(
    getSafeRedirectPath('/javascript:alert(1)', FALLBACK) === FALLBACK,
    'Leading slash /javascript: scheme returns fallback'
  );

  // Test 13: data: URI
  assert(
    getSafeRedirectPath('data:text/html,<script>alert(1)</script>', FALLBACK) === FALLBACK,
    'data: URI scheme returns fallback'
  );

  // Test 14: vbscript: scheme
  assert(
    getSafeRedirectPath('vbscript:msgbox(1)', FALLBACK) === FALLBACK,
    'vbscript: scheme returns fallback'
  );

  console.log('');
  console.log('--- SECTION 5: Double-Encoding & Control Character Bypasses ---');

  // Test 15: Percent-encoded protocol-relative (/%2F%2Fevil.com)
  assert(
    getSafeRedirectPath('/%2F%2Fevil.com', FALLBACK) === FALLBACK,
    'Percent-encoded protocol-relative /%2F%2Fevil.com returns fallback'
  );

  // Test 16: Percent-encoded backslash (/%5Cevil.com)
  assert(
    getSafeRedirectPath('/%5Cevil.com', FALLBACK) === FALLBACK,
    'Percent-encoded backslash /%5Cevil.com returns fallback'
  );

  // Test 17: CRLF Header injection attempts (new lines)
  assert(
    getSafeRedirectPath('/dashboard\r\nSet-Cookie: stolen=1', FALLBACK) === FALLBACK,
    'CRLF carriage return returns fallback'
  );

  assert(
    getSafeRedirectPath('/dashboard\nLocation: https://evil.com', FALLBACK) === FALLBACK,
    'Newline character returns fallback'
  );

  // Test 18: Null byte injection
  assert(
    getSafeRedirectPath('/dashboard\0.evil.com', FALLBACK) === FALLBACK,
    'Null byte in path returns fallback'
  );

  console.log('');
  console.log('--- SECTION 6: Nullish, Empty, and Malformed Inputs ---');

  // Test 19: Null input
  assert(
    getSafeRedirectPath(null, FALLBACK) === FALLBACK,
    'null returns fallback'
  );

  // Test 20: Undefined input
  assert(
    getSafeRedirectPath(undefined, FALLBACK) === FALLBACK,
    'undefined returns fallback'
  );

  // Test 21: Empty string
  assert(
    getSafeRedirectPath('', FALLBACK) === FALLBACK,
    'Empty string returns fallback'
  );

  // Test 22: Whitespace-only string
  assert(
    getSafeRedirectPath('   ', FALLBACK) === FALLBACK,
    'Whitespace string returns fallback'
  );

  // Test 23: Custom fallback parameter
  assert(
    getSafeRedirectPath('https://evil.com', '/custom/safe') === '/custom/safe',
    'Custom fallback parameter is respected on unsafe input'
  );

  console.log('');
  console.log('================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Passed`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL SAFE REDIRECT TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED');
    console.log('================================================================');
    process.exit(1);
  }
}

runTests();
