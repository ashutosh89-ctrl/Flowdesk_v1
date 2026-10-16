#!/usr/bin/env npx tsx
/**
 * FlowDesk — Live RLS Isolation Test (local Supabase)
 *
 * Creates two independent workspaces/users and asserts that Row-Level Security
 * prevents cross-tenant access, ownership tampering, unauthenticated reads, and
 * cross-tenant storage access. Requires a running local Supabase stack.
 *
 * Usage:
 *   npx tsx tests/rls-isolation-local.test.ts
 *
 * Environment (defaults match `supabase start`):
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321';
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function makeUser(tag: string) {
  const email = `flowdesk-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const password = 'Test-Password-123!';
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${tag}) failed: ${error?.message}`);

  const client = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${tag}) failed: ${signInErr.message}`);

  const { data: ws } = await client
    .from('workspaces')
    .select('id, owner_id')
    .eq('owner_id', data.user.id)
    .maybeSingle();

  return { id: data.user.id, email, client, workspaceId: ws?.id as string | undefined };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        FLOWDESK LIVE RLS ISOLATION TEST (local DB)           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Target: ${URL}\n`);

  const anon = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userA = await makeUser('a');
  const userB = await makeUser('b');
  const cleanup: string[] = [userA.id, userB.id];

  try {
    console.log('1. Workspace auto-provisioning (auth trigger)');
    check('User A received an auto-created workspace', Boolean(userA.workspaceId));
    check('User B received an auto-created workspace', Boolean(userB.workspaceId));
    check(
      'Workspaces are distinct',
      Boolean(userA.workspaceId && userB.workspaceId && userA.workspaceId !== userB.workspaceId)
    );

    console.log('\n2. Tenant-owned record creation');
    const { data: clientA, error: insertAErr } = await userA.client
      .from('clients')
      .insert({
        workspace_id: userA.workspaceId,
        name: 'Alpha Contact',
        company: 'Alpha Co',
        email: `alpha-${Date.now()}@example.test`,
        status: 'active',
      })
      .select()
      .single();
    check('User A can insert a client into their own workspace', !insertAErr && !!clientA, insertAErr?.message);

    // ── Cross-tenant blocking: B reads A's records ──────────────────────────
    console.log('\n3. Cross-tenant read isolation (freelancer vs freelancer)');
    const { data: bSeesAClients } = await userB.client
      .from('clients')
      .select('id')
      .eq('workspace_id', userA.workspaceId);
    check('User B cannot list User A workspace clients', (bSeesAClients?.length ?? 0) === 0);

    const { data: bSeesAClientById } = await userB.client
      .from('clients')
      .select('id, name')
      .eq('id', clientA!.id)
      .maybeSingle();
    check('User B cannot fetch User A client by guessed UUID', bSeesAClientById === null);

    console.log('\n4. Cross-tenant write blocking');
    const { error: bInsertIntoAErr } = await userB.client.from('clients').insert({
      workspace_id: userA.workspaceId,
      name: 'Intruder',
      company: 'Intruder Co',
      email: `intruder-${Date.now()}@example.test`,
    });
    check('User B cannot insert a client into User A workspace', Boolean(bInsertIntoAErr));

    await userB.client
      .from('clients')
      .update({ name: 'Hijacked' })
      .eq('id', clientA!.id);
    const { data: aClientAfter } = await admin
      .from('clients')
      .select('name')
      .eq('id', clientA!.id)
      .maybeSingle();
    check('User B cannot update User A client (record unchanged)', aClientAfter?.name === 'Alpha Contact');

    // Ownership tampering: B tries to move A's client into B's workspace.
    const { error: moveErr } = await userB.client
      .from('clients')
      .update({ workspace_id: userB.workspaceId })
      .eq('id', clientA!.id);
    const { data: aClientAfterMove } = await admin
      .from('clients')
      .select('workspace_id')
      .eq('id', clientA!.id)
      .maybeSingle();
    check(
      'User B cannot reassign User A client to gain access',
      aClientAfterMove?.workspace_id === userA.workspaceId,
      moveErr?.message
    );

    console.log('\n5. Unauthenticated access is denied');
    const { data: anonClients } = await anon.from('clients').select('id').limit(5);
    check('Anon cannot read clients', (anonClients?.length ?? 0) === 0);
    const { data: anonWs } = await anon.from('workspaces').select('id').limit(5);
    check('Anon cannot read workspaces', (anonWs?.length ?? 0) === 0);

    console.log('\n6. Storage cross-tenant isolation');
    const pathA = `workspaces/${userA.workspaceId}/clients/${clientA!.id}/test-object.txt`;
    const { error: uploadAErr } = await userA.client.storage
      .from('documents')
      .upload(pathA, new Blob(['hello'], { type: 'text/plain' }), { upsert: true });
    check('User A can upload into their own client-scoped documents path', !uploadAErr, uploadAErr?.message);

    const { error: signBErr } = await userB.client.storage
      .from('documents')
      .createSignedUrl(pathA, 60);
    check('User B cannot create a signed URL for User A object', Boolean(signBErr));

    const { data: bDownload } = await userB.client.storage.from('documents').download(pathA);
    check('User B cannot download User A private object', bDownload === null);

    // ── Client-role isolation ───────────────────────────────────────────────
    console.log('\n7. Client-role isolation (client A vs client B)');
    const clientUserA = await makeUser('c1');
    cleanup.push(clientUserA.id);
    // Bind client A record to clientUserA, and create a second client for B.
    const { data: clientBRec } = await admin
      .from('clients')
      .insert({
        workspace_id: userB.workspaceId,
        name: 'Beta Contact',
        company: 'Beta Co',
        email: `beta-${Date.now()}@example.test`,
        status: 'active',
        user_id: clientUserA.id,
      })
      .select()
      .single();
    check('Admin can create a client record bound to a client user', !!clientBRec);

    // clientUserA is bound to B's client → should NOT see A's clients.
    const { data: clientUserSeesA } = await clientUserA.client
      .from('clients')
      .select('id')
      .eq('workspace_id', userA.workspaceId);
    check('Client user cannot read another workspace clients', (clientUserSeesA?.length ?? 0) === 0);

    const { data: clientUserSeesOwn } = await clientUserA.client
      .from('clients')
      .select('id')
      .eq('id', clientBRec!.id)
      .maybeSingle();
    check('Client user can read their own bound client record', clientUserSeesOwn?.id === clientBRec!.id);

    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`RESULT: ${passed} passed, ${failed} failed`);
    console.log('══════════════════════════════════════════════════════════════');
  } finally {
    for (const id of cleanup) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        /* ignore cleanup errors */
      }
    }
    // Remove any records created in the two test workspaces.
    try {
      await admin.from('clients').delete().in('workspace_id', [userA.workspaceId, userB.workspaceId].filter(Boolean) as string[]);
      await admin.from('workspaces').delete().in('id', [userA.workspaceId, userB.workspaceId].filter(Boolean) as string[]);
    } catch {
      /* ignore cleanup errors */
    }
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
