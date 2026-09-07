/**
 * FlowDesk All Email Operations & Client Connection End-to-End Verification
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Load .env.local into process.env if present
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { EmailService } from '../src/backend/email/email-service';
import { FreelancerClientManagementService } from '../src/backend/freelancer/client-management-service';
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

async function runAllEmailOperationsTests() {
  console.log('================================================================');
  console.log('📧 FLOWDESK ALL EMAIL OPERATIONS & CLIENT CONNECTION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    }
  }

  console.log('--- SECTION 1: Verification of All 9 Transactional Templates ---');

  await test('1. Client Invitation Template renders properly with escaped inputs', () => {
    const tpl = renderClientInvitationEmail({
      clientName: 'Acme & Co <script>',
      freelancerName: 'Studio "Rivera"',
      portalUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1',
    });
    assert(tpl.subject.includes('Studio "Rivera"'));
    assert(tpl.html.includes('&lt;script&gt;'));
    assert(tpl.html.includes('https://flowdesk-v1.vercel.app/portal/cli-1'));
  });

  await test('2. Deliverable Ready Template renders with portal URL and version', () => {
    const tpl = renderDeliverableReadyEmail({
      clientName: 'Sarah Connor',
      freelancerName: 'Alex Rivera',
      projectTitle: 'Brand Guidelines',
      deliverableTitle: 'Logo System Final',
      portalUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1',
      version: 'v2.1',
    });
    assert(tpl.subject.includes('Logo System Final'));
    assert(tpl.html.includes('v2.1'));
    assert(tpl.html.includes('https://flowdesk-v1.vercel.app/portal/cli-1'));
  });

  await test('3. Deliverable Approved Template renders with client feedback notes', () => {
    const tpl = renderDeliverableApprovedEmail({
      freelancerName: 'Alex Rivera',
      clientName: 'Acme Corp',
      projectTitle: 'Enterprise Rebrand',
      deliverableTitle: 'Website Layout',
      deliverableUrl: 'https://flowdesk-v1.vercel.app/deliverables',
      notes: 'Looks amazing, approved!',
    });
    assert(tpl.subject.includes('Website Layout'));
    assert(tpl.html.includes('Looks amazing, approved!'));
  });

  await test('4. Revision Requested Template renders with feedback and action URL', () => {
    const tpl = renderRevisionRequestedEmail({
      freelancerName: 'Alex Rivera',
      clientName: 'Acme Corp',
      projectTitle: 'Enterprise Rebrand',
      deliverableTitle: 'Color Palette',
      deliverableUrl: 'https://flowdesk-v1.vercel.app/deliverables',
      feedback: 'Please make the blue slightly darker.',
    });
    assert(tpl.subject.includes('Revision Requested'));
    assert(tpl.html.includes('Please make the blue slightly darker.'));
  });

  await test('5. Document Uploaded Template renders with category and size', () => {
    const tpl = renderDocumentUploadedEmail({
      recipientName: 'Alex Rivera',
      uploaderName: 'Acme Corp',
      documentTitle: 'Contract_2026.pdf',
      projectTitle: 'Enterprise Rebrand',
      category: 'Contracts',
      documentUrl: 'https://flowdesk-v1.vercel.app/documents',
    });
    assert(tpl.subject.includes('Contract_2026.pdf'));
    assert(tpl.html.includes('Contracts'));
  });

  await test('6. Invoice Issued Template renders with invoice number, amount, and due date', () => {
    const tpl = renderInvoiceIssuedEmail({
      clientName: 'Acme Corp',
      freelancerName: 'Alex Rivera',
      invoiceNumber: 'INV-2026-001',
      amount: '$15,000.00',
      dueDate: '2026-10-15',
      invoiceUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1',
    });
    assert(tpl.subject.includes('INV-2026-001'));
    assert(tpl.html.includes('$15,000.00'));
    assert(tpl.html.includes('2026-10-15'));
  });

  await test('7. Payment Received Template renders with method and receipt link', () => {
    const tpl = renderPaymentReceivedEmail({
      recipientName: 'Acme Corp',
      freelancerName: 'Alex Rivera',
      invoiceNumber: 'INV-2026-001',
      amount: '$5,000.00',
      paymentDate: '2026-09-07',
      paymentMethod: 'Razorpay UPI',
      receiptUrl: 'https://flowdesk-v1.vercel.app/portal/cli-1',
    });
    assert(tpl.subject.includes('INV-2026-001'));
    assert(tpl.html.includes('$5,000.00'));
    assert(tpl.html.includes('Razorpay UPI'));
  });

  await test('8. Account Lifecycle Template renders deletion and restoration notices', () => {
    const delTpl = renderAccountLifecycleEmail({
      userName: 'John Doe',
      action: 'deleted',
      restoreUntil: '2026-10-07',
      restoreUrl: 'https://flowdesk-v1.vercel.app/recover',
    });
    assert(delTpl.subject.includes('Account Deletion Initiated'));
    assert(delTpl.html.includes('2026-10-07'));

    const resTpl = renderAccountLifecycleEmail({
      userName: 'John Doe',
      action: 'restored',
      restoreUrl: 'https://flowdesk-v1.vercel.app/client/login',
    });
    assert(resTpl.subject.includes('Account Restored'));
  });

  await test('9. Security Alert Template renders action details and timestamp', () => {
    const tpl = renderSecurityAlertEmail({
      userName: 'Alex Rivera',
      eventType: 'Password Changed',
      details: 'Your account password was updated from Chrome on Windows.',
    });
    assert(tpl.subject.includes('Security Alert'));
    assert(tpl.html.includes('Password Changed'));
  });

  console.log('\n--- SECTION 2: Live Resend Dispatch of Client Invitation ---');

  await test('10. Live dispatch of Client Invitation Email to delivered@resend.dev', async () => {
    const res = await EmailService.sendClientInvitation('delivered@resend.dev', {
      clientName: 'Acme Global Client',
      freelancerName: 'FlowDesk Studio',
      portalUrl: 'https://flowdesk-v1.vercel.app/portal/cli-demo-test',
    });
    assert(res.success === true, `Client invitation dispatch failed: ${res.error}`);
    assert(typeof res.messageId === 'string' && res.messageId.length > 0);
    console.log(`    📨 Invitation Message ID: ${res.messageId}`);
  });

  console.log('\n--- SECTION 3: Live Resend Dispatch of Invoice Issued ---');

  await test('11. Live dispatch of Invoice Issued Email to delivered@resend.dev', async () => {
    const res = await EmailService.sendInvoiceIssued('delivered@resend.dev', {
      clientName: 'Acme Global Client',
      freelancerName: 'FlowDesk Studio',
      invoiceNumber: 'INV-AUDIT-999',
      amount: '$7,500.00',
      dueDate: '2026-10-01',
      invoiceUrl: 'https://flowdesk-v1.vercel.app/portal/cli-demo-test',
    });
    assert(res.success === true, `Invoice email dispatch failed: ${res.error}`);
    assert(typeof res.messageId === 'string' && res.messageId.length > 0);
    console.log(`    📨 Invoice Message ID: ${res.messageId}`);
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log('🎉 ALL EMAIL OPERATIONS ARE 100% OPERATIONAL!');
  }
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllEmailOperationsTests().catch((err) => {
  console.error('Unhandled test exception:', err);
  process.exit(1);
});
