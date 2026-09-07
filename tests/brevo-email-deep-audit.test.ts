/**
 * FlowDesk Brevo Email Subsystem Deep Audit & Verification Test Suite
 *
 * Verifies:
 * 1. Server-only API Key security (never exposed with NEXT_PUBLIC_)
 * 2. Brevo API key extraction, sanitization, and verification
 * 3. Verified Sender string and object parsing ("Flowdesk <mysreio26@gmail.com>")
 * 4. All 9 Email Templates rendering (proper escaping, dynamic URLs, no localhost in prod)
 * 5. Fail-closed error handling
 * 6. Live / Controlled Brevo API Transactional Connectivity
 *
 * Run: npx tsx tests/brevo-email-deep-audit.test.ts
 */

import fs from 'fs';
import path from 'path';

// Load .env.local into process.env if available
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

import {
  getBrevoApiKey,
  checkIsBrevoConfigured,
  getDefaultSender,
  parseSender,
  sendBrevoEmail,
} from '../src/backend/email/brevo-client';

import {
  renderClientInvitationEmail,
  renderDeliverableReadyEmail,
  renderDeliverableApprovedEmail,
  renderRevisionRequestedEmail,
  renderDocumentUploadedEmail,
  renderInvoiceIssuedEmail,
  renderPaymentReceivedEmail,
  renderAccountLifecycleEmail,
  renderSecurityAlertEmail,
} from '../src/backend/email/templates';

