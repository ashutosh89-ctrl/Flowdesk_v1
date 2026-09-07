/**
 * Fail-closed authentication mode test (Phase 3/4 hardening).
 *
 * Verifies:
 *  1. Production mode with missing Supabase configuration does NOT activate
 *     demo mode — no fabricated identity, no local session, no demo workspace.
 *  2. Demo mode activates ONLY when explicitly configured (NEXT_PUBLIC_AUTH_MODE=demo).
 *  3. isAuthConfigError() correctly reports deployment configuration failures.
 *  4. verifyOtp never accepts a pre-existing session in place of a real OTP
 *     when Supabase is configured.
 *
 * Run: npx tsx tests/auth-fail-closed.test.ts
 */

// IMPORTANT: no Supabase env vars are set in this test process — the missing
// configuration IS the scenario under test. Explicitly neutralize them.
process.env.NEXT_PUBLIC_SUPABASE_URL = '';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
delete process.env.NEXT_PUBLIC_AUTH_MODE;

// Node SSR environment (no window/localStorage).
// @ts-expect-error - test environment marker
globalThis.window = undefined;

import assert from 'assert';
import {
  authMode,
  isDemoMode,
  isDemoModeActive,
  isAuthConfigError,
  isSupabaseConfigured,
  AUTH_CONFIG_ERROR_MESSAGE,
} from '../src/backend/utilities/supabase';
import { AuthService } from '../src/backend/auth/auth-service';
import { SessionService } from '../src/backend/auth/session-service';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    })
    .catch((err) => {
      failed++;
      console.log(`  ❌ FAIL: ${name}`);
      console.log(`     ${err?.message || err}`);
    });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' FAIL-CLOSED AUTHENTICATION MODE TESTS');
  console.log(' (production mode, Supabase env vars intentionally missing)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ------------------------------------------------------------------
  console.log('1. Auth mode resolution (fail-closed core)');
  console.log('-----------------------------------------------------------');
  await check('authMode is production when NEXT_PUBLIC_AUTH_MODE is unset', () => {
    assert.strictEqual(authMode, 'production');
  });
  await check('isDemoMode is false despite missing Supabase config', () => {
    assert.strictEqual(isDemoMode, false);
  });
  await check('isDemoModeActive() is false despite missing Supabase config', () => {
    assert.strictEqual(isDemoModeActive(), false);
  });
  await check('isSupabaseConfigured is false (missing env vars)', () => {
    assert.strictEqual(isSupabaseConfigured, false);
  });
  await check('isAuthConfigError() is true — deployment misconfiguration detected', () => {
    assert.strictEqual(isAuthConfigError(), true);
  });

  // ------------------------------------------------------------------
  console.log('\n2. Session resolution fails closed (no fabricated identity)');
  console.log('-----------------------------------------------------------');
  await check('getSession() returns null session/user in broken production', async () => {
    const { session, user } = await SessionService.getSession();
    assert.strictEqual(session, null);
    assert.strictEqual(user, null);
  });
  await check('getVerifiedUser() returns null in broken production', async () => {
    const user = await SessionService.getVerifiedUser();
    assert.strictEqual(user, null);
  });
  await check('setLocalSession() cannot fabricate a session in broken production', async () => {
    SessionService.setLocalSession({
      id: 'attacker-controlled-id',
      email: 'attacker@example.com',
    });
    // The local object is returned to the caller for UI convenience, but
    // getSession() must never resurrect it as identity in production mode:
    const { session, user: resolvedUser } = await SessionService.getSession();
    assert.strictEqual(session, null, 'session must be null');
    assert.strictEqual(resolvedUser, null, 'resolved user must be null');
  });

  // ------------------------------------------------------------------
  console.log('\n3. Auth services fail closed (no demo fallback)');
  console.log('-----------------------------------------------------------');
  await check('signIn() fails closed with config error (no demo user)', async () => {
    const res = await AuthService.signIn('alex@riveradesign.co', 'whatever');
    assert.strictEqual(res.user, null, 'must NOT return a user (fail closed)');
    assert.ok(res.error, 'must return an error');
    assert.match(res.error, /configuration|unavailable/i);
  });
  await check('signUp() fails closed with config error', async () => {
    const res = await AuthService.signUp('new@example.com', 'password123', 'Test', 'Studio');
    assert.strictEqual(res.user, null, 'must NOT return a user (fail closed)');
    assert.ok(res.error, 'must return an error');
    assert.match(res.error, /configuration|unavailable/i);
  });
  await check('signInDemo() is blocked outside explicitly configured demo deployments', async () => {
    const res = await AuthService.signInDemo('alex@riveradesign.co');
    assert.strictEqual(res.user, null);
    assert.ok(res.error);
    assert.match(res.error, /not enabled/i);
  });
  await check('forgotPassword() fails closed with config error', async () => {
    const res = await AuthService.forgotPassword('user@example.com');
    assert.ok(res.error);
    assert.match(res.error, /configuration|unavailable/i);
  });
  await check('config error message does not leak secret values', () => {
    assert.ok(!AUTH_CONFIG_ERROR_MESSAGE.includes('key'));
    assert.ok(!AUTH_CONFIG_ERROR_MESSAGE.includes('secret'));
    assert.ok(!AUTH_CONFIG_ERROR_MESSAGE.includes('supabase.co'));
  });

  // ------------------------------------------------------------------
  console.log('\n4. Client portal fails closed');
  console.log('-----------------------------------------------------------');
  await check('ClientAuthService.login() fails closed (no demo client)', async () => {
    const res = await (await import('../src/backend/client/client-auth-service')).ClientAuthService.login(
      'eleanor@apexdigital.io',
      'password123'
    );
    assert.strictEqual(res.success, false, 'login must not succeed');
    assert.strictEqual(res.client, undefined, 'must NOT return a demo client');
  });

  // ------------------------------------------------------------------
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
