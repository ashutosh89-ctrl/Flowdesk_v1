#!/usr/bin/env npx tsx
/**
 * FlowDesk Unified Test Runner (test:all)
 * 
 * Runs all static checks, security linters, secret scanners, and offline
 * credential-free unit/integration test suites in sequence.
 * 
 * Exit code 0 if all suites succeed; exit code 1 if any failure occurs.
 */

import { spawnSync } from 'child_process';
import path from 'path';

interface Step {
  name: string;
  command: string;
  args: string[];
}

const ROOT_DIR = path.resolve(__dirname, '..');

const SUITES: Step[] = [
  // 1. Static Typing & Code Health
  { name: 'TypeScript Static Typecheck', command: 'npx', args: ['tsc', '--noEmit'] },
  { name: 'ESLint Static Analysis', command: 'npx', args: ['eslint', '.'] },
  { name: 'Hardcoded Secrets Detection', command: 'npx', args: ['tsx', 'scripts/check-secrets.ts'] },

  // 2. Security Test Suites (Phase 1 - Phase 4)
  { name: 'Input Validation (Task 1)', command: 'npx', args: ['tsx', 'tests/api-validation.test.ts'] },
  { name: 'XSS & URL Sanitization (Task 2)', command: 'npx', args: ['tsx', 'tests/xss-sanitization.test.ts'] },
  { name: 'File Upload & Magic Bytes (Task 3)', command: 'npx', args: ['tsx', 'tests/upload-validation.test.ts'] },
  { name: 'Security Headers & CSP (Task 4)', command: 'npx', args: ['tsx', 'tests/security-headers.test.ts'] },
  { name: 'Logger Masking & Sanitization (Task 5)', command: 'npx', args: ['tsx', 'tests/logger-redaction.test.ts'] },
  { name: 'Account Purge Cron Route (Task 6)', command: 'npx', args: ['tsx', 'tests/account-purge-cron.test.ts'] },
  { name: 'Storage Scoping & Canonical Paths', command: 'npx', args: ['tsx', 'tests/storage-path.test.ts'] },
  { name: 'Open Redirect & Safe Navigation', command: 'npx', args: ['tsx', 'tests/safe-redirect.test.ts'] },
  { name: 'API Authentication & Bearer Protection', command: 'npx', args: ['tsx', 'tests/api-auth.test.ts'] },
  { name: 'Authentication Fail-Closed', command: 'npx', args: ['tsx', 'tests/auth-fail-closed.test.ts'] },
  { name: 'Rate Limiting & IP Resolution', command: 'npx', args: ['tsx', 'tests/rate-limiter.test.ts'] },
  { name: 'Roles & Auto-Bind Prevention', command: 'npx', args: ['tsx', 'tests/roles-auto-bind.test.ts'] },
  { name: 'Invitation Claim Security', command: 'npx', args: ['tsx', 'tests/invitation-claim-security.test.ts'] },
  { name: 'Webhook HMAC Authentication', command: 'npx', args: ['tsx', 'tests/email-webhooks-auth.test.ts'] },
  { name: 'Deliverable Approval Pilot (Task 9)', command: 'npx', args: ['tsx', 'tests/deliverable-approval.test.ts'] },

  // 3. Server-Boundary Migration Test Suites (Phase 5A)
  { name: 'Pure Business Rules (Phase 5A Task 1)', command: 'npx', args: ['tsx', '--test', 'tests/shared-rules.test.ts'] },
  { name: 'Invoice Server Mutations (Batch 1)', command: 'npx', args: ['tsx', '--test', 'tests/invoice-server-mutations.test.ts'] },
  { name: 'Deliverable Server Mutations (Batch 2)', command: 'npx', args: ['tsx', '--test', 'tests/deliverable-server-mutations.test.ts'] },
  { name: 'Client Server Mutations (Batch 3)', command: 'npx', args: ['tsx', '--test', 'tests/client-server-mutations.test.ts'] },
  { name: 'Account Server Mutations (Batch 4)', command: 'npx', args: ['tsx', '--test', 'tests/account-server-mutations.test.ts'] },

  // 4. Billing & Entitlements Test Suites (Phase 6)
  { name: 'Billing Plan Pure Rules (Phase 6 Task 7)', command: 'npx', args: ['tsx', '--test', 'tests/billing-plan-rules.test.ts'] },
  { name: 'Billing Webhook Security (Phase 6 Task 7)', command: 'npx', args: ['tsx', '--test', 'tests/billing-webhook.test.ts'] },
  { name: 'Billing API Routes Security (Phase 6 Task 7)', command: 'npx', args: ['tsx', '--test', 'tests/billing-routes.test.ts'] },
];

function runAll() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             FLOWDESK UNIFIED CI TEST RUNNER                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let passedCount = 0;
  let failedCount = 0;
  const failures: string[] = [];

  const startTime = Date.now();

  for (const step of SUITES) {
    process.stdout.write(`⏳ Running: ${step.name}... `);

    const isWindows = process.platform === 'win32';
    const shellCmd = isWindows ? `${step.command}.cmd` : step.command;

    const result = spawnSync(shellCmd, step.args, {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env },
    });

    if (result.status === 0) {
      console.log('✅ PASS');
      passedCount++;
    } else {
      console.log('❌ FAIL');
      failedCount++;
      failures.push(step.name);
      if (result.stdout && result.stdout.length > 0) {
        console.error('\n--- STDOUT ---\n' + result.stdout.toString().trim());
      }
      if (result.stderr && result.stderr.length > 0) {
        console.error('\n--- STDERR ---\n' + result.stderr.toString().trim());
      }
      console.log('--------------------------------------------------\n');
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${passedCount + failedCount} total steps executed in ${durationSec}s`);
  console.log(`PASSED:  ${passedCount}`);
  console.log(`FAILED:  ${failedCount}`);
  if (failedCount > 0) {
    console.log(`FAILED STEPS: ${failures.join(', ')}`);
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAll();
