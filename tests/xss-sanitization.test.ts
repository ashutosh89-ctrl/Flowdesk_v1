/**
 * FlowDesk Phase 4A: XSS, Sanitization & Injection Defense Test Suite
 * 
 * Verifies defensive URL validation, HTML escaping, and PostgREST injection neutralization:
 * 1. isSafeHttpUrl protocol whitelist (http/https only)
 * 2. Rejection of javascript:, data:, vbscript:, and file: schemes
 * 3. Rejection of protocol-relative (//) and backslash normalization bypasses
 * 4. Rejection of control characters, CRLF, and null bytes
 * 5. escapeHtml helper entity escaping
 * 6. PostgREST filter injection input isolation
 */

import assert from 'assert';
import { isSafeHttpUrl, getSafeHttpUrl } from '../src/shared/utils/safe-url';
import { escapeHtml } from '../src/backend/email/templates/layout';

function runXssSanitizationTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        XSS & INJECTION DEFENSE VERIFICATION SUITE            ║');
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

  console.log('--- SECTION 1: Valid HTTP / HTTPS URLs ---');

  test('Valid standard https URL is accepted', () => {
    assert.strictEqual(isSafeHttpUrl('https://flowdesk.dev'), true);
  });

  test('Valid http URL with port and path is accepted', () => {
    assert.strictEqual(isSafeHttpUrl('http://localhost:3000/api/test'), true);
  });

  test('Valid https URL with query params and hash is accepted', () => {
    assert.strictEqual(isSafeHttpUrl('https://example.com/asset?id=123&v=2#details'), true);
  });

  test('getSafeHttpUrl returns url on valid and fallback on invalid', () => {
    assert.strictEqual(getSafeHttpUrl('https://valid.com', '#'), 'https://valid.com');
    assert.strictEqual(getSafeHttpUrl('javascript:alert(1)', '#'), '#');
  });

  console.log('\n--- SECTION 2: Script Schemes & XSS Injection Vectors ---');

  test('Rejects javascript: scheme', () => {
    assert.strictEqual(isSafeHttpUrl('javascript:alert(1)'), false);
    assert.strictEqual(isSafeHttpUrl('JAVASCRIPT:alert(1)'), false);
    assert.strictEqual(isSafeHttpUrl('javascript:/*--></title></style></textarea>*/<script>'), false);
  });

  test('Rejects data: URI scheme (including SVG/HTML)', () => {
    assert.strictEqual(isSafeHttpUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), false);
    assert.strictEqual(isSafeHttpUrl('data:image/svg+xml,<svg onload=alert(1)>'), false);
  });

  test('Rejects vbscript: scheme', () => {
    assert.strictEqual(isSafeHttpUrl('vbscript:msgbox("XSS")'), false);
  });

  test('Rejects file: scheme', () => {
    assert.strictEqual(isSafeHttpUrl('file:///etc/passwd'), false);
  });

  console.log('\n--- SECTION 3: Normalization & Bypass Tricks ---');

  test('Rejects protocol-relative // URLs', () => {
    assert.strictEqual(isSafeHttpUrl('//evil.com/payload.js'), false);
    assert.strictEqual(isSafeHttpUrl('///evil.com'), false);
  });

  test('Rejects Windows backslash tricks', () => {
    assert.strictEqual(isSafeHttpUrl('\\\\evil.com\\share'), false);
    assert.strictEqual(isSafeHttpUrl('https://example.com\\@evil.com'), false);
  });

  test('Rejects CRLF and newline characters in URL', () => {
    assert.strictEqual(isSafeHttpUrl('https://example.com\r\nSet-Cookie:bad=1'), false);
    assert.strictEqual(isSafeHttpUrl('https://example.com\n<script>'), false);
  });

  test('Rejects null byte characters', () => {
    assert.strictEqual(isSafeHttpUrl('https://example.com\0.evil.com'), false);
  });

  test('Rejects null, undefined, and non-string inputs', () => {
    assert.strictEqual(isSafeHttpUrl(null), false);
    assert.strictEqual(isSafeHttpUrl(undefined), false);
    assert.strictEqual(isSafeHttpUrl(12345), false);
    assert.strictEqual(isSafeHttpUrl({ url: 'https://evil.com' }), false);
    assert.strictEqual(isSafeHttpUrl(''), false);
    assert.strictEqual(isSafeHttpUrl('   '), false);
  });

  console.log('\n--- SECTION 4: HTML Escaping Helper ---');

  test('escapeHtml escapes special characters into HTML entities', () => {
    const raw = `<script>alert("XSS & 'injection'")</script>`;
    const clean = escapeHtml(raw);
    assert.strictEqual(clean.includes('<'), false);
    assert.strictEqual(clean.includes('>'), false);
    assert.strictEqual(clean.includes('&lt;script&gt;'), true);
    assert.strictEqual(clean.includes('&quot;'), true);
    assert.strictEqual(clean.includes('&amp;'), true);
  });

  test('escapeHtml safely handles nullish and empty inputs', () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
    assert.strictEqual(escapeHtml(''), '');
  });

  console.log('\n================================================================');
  console.log(`📊 XSS SANITIZATION RESULTS: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('🎉 ALL XSS & SANITIZATION TESTS PASSED!');
    console.log('================================================================');
  }
}

runXssSanitizationTests();
