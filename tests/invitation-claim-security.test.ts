#!/usr/bin/env npx tsx
/**
 * Invitation Claim Security & Anti-Takeover Test Suite (SEC-CRIT-02)
 *
 * Tests:
 * 1. Claiming with a client UUID as the raw token is strictly rejected (no IDOR fallback).
 * 2. Claiming with an invalid / wrong token fails with INVALID_TOKEN.
 * 3. Claiming with a valid token succeeds once and binds the user.
 * 4. A second claim attempt on the same token fails with ALREADY_CLAIMED or CLIENT_ALREADY_CONNECTED.
 * 5. Claiming with an email that does not match the invitation fails with EMAIL_MISMATCH.
 * 6. Claiming with an unconfirmed email account fails with EMAIL_UNCONFIRMED.
 */

process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

import { FlowDeskStore } from '../src/backend/store/storage-store';
import { InvitationService, hashInvitationToken, generateSecureInvitationToken } from '../src/backend/invitations/invitation-service';
import { Client } from '../src/shared/types';

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

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   INVITATION CLAIM SECURITY & ANTI-TAKEOVER TEST SUITE       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Setup mock client in FlowDeskStore
  const testClientId = `cli-sec-test-${Date.now()}`;
  const testClientEmail = 'authorized.client@cyberdyne.io';

  const testClient: Client = {
    id: testClientId,
    name: 'Security Test Client',
    company: 'SecCorp Global',
    email: testClientEmail,
    phone: '+1 555-0199',
    avatarUrl: '',
    status: 'active',
    healthBadge: 'healthy',
    totalBilled: 5000,
    activeProjectsCount: 1,
    country: 'United States',
    currency: 'USD',
    createdAt: new Date().toISOString(),
  };

  FlowDeskStore.createClient(testClient);

  // Create valid invitation for this client
  const { rawToken } = FlowDeskStore.createOrGetInvitation(testClientId, testClientEmail);

  console.log('--- SECTION 1: Tokenless Takeover Protection (IDOR Prevention) ---');

  // Test 1: Attempt to claim using client UUID as token (should fail)
  const uuidClaimResult = await InvitationService.claimInvitation(testClientId, 'attacker-user-id', 'attacker@evil.com', { isEmailConfirmed: true });
  assert(
    uuidClaimResult.success === false && uuidClaimResult.errorCode === 'INVALID_TOKEN',
    'Claiming with raw client UUID as token is strictly rejected',
    `Expected INVALID_TOKEN, got ${uuidClaimResult.errorCode}`
  );

  // Test 2: Attempt to claim with invalid/random token
  const randomToken = generateSecureInvitationToken();
  const randomClaimResult = await InvitationService.claimInvitation(randomToken, 'attacker-user-id', 'attacker@evil.com', { isEmailConfirmed: true });
  assert(
    randomClaimResult.success === false && randomClaimResult.errorCode === 'INVALID_TOKEN',
    'Claiming with non-existent token fails with INVALID_TOKEN',
    `Expected INVALID_TOKEN, got ${randomClaimResult.errorCode}`
  );

  console.log('');
  console.log('--- SECTION 2: Email Mismatch & Unconfirmed Email Protections ---');

  // Test 3: Attempt to claim with wrong email (email mismatch)
  const mismatchResult = await InvitationService.claimInvitation(rawToken, 'attacker-user-id', 'attacker@evil.com', { isEmailConfirmed: true });
  assert(
    mismatchResult.success === false && mismatchResult.errorCode === 'EMAIL_MISMATCH',
    'Claiming with mismatched email is rejected with EMAIL_MISMATCH',
    `Expected EMAIL_MISMATCH, got ${mismatchResult.errorCode}`
  );

  // Test 4: Attempt to claim with unconfirmed email (isEmailConfirmed = false)
  const unconfirmedResult = await InvitationService.claimInvitation(rawToken, 'legit-user-id', testClientEmail, { isEmailConfirmed: false });
  assert(
    unconfirmedResult.success === false && unconfirmedResult.errorCode === 'EMAIL_UNCONFIRMED',
    'Claiming with unconfirmed email is rejected with EMAIL_UNCONFIRMED',
    `Expected EMAIL_UNCONFIRMED, got ${unconfirmedResult.errorCode}`
  );

  console.log('');
  console.log('--- SECTION 3: Legitimate Single-Use Claim & Race Prevention ---');

  // Test 5: Legitimate claim with correct email and confirmed status
  const legitimateUserId = 'usr-legit-client-001';
  const legitResult = await InvitationService.claimInvitation(rawToken, legitimateUserId, testClientEmail, { isEmailConfirmed: true });
  assert(
    legitResult.success === true,
    'Legitimate claim with matching confirmed email succeeds',
    legitResult.error
  );

  // Test 6: Re-claim attempt by different user on already claimed token
  const secondClaimResult = await InvitationService.claimInvitation(rawToken, 'usr-second-user-002', testClientEmail, { isEmailConfirmed: true });
  assert(
    secondClaimResult.success === false && secondClaimResult.errorCode === 'ALREADY_CLAIMED',
    'Second claim on claimed token is rejected with ALREADY_CLAIMED',
    `Expected ALREADY_CLAIMED, got ${secondClaimResult.errorCode}`
  );

  console.log('');
  console.log('================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Passed`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL INVITATION CLAIM SECURITY TESTS PASSED!');
    console.log('================================================================');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED');
    console.log('================================================================');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in invitation claim security test runner:', err);
  process.exit(1);
});
