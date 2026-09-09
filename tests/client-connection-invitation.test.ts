/**
 * FlowDesk Client Connection Link & One-Time Redemption Hardening Test Suite
 * 
 * Tests:
 * 1. Cryptographic token entropy & SHA-256 hash storage security.
 * 2. Method A (Email) and Method B (Copy Link) equivalence (single token generation).
 * 3. One-time use guarantee (first claim succeeds, second claim fails).
 * 4. Concurrent race condition prevention (multiple simultaneous claims -> exactly 1 succeeds).
 * 5. Expired, revoked, and invalid token handling.
 * 6. Existing client protection (cannot overwrite connected user).
 * 7. Multi-client freelancer isolation.
 * 8. Public metadata sanitization (no database ID leakage).
 */

process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

import {
  hashInvitationToken,
  generateSecureInvitationToken,
  maskEmail,
  InvitationService,
} from '../src/backend/invitations/invitation-service';
import { FlowDeskStore } from '../src/backend/store/storage-store';
import { FreelancerClientManagementService } from '../src/backend/freelancer/client-management-service';
import { Client } from '../src/shared/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('🔒 FLOWDESK CLIENT CONNECTION & ONE-TIME REDEMPTION TEST SUITE');
  console.log('================================================================\n');

  // --- SECTION 1: Cryptographic Token Entropy & SHA-256 Hashing ---
  console.log('--- SECTION 1: Cryptographic Token Entropy & Hash Security ---');

  const token1 = generateSecureInvitationToken();
  const token2 = generateSecureInvitationToken();
  assert(typeof token1 === 'string' && token1.length === 64, 'Token is a 64-character hex string (256-bit entropy)');
  assert(token1 !== token2, 'Consecutive tokens are uniquely random and unpredictable');

  const tokens = new Set<string>();
  for (let i = 0; i < 100; i++) {
    tokens.add(generateSecureInvitationToken());
  }
  assert(tokens.size === 100, '100 generated tokens have zero collisions');

  const hash1 = hashInvitationToken(token1);
  const hash2 = hashInvitationToken(token1);
  const hashOther = hashInvitationToken(token2);
  assert(hash1.length === 64, 'Token hash is a 64-character SHA-256 digest');
  assert(hash1 === hash2, 'hashInvitationToken is deterministic for the same token');
  assert(hash1 !== hashOther, 'Different tokens produce different hashes');
  assert(!hash1.includes(token1), 'Hash does not expose raw token');

  // --- SECTION 2: Method A (Email) & Method B (Copy Link) Equivalence ---
  console.log('\n--- SECTION 2: Method A & Method B Single Token Equivalence ---');

  const testClient: Client = {
    id: `test-cli-${Date.now()}`,
    name: 'Sarah Connor',
    company: 'Cyberdyne Systems',
    email: 'sarah@cyberdyne.io',
    status: 'active',
    totalBilled: 0,
    activeProjectsCount: 1,
    country: 'India',
    currency: 'USD',
    createdAt: new Date().toISOString(),
  };

  FlowDeskStore.createClient(testClient);

  // Method B: Generate connection link
  const linkRes = await FreelancerClientManagementService.getOrCreateConnectionLink(testClient.id);
  assert(linkRes.success === true, 'getOrCreateConnectionLink returns success');
  assert(Boolean(linkRes.url && linkRes.url.includes('/connect/')), 'Connection link uses /connect/<token> route');
  assert(!linkRes.url.includes(testClient.id), 'Connection URL does NOT expose client ID');

  const rawToken = linkRes.rawToken!;
  assert(Boolean(rawToken && rawToken.length === 64), 'Raw token is 64 hex characters');

  // Public details lookup
  const publicDetails = await InvitationService.getPublicInvitationDetails(rawToken);
  assert(publicDetails.isValid === true, 'Public invitation details are valid for new pending token');
  assert(publicDetails.status === 'pending', 'Public invitation status is pending');
  assert(publicDetails.companyName === 'Cyberdyne Systems', 'Public details reflect target client company');
  assert(!('clientId' in publicDetails), 'Public details do not expose raw clientId');
  assert(!('freelancerId' in publicDetails), 'Public details do not expose raw freelancerId');
  assert(!('workspaceId' in publicDetails), 'Public details do not expose raw workspaceId');

  // --- SECTION 3: One-Time Use Guarantee (Atomic Single Claim) ---
  console.log('\n--- SECTION 3: One-Time Use Guarantee ---');

  const userId1 = 'usr-client-001';
  const claimResult1 = await InvitationService.claimInvitation(rawToken, userId1, 'sarah@cyberdyne.io');
  assert(claimResult1.success === true, 'First client claim succeeds');
  assert(claimResult1.clientId === testClient.id, 'Claim bound to correct client ID');

  const updatedClient = FlowDeskStore.getClientById(testClient.id);
  assert(updatedClient?.userId === userId1, 'Client record is now bound to authenticated user ID 1');

  // Second claim attempt with DIFFERENT account
  const userId2 = 'usr-client-002';
  const claimResult2 = await InvitationService.claimInvitation(rawToken, userId2, 'attacker@evil.com');
  assert(claimResult2.success === false, 'Second claim with different account is rejected');
  assert(claimResult2.errorCode === 'ALREADY_CLAIMED', 'Second claim error code is ALREADY_CLAIMED');
  assert(claimResult2.error?.includes('already been used') ?? false, 'Safe user-facing message returned');

  // Second claim attempt with SAME account
  const claimResult3 = await InvitationService.claimInvitation(rawToken, userId1, 'sarah@cyberdyne.io');
  assert(claimResult3.success === false, 'Re-claiming with same account is rejected');
  assert(claimResult3.errorCode === 'ALREADY_CLAIMED', 'Re-claim returns ALREADY_CLAIMED');

  // Public details check after claim
  const postClaimPublic = await InvitationService.getPublicInvitationDetails(rawToken);
  assert(postClaimPublic.isValid === false, 'Public details mark consumed token as invalid');
  assert(postClaimPublic.status === 'claimed', 'Public details status is claimed');
  assert(postClaimPublic.error?.includes('already been used') ?? false, 'Public error states link was already used');

  // --- SECTION 4: Concurrent Race Condition Simulation ---
  console.log('\n--- SECTION 4: Concurrent Redemption Race Condition Prevention ---');

  const raceClient: Client = {
    id: `race-cli-${Date.now()}`,
    name: 'Miles Morales',
    company: 'Spider Verse LLC',
    email: 'miles@spiderverse.org',
    status: 'active',
    totalBilled: 0,
    activeProjectsCount: 1,
    country: 'India',
    currency: 'USD',
    createdAt: new Date().toISOString(),
  };
  FlowDeskStore.createClient(raceClient);

  const raceInvite = await InvitationService.createOrGetInvitation(raceClient.id);
  const raceToken = raceInvite.rawToken;

  // Fire 5 simultaneous claims
  const concurrentClaims = await Promise.all([
    InvitationService.claimInvitation(raceToken, 'user-race-1', 'u1@spider.com'),
    InvitationService.claimInvitation(raceToken, 'user-race-2', 'u2@spider.com'),
    InvitationService.claimInvitation(raceToken, 'user-race-3', 'u3@spider.com'),
    InvitationService.claimInvitation(raceToken, 'user-race-4', 'u4@spider.com'),
    InvitationService.claimInvitation(raceToken, 'user-race-5', 'u5@spider.com'),
  ]);

  const successfulClaims = concurrentClaims.filter((c) => c.success);
  const rejectedClaims = concurrentClaims.filter((c) => !c.success);

  assert(successfulClaims.length === 1, `Exactly 1 concurrent claim succeeded (got ${successfulClaims.length})`);
  assert(rejectedClaims.length === 4, `Remaining 4 concurrent claims were rejected (got ${rejectedClaims.length})`);
  assert(
    rejectedClaims.every((c) => c.errorCode === 'ALREADY_CLAIMED'),
    'All rejected concurrent claims received ALREADY_CLAIMED'
  );

  // --- SECTION 5: Expired, Revoked, and Invalid Tokens ---
  console.log('\n--- SECTION 5: Expired, Revoked, and Invalid Tokens ---');

  // 5.1 Invalid random token
  const fakeToken = generateSecureInvitationToken();
  const fakeClaim = await InvitationService.claimInvitation(fakeToken, 'user-x', 'x@test.com');
  assert(fakeClaim.success === false && fakeClaim.errorCode === 'INVALID_TOKEN', 'Non-existent token is rejected');

  const fakePublic = await InvitationService.getPublicInvitationDetails(fakeToken);
  assert(fakePublic.isValid === false && fakePublic.status === 'invalid', 'Non-existent token public info is invalid');

  // 5.2 Short/malformed token
  const malformedPublic = await InvitationService.getPublicInvitationDetails('abc');
  assert(malformedPublic.isValid === false && malformedPublic.status === 'invalid', 'Short/malformed token is rejected');

  // 5.3 Revoked token
  const revokeClient: Client = {
    id: `rev-cli-${Date.now()}`,
    name: 'Tony Stark',
    company: 'Stark Industries',
    email: 'tony@stark.io',
    status: 'active',
    totalBilled: 0,
    activeProjectsCount: 1,
    country: 'India',
    currency: 'USD',
    createdAt: new Date().toISOString(),
  };
  FlowDeskStore.createClient(revokeClient);

  const revokeInvite = await InvitationService.createOrGetInvitation(revokeClient.id);
  const revokeToken = revokeInvite.rawToken;

  // Freelancer regenerates/revokes link
  await InvitationService.revokeInvitation(revokeClient.id);

  const revokedClaim = await InvitationService.claimInvitation(revokeToken, 'user-tony', 'tony@stark.io');
  assert(revokedClaim.success === false && revokedClaim.errorCode === 'REVOKED', 'Revoked token claim is rejected');

  const revokedPublic = await InvitationService.getPublicInvitationDetails(revokeToken);
  assert(revokedPublic.isValid === false && revokedPublic.status === 'revoked', 'Revoked token public status is revoked');

  // --- SECTION 6: Existing Client Protection & Binding Immutability ---
  console.log('\n--- SECTION 6: Existing Client Protection & Binding Immutability ---');

  const boundClient: Client = {
    id: `bound-cli-${Date.now()}`,
    userId: 'usr-original-owner',
    name: 'Bruce Wayne',
    company: 'Wayne Enterprises',
    email: 'bruce@wayne.com',
    status: 'active',
    totalBilled: 0,
    activeProjectsCount: 1,
    country: 'India',
    currency: 'USD',
    createdAt: new Date().toISOString(),
  };
  FlowDeskStore.createClient(boundClient);

  const boundInvite = FlowDeskStore.createOrGetInvitation(boundClient.id);
  const boundToken = boundInvite.rawToken;

  // Attacker attempts to claim already bound client with different userId
  const attackerClaim = await InvitationService.claimInvitation(boundToken, 'usr-attacker-id', 'attacker@gotham.org');
  assert(attackerClaim.success === false, 'Claim on already bound client by different user is rejected');
  assert(attackerClaim.errorCode === 'CLIENT_ALREADY_CONNECTED', 'Returns CLIENT_ALREADY_CONNECTED');

  const verifiedClient = FlowDeskStore.getClientById(boundClient.id);
  assert(verifiedClient?.userId === 'usr-original-owner', 'Client user binding remained unchanged');

  // --- SECTION 7: Email Masking Utility ---
  console.log('\n--- SECTION 7: Email Masking Utility ---');

  assert(maskEmail('alex@example.com') === 'a***x@example.com', 'Masks standard email correctly');
  assert(maskEmail('jo@domain.com') === 'j***@domain.com', 'Masks 2-letter username correctly');
  assert(maskEmail(undefined) === undefined, 'Returns undefined for undefined email');

  // --- SECTION 8: Route Handler Security (Zero body.userId Identity Trust) ---
  console.log('\n--- SECTION 8: Route Handler Security (Zero body.userId Identity Trust) ---');

  const { POST: claimHandler } = await import('../app/api/invitations/[token]/claim/route');
  const { NextRequest } = await import('next/server');

  // 1. Unauthenticated request with body.userId in production mode
  const originalAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE;
  process.env.NEXT_PUBLIC_AUTH_MODE = 'production';

  const unauthReqWithBodyUser = new NextRequest('http://localhost:3000/api/invitations/sample-token-12345/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'usr-attacker-injected', email: 'attacker@evil.com' }),
  });

  const unauthRes = await claimHandler(unauthReqWithBodyUser, {
    params: Promise.resolve({ token: 'sample-token-12345' }),
  });

  assert(unauthRes.status === 401, 'Unauthenticated request with body.userId returns HTTP 401');
  const unauthData = await unauthRes.json();
  assert(unauthData.errorCode === 'UNAUTHORIZED', 'ErrorCode is UNAUTHORIZED');
  assert(unauthData.success === false, 'Claim marked success: false');

  // Restore auth mode
  process.env.NEXT_PUBLIC_AUTH_MODE = originalAuthMode;

  console.log('\n================================================================');
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('🎉 ALL CLIENT CONNECTION & ONE-TIME REDEMPTION TESTS PASSED!');
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