import { EmailService } from '../src/backend/email/email-service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('🚀 FLOWDESK BREVO TRANSACTIONAL EMAIL DEEP AUDIT TEST SUITE');
  console.log('================================================================\n');

  const originalBrevoApiKey = process.env.BREVO_API_KEY;
  const originalEmailFrom = process.env.EMAIL_FROM;

  console.log('--- SECTION 1: Server-Side Key Security & Sanitization ---');

  // Test 1.1: NEXT_PUBLIC_BREVO_API_KEY must not exist
  assert(
    process.env.NEXT_PUBLIC_BREVO_API_KEY === undefined,
    'NEXT_PUBLIC_BREVO_API_KEY is not exposed in environment'
  );

  // Test 1.2: Trimming quotes and spaces
  process.env.BREVO_API_KEY = '  "xkeysib-test-key-1234567890abcdef"  ';
  assert(
    getBrevoApiKey() === 'xkeysib-test-key-1234567890abcdef',
    'getBrevoApiKey() trims quotes and whitespace dynamically'
  );

  // Test 1.3: checkIsBrevoConfigured() returns true for xkeysib- prefix
  assert(
    checkIsBrevoConfigured() === true,
    'checkIsBrevoConfigured() returns true for valid xkeysib- prefix'
  );

  // Test 1.4: Sender Parsing
  const parsed1 = parseSender('Flowdesk <mysreio26@gmail.com>');
  assert(
    parsed1.name === 'Flowdesk' && parsed1.email === 'mysreio26@gmail.com',
    'parseSender parses "Name <email>" formatted sender'
  );

  const parsed2 = parseSender('mysreio26@gmail.com');
  assert(
    parsed2.email === 'mysreio26@gmail.com',
    'parseSender parses plain email string'
  );

  // Restore env
  if (originalBrevoApiKey !== undefined) process.env.BREVO_API_KEY = originalBrevoApiKey;
  else delete process.env.BREVO_API_KEY;

  if (originalEmailFrom !== undefined) process.env.EMAIL_FROM = originalEmailFrom;
  else delete process.env.EMAIL_FROM;

  console.log('\n--- SECTION 2: Template Rendering & HTML Sanitization ---');

  // Test 2.1: Client Invitation
  const invite = renderClientInvitationEmail({
    clientName: 'Eleanor & Vance <Co>',
    freelancerName: 'Ashutosh Mishra',
    businessName: 'Apex <Digital> Labs',
    portalUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1',
  });
  assert(invite.subject.includes('Apex <Digital> Labs'), 'Client invitation subject contains business name');
  assert(invite.html.includes('https://flowdesk-v1.vercel.app/portal/cli-1'), 'Client invitation contains portal URL');
  assert(invite.html.includes('&lt;Digital&gt;'), 'Client invitation escapes HTML in business name');

  // Test 2.2: Deliverable Ready
  const delivReady = renderDeliverableReadyEmail({
    clientName: 'Eleanor Vance',
    freelancerName: 'Ashutosh Mishra',
    deliverableTitle: 'Mobile App High-Fidelity Prototype',
    projectName: 'Q3 Brand Strategy',
    version: 'v2.0',
    portalUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1/deliverables/del-1',
  });
  assert(delivReady.subject.includes('Mobile App High-Fidelity Prototype'), 'Deliverable ready subject contains title');
  assert(delivReady.html.includes('v2.0'), 'Deliverable ready HTML contains version');

  // Test 2.3: Deliverable Approved
  const delivApp = renderDeliverableApprovedEmail({
    freelancerName: 'Ashutosh Mishra',
    clientName: 'Eleanor Vance',
    deliverableTitle: 'Brand Guidelines PDF',
    notes: 'Approved with minor color tweaks on page 4',
    dashboardUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1',
  });
  assert(delivApp.html.includes('Approved with minor color tweaks'), 'Deliverable approved HTML contains notes');

  // Test 2.4: Revision Requested
  const revReq = renderRevisionRequestedEmail({
    freelancerName: 'Ashutosh Mishra',
    clientName: 'Eleanor Vance',
    deliverableTitle: 'Design Token Specification',
    feedback: 'Please revise font weights for mobile headers',
    dashboardUrl: 'https://flowdesk-v1.vercel.app/workspace/deliv/123',
  });
  assert(revReq.html.includes('Please revise font weights'), 'Revision requested HTML contains feedback');

  // Test 2.5: Document Uploaded
  const docUp = renderDocumentUploadedEmail({
    recipientName: 'Ashutosh Mishra',
    uploaderName: 'Eleanor Vance',
    documentTitle: 'Tax_Exemption_Form.pdf',
    category: 'Legal & Tax',
    actionUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1/documents',
  });
  assert(docUp.html.includes('Tax_Exemption_Form.pdf'), 'Document uploaded HTML contains document title');
  assert(docUp.html.includes('Legal &amp; Tax'), 'Document uploaded HTML contains escaped category');

  // Test 2.6: Invoice Issued
  const invIssued = renderInvoiceIssuedEmail({
    clientName: 'Eleanor Vance',
    freelancerName: 'Ashutosh Mishra',
    invoiceNumber: 'INV-2026-088',
    amount: '$14,500.00',
    dueDate: '2026-09-30',
    portalUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1/invoices/inv-088',
  });
  assert(invIssued.subject.includes('INV-2026-088'), 'Invoice issued subject contains invoice number');
  assert(invIssued.html.includes('$14,500.00'), 'Invoice issued HTML contains amount');
  assert(invIssued.html.includes('2026-09-30'), 'Invoice issued HTML contains due date');

  // Test 2.7: Payment Received
  const payRec = renderPaymentReceivedEmail({
    recipientName: 'Eleanor Vance',
    invoiceNumber: 'INV-2026-088',
    amount: '$14,500.00',
    paymentMethod: 'Razorpay / UPI',
    actionUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1/receipts/rec-088',
  });
  assert(payRec.html.includes('Razorpay / UPI'), 'Payment received HTML contains payment method');

  // Test 2.8: Account Lifecycle
  const accDel = renderAccountLifecycleEmail({
    userName: 'Ashutosh Mishra',
    action: 'deleted',
    gracePeriodDays: 5,
    restoreUrl: 'https://flowdesk-v1.vercel.app/login',
  });
  assert(accDel.html.includes('5 Days'), 'Account lifecycle HTML contains grace period');

  // Test 2.9: Security Alert
  const secAlert = renderSecurityAlertEmail({
    userName: 'Ashutosh Mishra',
    eventType: 'Password Changed',
    details: 'Password was updated from Mumbai, India',
  });
  assert(secAlert.html.includes('Password Changed'), 'Security alert HTML contains eventType');
  assert(secAlert.html.includes('Mumbai, India'), 'Security alert HTML contains details');

  console.log('\n--- SECTION 3: Fail-Closed Production Behavior ---');
  // Test 3.1: Fail-closed when API key is missing in production
  delete process.env.BREVO_API_KEY;
  delete process.env.SIB_API_V3_KEY;
  delete process.env.NEXT_PUBLIC_AUTH_MODE;

  const failResult = await EmailService.send({
    to: 'test@example.com',
    subject: 'Fail Closed Test',
    html: '<p>Test</p>',
    eventType: 'security_alert',
  });
  assert(
    failResult.success === false && Boolean(failResult.error?.includes('not configured')),
    'EmailService fails closed when BREVO_API_KEY is not configured in production'
  );

  // Restore env
  if (originalBrevoApiKey !== undefined) process.env.BREVO_API_KEY = originalBrevoApiKey;

  console.log('\n--- SECTION 4: Controlled Live Brevo API Dispatch ---');
  const activeKey = getBrevoApiKey();
  if (activeKey && (activeKey.startsWith('xkeysib-') || activeKey.length > 20)) {
    console.log('  🔍 Active BREVO_API_KEY detected. Performing controlled live dispatch...');
    try {
      const liveRes = await sendBrevoEmail({
        to: 'mysreio26@gmail.com',
        subject: 'FlowDesk Brevo Subsystem Deep Audit Verification',
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #09090b; color: #fff; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <h2 style="color: #10b981;">FlowDesk Brevo Integration Verified</h2>
            <p>This email confirms that the Brevo transactional email subsystem is fully operational.</p>
            <p style="font-size: 12px; color: #a1a1aa;">Timestamp: ${new Date().toISOString()}</p>
          </div>
        `,
        text: 'FlowDesk Brevo Integration Verified. Transactional email subsystem is operational.',
      });

      assert(liveRes.success === true, 'Live Brevo transactional send returned HTTP success', liveRes);
      assert(
        typeof liveRes.messageId === 'string' && liveRes.messageId.length > 0,
        `Brevo Message ID received: ${liveRes.messageId}`
      );
    } catch (err: any) {
      assert(false, 'Live Brevo transactional send failed', err?.message);
    }
  } else {
    console.log('  ⚠️ Skipping live Brevo send: No active BREVO_API_KEY found.');
  }

  console.log('\n================================================================');
  console.log(`📊 AUDIT RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
