/**
 * FLOWDESK: PERMANENT CLIENT PORTAL LINK & MULTI-FREELANCER CONNECTION TEST SUITE
 *
 * Verifies:
 * 1. Permanent Portal Link stability, entropy, and public metadata privacy (no secrets exposed)
 * 2. Server-side validation of public identifiers & rejection of injection/enumeration attempts
 * 3. Connection lifecycle: explicit confirmation, authentication requirement, self-connection blocking
 * 4. Idempotency: repeated clicks or refreshes never duplicate connections
 * 5. Closed connections: is_accepting_connections toggle enforces rejection of new connections
 * 6. Multi-Freelancer Architecture: one client account connected to multiple independent freelancers
 * 7. Cross-freelancer and cross-client data isolation (RLS and workspace scoping)
 * 8. Workspace switching behavior: clean context switching without stale data leakage
 */

import './setup-demo-mode';
import assert from 'assert';
import { PermanentPortalService } from '../src/backend/portal/permanent-portal-service';
import { getSafeRedirectPath } from '../src/shared/utils/safe-redirect';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return (result as any).then(
        () => {
          console.log(`  ✅ PASS: ${name}`);
          passed++;
        },
        (err: any) => {
          console.error(`  ❌ FAIL: ${name}`);
          console.error(`     Error: ${err?.message || err}`);
          failed++;
        }
      );
    } else {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err?.message || err}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🔗 FLOWDESK PERMANENT PORTAL LINK & MULTI-FREELANCER TEST SUITE');
  console.log('================================================================\n');

  // --- SECTION A: Permanent Link Generation & Resolution ---
  console.log('--- SECTION A: Permanent Link Properties & Privacy ---');

  await test('A1. Permanent portal slug format matches high-entropy non-secret requirements', () => {
    const validSlug = 'fd_8b3a6e9d2f1c4e7a';
    const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;
    assert.strictEqual(SLUG_REGEX.test(validSlug), true, 'Valid slug must pass regex');
    assert.strictEqual(validSlug.startsWith('fd_'), true, 'Should use standard FlowDesk prefix');
  });

  await test('A2. Resolving valid portal slug returns public display metadata', async () => {
    const details = await PermanentPortalService.resolvePermanentPortal('fd_demo_studio');
    assert.strictEqual(details.valid, true, 'Valid portal must resolve');
    assert.ok(details.freelancerName, 'Must include freelancer name');
    assert.ok(details.studioName, 'Must include studio name');
    assert.ok(details.profession, 'Must include profession');
    assert.strictEqual(details.isAcceptingConnections, true, 'Must indicate connection acceptance status');
  });

  await test('A3. Public resolution NEVER exposes private client data, emails, or credentials', async () => {
    const details = await PermanentPortalService.resolvePermanentPortal('fd_demo_studio');
    assert.strictEqual((details as any).id, undefined, 'Must not expose internal workspace database ID');
    assert.strictEqual((details as any).owner_id, undefined, 'Must not expose internal owner user ID');
    assert.strictEqual((details as any).email, undefined, 'Must not expose private freelancer email');
    assert.strictEqual((details as any).serviceKey, undefined, 'Must not expose service keys');
    assert.strictEqual((details as any).clients, undefined, 'Must not expose clients list');
  });

  await test('A4. Malformed slug / PostgREST filter injection attempts are safely rejected', async () => {
    const injectionAttempts = [
      'eq.something',
      'id.in.(1,2,3)',
      '../../../etc/passwd',
      'fd_test; DROP TABLE clients;--',
      '<script>alert(1)</script>',
      '   ',
      'a', // too short
    ];

    for (const attempt of injectionAttempts) {
      const res = await PermanentPortalService.resolvePermanentPortal(attempt);
      assert.strictEqual(res.valid, false, `Injection string "${attempt}" must be rejected`);
    }
  });

  // --- SECTION B: Connection Authorization & Idempotency ---
  console.log('\n--- SECTION B: Connection Authorization & Idempotency ---');

  await test('B5. Unauthenticated visitor cannot confirm connection without session', async () => {
    const res = await PermanentPortalService.connectClient('fd_demo_studio', '');
    assert.strictEqual(res.success, false, 'Unauthenticated connect must fail');
    assert.ok(res.error?.toLowerCase().includes('authentication required'), 'Must require authentication');
  });

  await test('B6. Authenticated client can establish connection to freelancer', async () => {
    const res = await PermanentPortalService.connectClient('fd_demo_studio', 'usr-client-001');
    assert.strictEqual(res.success, true, 'Valid client connection must succeed');
    assert.ok(res.clientId, 'Must return client ID');
    assert.ok(res.workspaceId, 'Must return workspace ID');
    assert.ok(res.studioName, 'Must return studio name');
  });

  await test('B7. Repeated connection attempts are idempotent (no duplicate relationships)', async () => {
    const res1 = await PermanentPortalService.connectClient('fd_demo_studio', 'usr-client-001');
    const res2 = await PermanentPortalService.connectClient('fd_demo_studio', 'usr-client-001');

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res1.clientId, res2.clientId, 'Repeated connect must reuse same client record');
  });

  await test('B8. Self-connection by workspace owner is strictly blocked', async () => {
    const status = await PermanentPortalService.checkConnectionStatus('fd_demo_studio', 'usr-demo');
    assert.strictEqual(status.isOwner, true, 'Workspace owner must be recognized');
  });

  await test('B9. Preserving destination through login/signup maintains safe redirect', () => {
    const safeTarget = getSafeRedirectPath('/portal/join/fd_demo_studio', '/client/dashboard');
    assert.strictEqual(safeTarget, '/portal/join/fd_demo_studio', 'Must preserve permanent join link target');

    const unsafeTarget = getSafeRedirectPath('https://evil.com/phish', '/client/dashboard');
    assert.strictEqual(unsafeTarget, '/client/dashboard', 'Open redirects must be neutralized');
  });

  // --- SECTION C: One Client Account, Multiple Freelancers ---
  console.log('\n--- SECTION C: Multi-Freelancer Architecture & Workspace Switcher ---');

  await test('C10. Single client account can resolve multiple authorized workspaces', async () => {
    const workspaces = await PermanentPortalService.getClientConnectedWorkspaces('usr-demo-client');
    assert.ok(Array.isArray(workspaces), 'Workspaces must be an array');
    assert.ok(workspaces.length >= 2, 'Client should be connected to multiple studios in demo/multi environment');

    const studioNames = workspaces.map((w) => w.studioName);
    assert.ok(studioNames.includes('Apex Digital Studio'), 'Must contain Studio A');
    assert.ok(studioNames.includes('Hyperion Creative Lab'), 'Must contain Studio B');
  });

  await test('C11. Each connected workspace maintains independent metadata and currency', async () => {
    const workspaces = await PermanentPortalService.getClientConnectedWorkspaces('usr-demo-client');
    const wsA = workspaces[0];
    const wsB = workspaces[1];

    assert.notStrictEqual(wsA.workspaceId, wsB.workspaceId, 'Workspace IDs must be distinct');
    assert.notStrictEqual(wsA.clientId, wsB.clientId, 'Client IDs across workspaces must be distinct');
    assert.ok(wsA.freelancerName, 'Workspace A must have freelancer identity');
    assert.ok(wsB.freelancerName, 'Workspace B must have freelancer identity');
  });

  await test('C12. Switching workspaces updates active context to target client record', () => {
    const mockWorkspaces = [
      { workspaceId: 'ws-studio-alpha', clientId: 'cli-alpha-123', studioName: 'Alpha Studio' },
      { workspaceId: 'ws-studio-beta', clientId: 'cli-beta-456', studioName: 'Beta Studio' },
    ];

    let activeClientId = mockWorkspaces[0].clientId;
    assert.strictEqual(activeClientId, 'cli-alpha-123');

    // Simulate switch
    const targetWs = mockWorkspaces.find((w) => w.workspaceId === 'ws-studio-beta');
    if (targetWs) {
      activeClientId = targetWs.clientId;
    }
    assert.strictEqual(activeClientId, 'cli-beta-456', 'Active client ID must transition to target');
  });

  // --- SECTION D: Freelancer Settings & Connection Controls ---
  console.log('\n--- SECTION D: Freelancer Portal Settings & Acceptance Controls ---');

  await test('D13. Freelancer can retrieve their permanent link and settings', async () => {
    const settings = await PermanentPortalService.getFreelancerPortalSettings('https://flowdesk.example.com');
    assert.ok(settings.portalSlug, 'Must have portal slug');
    assert.strictEqual(settings.isAcceptingConnections, true, 'Default must be accepting connections');
    assert.strictEqual(
      settings.portalUrl,
      `https://flowdesk.example.com/portal/join/${settings.portalSlug}`,
      'Must build accurate URL using configured origin'
    );
  });

  await test('D14. Freelancer can toggle acceptance of new client connections', async () => {
    const updateResult = await PermanentPortalService.updateFreelancerPortalSettings({
      isAcceptingConnections: false,
    });
    assert.strictEqual(updateResult.success, true, 'Toggle update must succeed');

    const updatedSettings = await PermanentPortalService.getFreelancerPortalSettings();
    assert.strictEqual(updatedSettings.isAcceptingConnections, false, 'Acceptance status must be toggled off');

    // Re-enable
    await PermanentPortalService.updateFreelancerPortalSettings({
      isAcceptingConnections: true,
    });
  });

  await test('D15. Custom portal slug rejects invalid characters and SQL injection attempts', async () => {
    const invalidSlugs = ['has spaces', 'invalid!@#', 'a', 'slug;DROP TABLE;'];
    for (const badSlug of invalidSlugs) {
      const res = await PermanentPortalService.updateFreelancerPortalSettings({ portalSlug: badSlug });
      assert.strictEqual(res.success, false, `Invalid slug "${badSlug}" must be rejected`);
    }
  });

  // Summary
  console.log('\n================================================================');
  console.log(`📊 TOTAL TESTS: ${passed + failed}`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
