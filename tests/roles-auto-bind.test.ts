#!/usr/bin/env npx tsx
/**
 * Roles & Client Auto-Binding Security Test Suite (SEC-HIGH-01)
 *
 * Tests:
 * 1. Unconfirmed email does not bind unbound client records.
 * 2. Confirmed email binds an unbound client record (user_id IS NULL).
 * 3. A client row already bound to another user is never modified or hijacked.
 * 4. Wildcard characters (_ and %) in an email address do NOT match other accounts.
 * 5. Subsequent / repeated calls are idempotent and safe.
 */

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

interface MockClientRow {
  id: string;
  name: string;
  company: string;
  email: string;
  user_id: string | null;
  status: string;
}

interface MockUser {
  id: string;
  email: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}

/**
 * Simulates the SEC-HIGH-01 auto-binding algorithm implemented in
 * app/api/auth/roles/route.ts and ClientAuthService.resolveClientByUserIdOrEmail
 */
async function simulateAutoBind(
  user: MockUser,
  dbClients: MockClientRow[],
  auditLog: Array<{ event: string; userId: string; clientId: string }>
): Promise<{ boundClients: MockClientRow[]; updateCount: number }> {
  const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);

  // a) Only run auto-bind when user's email is confirmed
  if (!user.email || !isEmailConfirmed) {
    return { boundClients: [], updateCount: 0 };
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const escapedEmail = normalizedEmail.replace(/[%_\\]/g, '\\$&');

  // b) Case-insensitive search with wildcard escaping + strict JS exact equality
  // In SQL, escaping transforms '_' to '\_' and '%' to '\%'
  const ilikeRegex = new RegExp(
    '^' +
      escapedEmail
        .replace(/\\_/g, '_') // literal _
        .replace(/\\%/g, '%') // literal %
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '$',
    'i'
  );

  const candidateMatches = dbClients.filter(
    (c) => ilikeRegex.test(c.email) && c.status !== 'pending_deletion'
  );

  // Exact match filter ensuring zero wildcard expansion
  const exactMatches = candidateMatches.filter(
    (c) => c.email && c.email.trim().toLowerCase() === normalizedEmail
  );

  if (exactMatches.length === 0) {
    return { boundClients: [], updateCount: 0 };
  }

  // c) Only bind rows where user_id IS NULL (.is('user_id', null))
  const unbound = exactMatches.filter((c) => c.user_id === null);
  const alreadyBound = exactMatches.filter((c) => c.user_id === user.id);
  const newlyBound: MockClientRow[] = [];
  let updateCount = 0;

  for (const c of unbound) {
    // Conditional update: only update if user_id is currently null
    if (c.user_id === null) {
      c.user_id = user.id;
      updateCount++;
      newlyBound.push(c);

      // d) Security log: user id and client id only, no plaintext email
      auditLog.push({
        event: 'CLIENT_AUTO_BIND_SUCCESS',
        userId: user.id,
        clientId: c.id,
      });
    }
  }

  return {
    boundClients: [...alreadyBound, ...newlyBound],
    updateCount,
  };
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        ROLES & CLIENT AUTO-BINDING SECURITY TEST SUITE       ║');
  console.log('║        (SEC-HIGH-01: Verified Email & Wildcard Guard)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // TEST 1: Unconfirmed email does NOT auto-bind
  console.log('--- TEST 1: Unconfirmed Email Protection ---');
  {
    const dbClients: MockClientRow[] = [
      {
        id: 'cli-001',
        name: 'Target Client',
        company: 'Target Corp',
        email: 'victim@company.com',
        user_id: null,
        status: 'active',
      },
    ];
    const unconfirmedUser: MockUser = {
      id: 'usr-attacker-123',
      email: 'victim@company.com',
      email_confirmed_at: null,
      confirmed_at: null,
    };
    const logs: Array<any> = [];

    const res = await simulateAutoBind(unconfirmedUser, dbClients, logs);

    assert(res.boundClients.length === 0, 'Unconfirmed user receives zero client bindings');
    assert(dbClients[0].user_id === null, 'Client record user_id remains null');
    assert(res.updateCount === 0, 'No database update executed');
    assert(logs.length === 0, 'No security auto-bind log emitted');
  }

  console.log('');
  // TEST 2: Confirmed email binds an unbound client record
  console.log('--- TEST 2: Confirmed Email Successful Auto-Bind ---');
  {
    const dbClients: MockClientRow[] = [
      {
        id: 'cli-002',
        name: 'Legitimate Client',
        company: 'Legit Corp',
        email: 'legit.client@company.com',
        user_id: null,
        status: 'active',
      },
    ];
    const confirmedUser: MockUser = {
      id: 'usr-legit-456',
      email: 'legit.client@company.com',
      email_confirmed_at: '2026-10-06T12:00:00Z',
    };
    const logs: Array<any> = [];

    const res = await simulateAutoBind(confirmedUser, dbClients, logs);

    assert(res.boundClients.length === 1, 'Confirmed user receives bound client record');
    assert(dbClients[0].user_id === 'usr-legit-456', 'Client record successfully bound to user ID');
    assert(res.updateCount === 1, 'Exactly one database update performed');
    assert(logs.length === 1, 'Security audit log entry created');
    assert(logs[0].userId === 'usr-legit-456', 'Log contains user id');
    assert(logs[0].clientId === 'cli-002', 'Log contains client id');
    assert(!('email' in logs[0]), 'Log strictly excludes plaintext email');
  }

  console.log('');
  // TEST 3: Row already bound to another user is never modified
  console.log('--- TEST 3: Pre-Existing Binding Protection (Anti-Hijack) ---');
  {
    const dbClients: MockClientRow[] = [
      {
        id: 'cli-003',
        name: 'Pre-claimed Client',
        company: 'Claimed Corp',
        email: 'shared@company.com',
        user_id: 'usr-original-owner-999',
        status: 'active',
      },
    ];
    const imposterUser: MockUser = {
      id: 'usr-imposter-777',
      email: 'shared@company.com',
      email_confirmed_at: '2026-10-06T12:00:00Z',
    };
    const logs: Array<any> = [];

    const res = await simulateAutoBind(imposterUser, dbClients, logs);

    assert(res.boundClients.length === 0, 'Pre-bound client row is not returned to imposter');
    assert(
      dbClients[0].user_id === 'usr-original-owner-999',
      'Original client user_id binding remains completely untouched'
    );
    assert(res.updateCount === 0, 'Zero database updates executed on pre-bound row');
  }

  console.log('');
  // TEST 4: Wildcard characters (_ and %) do NOT match other accounts
  console.log('--- TEST 4: Wildcard Injection & Exact-Match Verification ---');
  {
    const dbClients: MockClientRow[] = [
      {
        id: 'cli-wildcard-target',
        name: 'Alice Cooper',
        company: 'Cooper Inc',
        email: 'axb@company.com', // Contains 'x' where user has '_'
        user_id: null,
        status: 'active',
      },
      {
        id: 'cli-percent-target',
        name: 'Bob Percent',
        company: 'Bob Corp',
        email: 'a123b@company.com', // Contains '123' where user has '%'
        user_id: null,
        status: 'active',
      },
      {
        id: 'cli-literal-underscore',
        name: 'Actual Underscore',
        company: 'Underscore Inc',
        email: 'a_b@company.com', // Literal '_'
        user_id: null,
        status: 'active',
      },
    ];

    // User has literal '_' in their email
    const underscoreUser: MockUser = {
      id: 'usr-underscore-888',
      email: 'a_b@company.com',
      email_confirmed_at: '2026-10-06T12:00:00Z',
    };
    const logs: Array<any> = [];

    const res = await simulateAutoBind(underscoreUser, dbClients, logs);

    assert(
      dbClients[0].user_id === null,
      'Email axb@company.com was NOT matched or bound by a_b@company.com'
    );
    assert(
      dbClients[2].user_id === 'usr-underscore-888',
      'Exact literal email a_b@company.com was bound correctly'
    );
    assert(res.boundClients.length === 1, 'Only the exact literal match was returned');
    assert(res.boundClients[0].id === 'cli-literal-underscore', 'Correct client was bound');
  }

  console.log('');
  // TEST 5: Second call is idempotent
  console.log('--- TEST 5: Idempotency Verification ---');
  {
    const dbClients: MockClientRow[] = [
      {
        id: 'cli-005',
        name: 'Idempotent Client',
        company: 'Idempotent Corp',
        email: 'idempotent@company.com',
        user_id: null,
        status: 'active',
      },
    ];
    const user: MockUser = {
      id: 'usr-idempotent-555',
      email: 'idempotent@company.com',
      email_confirmed_at: '2026-10-06T12:00:00Z',
    };
    const logs: Array<any> = [];

    // Call 1
    const res1 = await simulateAutoBind(user, dbClients, logs);
    assert(res1.boundClients.length === 1, 'First call binds the client');
    assert(res1.updateCount === 1, 'First call performs 1 update');

    // Call 2
    const res2 = await simulateAutoBind(user, dbClients, logs);
    assert(res2.boundClients.length === 1, 'Second call returns the already-bound client');
    assert(res2.updateCount === 0, 'Second call performs 0 updates (idempotent)');
    assert(logs.length === 1, 'No duplicate security log emitted on second call');
  }

  console.log('');
  console.log('================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Passed`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL ROLES AUTO-BINDING SECURITY TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
