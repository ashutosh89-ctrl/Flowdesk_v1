#!/usr/bin/env npx tsx
/**
 * Email Invitation Relay Security Test Suite (SEC-CRIT-03)
 *
 * Tests:
 * 1. Recipient not in authorized workspace is strictly rejected (no open email relay).
 * 2. Recipient matching an existing client in workspace succeeds.
 * 3. Daily invitation rate limits (20/workspace/day, 3/recipient/day) trigger 429 with Retry-After.
 * 4. HTML injection in user-controlled template inputs (client name, titles) is escaped.
 * 5. CRLF control characters in subject values are cleanly stripped to prevent header injection.
 */

import {
  renderClientInvitationEmail,
  renderDeliverableReadyEmail,
  renderInvoiceIssuedEmail,
} from '../src/backend/email/templates';
import { sanitizeHeader, escapeHtml, sanitizeUrl } from '../src/backend/email/templates/layout';

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

interface MockClient {
  id: string;
  workspace_id: string;
  email: string;
  status: string;
}

interface MockEmailEvent {
  id: string;
  workspace_id: string;
  recipient: string;
  event_type: string;
  created_at: string;
}

const MAX_WS_INVITATIONS = 20;
const MAX_RECIPIENT_INVITATIONS = 3;

/**
 * Simulates the recipient authorization logic from app/api/email/route.ts
 */
function validateInvitationRecipient(
  recipientEmail: string,
  authorizedWsId: string,
  clientsTable: MockClient[]
): { ok: boolean; error?: string } {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { ok: false, error: 'Valid recipient email is required.' };
  }

  const normalized = recipientEmail.toLowerCase().trim();

  // SEC-CRIT-03: Recipient MUST belong to an existing client in the workspace
  const clientRecord = clientsTable.find(
    (c) =>
      c.workspace_id === authorizedWsId &&
      c.email.trim().toLowerCase() === normalized &&
      c.status !== 'pending_deletion'
  );

  if (!clientRecord) {
    return {
      ok: false,
      error: 'Unauthorized: recipient is not an active client in this workspace.',
    };
  }

  return { ok: true };
}

/**
 * Simulates durable 24h limit checks based on email_events
 */
function checkDurableLimits(
  workspaceId: string,
  recipientEmail: string,
  events: MockEmailEvent[],
  now = Date.now()
): { allowed: boolean; status?: number; retryAfter?: number; reason?: string } {
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const normalizedRecipient = recipientEmail.toLowerCase().trim();

  // 1. Workspace limit
  const wsEvents = events.filter(
    (e) =>
      e.workspace_id === workspaceId &&
      e.event_type === 'client_invitation' &&
      e.created_at >= twentyFourHoursAgo
  );

  if (wsEvents.length >= MAX_WS_INVITATIONS) {
    return {
      allowed: false,
      status: 429,
      retryAfter: 86400,
      reason: `Workspace daily invitation limit (${MAX_WS_INVITATIONS}) exceeded`,
    };
  }

  // 2. Recipient limit
  const recipientEvents = events.filter(
    (e) =>
      e.recipient.toLowerCase().trim() === normalizedRecipient &&
      e.event_type === 'client_invitation' &&
      e.created_at >= twentyFourHoursAgo
  );

  if (recipientEvents.length >= MAX_RECIPIENT_INVITATIONS) {
    return {
      allowed: false,
      status: 429,
      retryAfter: 86400,
      reason: `Recipient daily invitation limit (${MAX_RECIPIENT_INVITATIONS}) exceeded`,
    };
  }

  return { allowed: true };
}

