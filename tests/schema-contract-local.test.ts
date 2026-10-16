#!/usr/bin/env npx tsx
/**
 * FlowDesk — App ↔ Schema contract conformance test (local Supabase).
 *
 * Derives the database surface the application actually depends on FROM THE
 * SOURCE CODE — every `.from('table')`, every embedded join inside a
 * `.select('..., relation(*)')`, and every `.rpc('function')` call — and then
 * proves each of them is really exposed by the live database.
 *
 * This closes the class of defect where application code calls a table or RPC
 * that no version-controlled migration ever created (which the hardcoded
 * column contract in tests/schema-conformance-local.test.ts cannot detect).
 *
 * It also asserts the intended grant boundary: financial write RPCs must be
 * reachable by the trusted server role and NOT by `anon`.
 *
 * Requires a running local Supabase stack (`npx supabase start`).
 *
 * Usage: npx tsx tests/schema-contract-local.test.ts
 */

import fs from 'fs';
import path from 'path';

const URL = process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321';
// Public, fixed local-development credentials published by the Supabase CLI.
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src', 'app'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', '.next', '.git']);

/** RPCs that must never be callable by an unauthenticated (anon) caller. */
const SERVICE_ROLE_ONLY_RPCS = [
  'record_manual_payment',
  'settle_razorpay_payment',
  'claim_jobs',
  'complete_job',
  'fail_job',
  'get_invitation_public_details',
  'claim_client_invitation',
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/** Source-derived requirements. */
function collectRequirements() {
  const tables = new Map<string, string>(); // table -> example file
  const joins = new Map<string, string>();
  const rpcs = new Map<string, string>();

  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const rel = path.relative(ROOT, file);
      const content = fs.readFileSync(file, 'utf8');

      for (const m of content.matchAll(/\.from\(\s*'([a-z_][a-z0-9_]*)'\s*\)/g)) {
        if (!tables.has(m[1])) tables.set(m[1], rel);
      }
      for (const m of content.matchAll(/\.rpc\(\s*'([a-z_][a-z0-9_]*)'/g)) {
        if (!rpcs.has(m[1])) rpcs.set(m[1], rel);
      }
      // Embedded resource joins only appear inside .select('...') literals.
      for (const sel of content.matchAll(/\.select\(\s*'([^']*)'/g)) {
        for (const j of sel[1].matchAll(/\b([a-z_][a-z0-9_]*)\(\*\)/g)) {
          if (!joins.has(j[1])) joins.set(j[1], rel);
        }
      }
    }
  }

  return { tables, joins, rpcs };
}

async function fetchSpec(key: string) {
  const res = await fetch(`${URL}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`OpenAPI spec request failed: HTTP ${res.status}`);
  return (await res.json()) as {
    paths: Record<string, unknown>;
    definitions: Record<string, unknown>;
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FLOWDESK APP ↔ SCHEMA CONTRACT CONFORMANCE (live DB)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Target: ${URL}\n`);

  const { tables, joins, rpcs } = collectRequirements();
  const serviceSpec = await fetchSpec(SERVICE_KEY);
  const anonSpec = await fetchSpec(ANON_KEY);

  const exposedTables = new Set(Object.keys(serviceSpec.definitions || {}));
  const exposedRpcs = new Set(
    Object.keys(serviceSpec.paths || {})
      .filter((p) => p.startsWith('/rpc/'))
      .map((p) => p.slice('/rpc/'.length))
  );
  const anonRpcs = new Set(
    Object.keys(anonSpec.paths || {})
      .filter((p) => p.startsWith('/rpc/'))
      .map((p) => p.slice('/rpc/'.length))
  );

  console.log(`Discovered ${tables.size} tables, ${joins.size} embedded joins, ${rpcs.size} RPCs in source.\n`);

  console.log('1. Tables referenced by application queries');
  for (const [table, file] of [...tables].sort()) {
    check(`${table}`, exposedTables.has(table), `missing — referenced by ${file}`);
  }

  console.log('\n2. Embedded join targets inside .select()');
  for (const [table, file] of [...joins].sort()) {
    check(`${table}`, exposedTables.has(table), `missing — referenced by ${file}`);
  }

  console.log('\n3. RPC functions invoked by application code');
  for (const [fn, file] of [...rpcs].sort()) {
    check(`${fn}`, exposedRpcs.has(fn), `missing — invoked by ${file}`);
  }

  console.log('\n4. Grant boundary (financial/queue/invitation RPCs)');
  for (const fn of SERVICE_ROLE_ONLY_RPCS) {
    check(`${fn} is NOT executable by anon`, !anonRpcs.has(fn), 'anon can execute this RPC');
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('FAILED CHECKS:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('══════════════════════════════════════════════════════════════');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
