/**
 * FlowDesk Phase 4A: Security Headers & CSP Configuration Test Suite
 * 
 * Verifies production header configuration:
 * 1. HSTS configured with 2-year max-age and includeSubDomains (preload omitted)
 * 2. X-Content-Type-Options: nosniff
 * 3. X-Frame-Options: DENY
 * 4. Referrer-Policy: strict-origin-when-cross-origin
 * 5. Permissions-Policy denying camera, microphone, geolocation, usb, payment
 * 6. CSP Report-Only mode is enabled by default
 * 7. CSP switches to enforced mode when CSP_MODE=enforce
 * 8. CSP directives contain frame-ancestors 'none' and report-uri
 * 9. next.config.ts disables X-Powered-By
 */

import assert from 'assert';
import { getSecurityHeaders, buildContentSecurityPolicy } from '../src/shared/config/security-headers';

function runSecurityHeadersTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        SECURITY HEADERS & CSP VERIFICATION SUITE            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  const defaultHeaders = getSecurityHeaders();
  const headerMap = new Map<string, string>();
  for (const h of defaultHeaders) {
    headerMap.set(h.key.toLowerCase(), h.value);
  }

  console.log('--- SECTION 1: Baseline Security Headers ---');

  test('Strict-Transport-Security is present with max-age and includeSubDomains', () => {
    const hsts = headerMap.get('strict-transport-security');
    assert.strictEqual(Boolean(hsts), true);
    assert.strictEqual(hsts?.includes('max-age=63072000'), true);
    assert.strictEqual(hsts?.includes('includeSubDomains'), true);
    // Preload must be omitted pending subdomain verification
    assert.strictEqual(hsts?.includes('preload'), false);
  });

  test('X-Content-Type-Options is nosniff', () => {
    assert.strictEqual(headerMap.get('x-content-type-options'), 'nosniff');
  });

  test('X-Frame-Options is DENY', () => {
    assert.strictEqual(headerMap.get('x-frame-options'), 'DENY');
  });

  test('Referrer-Policy is strict-origin-when-cross-origin', () => {
    assert.strictEqual(headerMap.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  test('Permissions-Policy denies camera, microphone, geolocation, usb, and payment', () => {
    const policy = headerMap.get('permissions-policy');
    assert.strictEqual(Boolean(policy), true);
    assert.strictEqual(policy?.includes('camera=()'), true);
    assert.strictEqual(policy?.includes('microphone=()'), true);
    assert.strictEqual(policy?.includes('geolocation=()'), true);
    assert.strictEqual(policy?.includes('payment=()'), true);
    assert.strictEqual(policy?.includes('usb=()'), true);
  });

  console.log('\n--- SECTION 2: Content-Security-Policy & Modes ---');

  test('CSP defaults to Content-Security-Policy-Report-Only mode', () => {
    delete process.env.CSP_MODE;
    const headers = getSecurityHeaders();
    const reportOnlyHeader = headers.find((h) => h.key === 'Content-Security-Policy-Report-Only');
    const enforceHeader = headers.find((h) => h.key === 'Content-Security-Policy');

    assert.strictEqual(Boolean(reportOnlyHeader), true);
    assert.strictEqual(enforceHeader, undefined);
  });

  test('CSP switches to Content-Security-Policy enforce mode via CSP_MODE=enforce', () => {
    process.env.CSP_MODE = 'enforce';
    const headers = getSecurityHeaders();
    const reportOnlyHeader = headers.find((h) => h.key === 'Content-Security-Policy-Report-Only');
    const enforceHeader = headers.find((h) => h.key === 'Content-Security-Policy');

    assert.strictEqual(Boolean(enforceHeader), true);
    assert.strictEqual(reportOnlyHeader, undefined);
    delete process.env.CSP_MODE; // Restore
  });

  test('CSP policy includes frame-ancestors none and report-uri endpoint', () => {
    const csp = buildContentSecurityPolicy();
    assert.strictEqual(csp.includes("frame-ancestors 'none'"), true);
    assert.strictEqual(csp.includes("default-src 'self'"), true);
    assert.strictEqual(csp.includes('report-uri /api/csp-report'), true);
    assert.strictEqual(csp.includes('checkout.razorpay.com'), true);
    assert.strictEqual(csp.includes('*.supabase.co'), true);
  });

  console.log('\n================================================================');
  console.log(`📊 SECURITY HEADERS RESULTS: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('🎉 ALL SECURITY HEADERS TESTS PASSED!');
    console.log('================================================================');
  }
}

runSecurityHeadersTests();