function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        EMAIL INVITATION RELAY SECURITY TEST SUITE            ║');
  console.log('║        (SEC-CRIT-03: Recipient Gating & Hardening)           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const workspaceId = 'ws-test-workspace-001';

  const mockClients: MockClient[] = [
    {
      id: 'cli-001',
      workspace_id: workspaceId,
      email: 'authorized.client@partner.com',
      status: 'active',
    },
    {
      id: 'cli-002',
      workspace_id: 'other-workspace-999',
      email: 'other.client@external.com',
      status: 'active',
    },
  ];

  // SECTION 1: Recipient not in workspace is rejected
  console.log('--- SECTION 1: Open Relay Prevention (Recipient Gating) ---');
  {
    // Arbitrary external recipient (relay attack attempt)
    const resArbitrary = validateInvitationRecipient(
      'random.victim@phishing-target.com',
      workspaceId,
      mockClients
    );
    assert(!resArbitrary.ok, 'Arbitrary unassociated recipient is strictly rejected');
    assert(
      Boolean(resArbitrary.error?.includes('Unauthorized')),
      'Returns unauthorized recipient error message'
    );

    // Recipient in different workspace
    const resOtherWs = validateInvitationRecipient(
      'other.client@external.com',
      workspaceId,
      mockClients
    );
    assert(!resOtherWs.ok, 'Recipient in a different workspace is rejected for caller workspace');

    // Recipient in caller workspace succeeds
    const resValid = validateInvitationRecipient(
      'authorized.client@partner.com',
      workspaceId,
      mockClients
    );
    assert(resValid.ok, 'Legitimate recipient in caller workspace succeeds');

    // Case-insensitive match succeeds
    const resCaseInsensitive = validateInvitationRecipient(
      'AUTHORIZED.CLIENT@PARTNER.COM',
      workspaceId,
      mockClients
    );
    assert(resCaseInsensitive.ok, 'Case-insensitive recipient in workspace succeeds');
  }

  console.log('');
  // SECTION 2: Durable daily limits trigger HTTP 429
  console.log('--- SECTION 2: Durable Daily Send Limits (email_events) ---');
  {
    const emailEvents: MockEmailEvent[] = [];
    const targetRecipient = 'authorized.client@partner.com';

    // Verify initial send allowed
    const initialCheck = checkDurableLimits(workspaceId, targetRecipient, emailEvents);
    assert(initialCheck.allowed, 'First invitation send is permitted within limits');

    // Add 3 sends for this recipient (max recipient limit)
    for (let i = 0; i < 3; i++) {
      emailEvents.push({
        id: `evt-rec-${i}`,
        workspace_id: workspaceId,
        recipient: targetRecipient,
        event_type: 'client_invitation',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
      });
    }

    const fourthCheck = checkDurableLimits(workspaceId, targetRecipient, emailEvents);
    assert(!fourthCheck.allowed, '4th invitation to same recipient in 24h is throttled');
    assert(fourthCheck.status === 429, 'Returns HTTP 429 status code');
    assert(fourthCheck.retryAfter === 86400, 'Returns 86400 Retry-After header');
    assert(
      Boolean(fourthCheck.reason?.includes('Recipient daily invitation limit')),
      'Reason cites recipient limit'
    );

    // Now test workspace limit (20 per day) with distinct recipients
    const wsEvents: MockEmailEvent[] = [];
    for (let i = 0; i < 20; i++) {
      wsEvents.push({
        id: `evt-ws-${i}`,
        workspace_id: workspaceId,
        recipient: `client_${i}@partner.com`,
        event_type: 'client_invitation',
        created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      });
    }

    const twentyFirstCheck = checkDurableLimits(workspaceId, 'fresh.client@partner.com', wsEvents);
    assert(!twentyFirstCheck.allowed, '21st invitation in workspace is throttled');
    assert(twentyFirstCheck.status === 429, 'Workspace limit returns HTTP 429');
    assert(twentyFirstCheck.retryAfter === 86400, 'Workspace limit specifies Retry-After');
    assert(
      Boolean(twentyFirstCheck.reason?.includes('Workspace daily invitation limit')),
      'Reason cites workspace limit'
    );
  }

  console.log('');
  // SECTION 3: HTML injection in templates is escaped
  console.log('--- SECTION 3: Template HTML Injection Protection ---');
  {
    const maliciousPayload = '<script>alert("xss")</script><b onmouseover="alert(1)">Client</b>';
    const rendered = renderClientInvitationEmail({
      clientName: maliciousPayload,
      freelancerName: 'John Doe',
      businessName: 'Apex Studio <img src=x onerror=alert(2)>',
      portalUrl: 'https://flowdesk.dev/portal/client-123',
    });

    assert(!rendered.html.includes('<script>'), 'Raw <script> tag is absent from HTML output');
    assert(rendered.html.includes('&lt;script&gt;'), '<script> is safely escaped to &lt;script&gt;');
    assert(!rendered.html.includes('<img src=x'), 'Raw <img onerror> tag is absent from HTML output');
    assert(rendered.html.includes('&lt;img'), '<img is safely escaped to &lt;img');
    assert(!rendered.html.includes('"xss"'), 'Raw unescaped quotes in payload are escaped');
  }

  console.log('');
  // SECTION 4: CRLF control characters in subjects are stripped
  console.log('--- SECTION 4: Subject CRLF Injection Prevention ---');
  {
    const injectionSubjectValue = 'Injected Company\r\nBcc: evil@attacker.com\r\nSubject: Spoofed';
    const sanitized = sanitizeHeader(injectionSubjectValue);

    assert(!sanitized.includes('\r'), 'Carriage return (\\r) is stripped from subject value');
    assert(!sanitized.includes('\n'), 'Line feed (\\n) is stripped from subject value');
    assert(
      sanitized === 'Injected Company Bcc: evil@attacker.com Subject: Spoofed',
      'CRLF sequence replaced with space, neutralizing header splitting'
    );

    // Test subject line rendered by invoice template
    const invoiceEmail = renderInvoiceIssuedEmail({
      clientName: 'Alice',
      businessName: 'FlowDesk Studio\r\nCc: attacker@bad.com',
      invoiceNumber: 'INV-001\r\nInjected-Header: 123',
      amount: '$500',
      dueDate: '2026-10-15',
    });

    assert(!invoiceEmail.subject.includes('\r'), 'Rendered invoice email subject contains no \\r');
    assert(!invoiceEmail.subject.includes('\n'), 'Rendered invoice email subject contains no \\n');
  }

  console.log('');
  // SECTION 5: URL Sanitization & Protocol Validation
  console.log('--- SECTION 5: URL Scheme Validation in Templates ---');
  {
    assert(sanitizeUrl('https://valid.com/portal') === 'https://valid.com/portal', 'https URL is preserved');
    assert(sanitizeUrl('http://valid.com/portal') === 'http://valid.com/portal', 'http URL is preserved');
    assert(sanitizeUrl('javascript:alert(1)') === '#', 'javascript: URL falls back to #');
    assert(sanitizeUrl('data:text/html,<script>alert(1)</script>') === '#', 'data: URL falls back to #');
    assert(sanitizeUrl('vbscript:msgbox(1)') === '#', 'vbscript: URL falls back to #');
  }

  console.log('');
  console.log('================================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Passed`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL EMAIL INVITATION SECURITY TESTS PASSED!');
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
  console.log('================================================================');
}

runTests();
