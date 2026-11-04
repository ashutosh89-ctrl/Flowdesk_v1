/**
 * Headless Verification Script (Without DOM)
 * 
 * Tests the complete Freelancer <-> Client sync lifecycle:
 * 1. Deliverable Creation on Freelancer Side:
 *    - With repository URL, preview URL, preview image URL, branch, pull request.
 * 2. Client Side Display Verification:
 *    - Queries ClientDeliverableService for the client.
 *    - Verifies title, repoUrl, previewUrl, previewImageUrl, branchName, pullRequestUrl are returned.
 * 3. Deliverable Update on Freelancer Side:
 *    - Modifies deliverable metadata & status.
 *    - Verifies Client side reflects the update.
 * 4. Deliverable Deletion on Freelancer Side:
 *    - Deletes deliverable on Freelancer side.
 *    - Verifies Client side no longer returns it.
 * 5. Invoice Creation on Freelancer Side:
 *    - Creates invoice with items, bank details, and UPI QR code.
 * 6. Client Side Invoice Display Verification:
 *    - Queries ClientInvoiceService for the client.
 *    - Verifies invoice number, total, payment methods, bank details, and UPI QR code match.
 * 7. Invoice Update on Freelancer Side:
 *    - Modifies invoice notes.
 *    - Verifies Client side reflects the update.
 * 8. Invoice Deletion on Freelancer Side:
 *    - Deletes invoice.
 *    - Verifies Client side no longer returns the invoice.
 */

import fs from 'fs';
import path from 'path';

// Force demo mode for deterministic headless test environment without browser session
process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

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
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key !== 'NEXT_PUBLIC_AUTH_MODE' && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { FreelancerDeliverableService, FreelancerInvoiceService } from '../src/backend/freelancer';
import { ClientDeliverableService } from '../src/backend/client/client-deliverable-service';
import { ClientInvoiceService } from '../src/backend/client/client-invoice-service';
import { supabaseAdmin } from '../src/backend/utilities/supabase';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function runHeadlessSyncVerification() {
  console.log('\n======================================================');
  console.log('   FLOWDESK HEADLESS FREELANCER <-> CLIENT SYNC TEST  ');
  console.log('======================================================\n');

  const testClientId = `client-test-${Date.now()}`;
  const testClientName = 'Acme Corp';

  // -------------------------------------------------------------------------
  // SUITE 1: Deliverables CRUD Sync (Freelancer -> Client)
  // -------------------------------------------------------------------------
  console.log('--- SUITE 1: DELIVERABLE CREATION & CLIENT REFLECTION ---');

  const deliverablePayload: any = {
    clientId: testClientId,
    clientName: testClientName,
    title: 'E-Commerce Platform Redesign Deliverable',
    description: 'Complete redesign deliverable with live preview, repo, and screenshot mockup',
    version: 'v1.0.0',
    priority: 'high',
    dueDate: '2026-11-15',
    status: 'ready_for_review',
    approvalStatus: 'pending',
    niche: 'software_development',
    repoUrl: 'https://github.com/acme-corp/ecommerce-storefront',
    previewUrl: 'https://preview.acme-corp.com/v1',
    previewImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    nicheMetadata: {
      repositoryUrl: 'https://github.com/acme-corp/ecommerce-storefront',
      repoUrl: 'https://github.com/acme-corp/ecommerce-storefront',
      previewUrl: 'https://preview.acme-corp.com/v1',
      projectUrl: 'https://preview.acme-corp.com/v1',
      liveProjectUrl: 'https://preview.acme-corp.com/v1',
      previewImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      branchName: 'feature/checkout-v2',
      pullRequestUrl: 'https://github.com/acme-corp/ecommerce-storefront/pull/108',
      releaseVersion: 'v1.0.0',
    },
  };

  const createdDeliverable = await FreelancerDeliverableService.addDeliverable(deliverablePayload);
  assert(Boolean(createdDeliverable?.id), 'Freelancer creates deliverable successfully', `ID: ${createdDeliverable?.id}`);

  // Query Client Side Deliverables
  const clientDeliverables = await ClientDeliverableService.getDeliverables(testClientId);
  const matchedClientDeliverable = clientDeliverables.find((d) => d.id === createdDeliverable.id || d.title === deliverablePayload.title);

  assert(Boolean(matchedClientDeliverable), 'Created deliverable is visible on Client side');
  
  if (matchedClientDeliverable) {
    const meta = matchedClientDeliverable.nicheMetadata as any;
    const clientRepo = matchedClientDeliverable.repoUrl || meta?.repositoryUrl || meta?.repoUrl;
    const clientPreview = matchedClientDeliverable.previewUrl || meta?.previewUrl || meta?.projectUrl || meta?.liveProjectUrl;
    const clientImage = matchedClientDeliverable.previewImageUrl || meta?.previewImageUrl;
    const clientBranch = meta?.branchName;
    const clientPR = meta?.pullRequestUrl;

    assert(clientRepo === 'https://github.com/acme-corp/ecommerce-storefront', 'Client side shows correct Repository URL', clientRepo);
    assert(clientPreview === 'https://preview.acme-corp.com/v1', 'Client side shows correct Project / Preview URL', clientPreview);
    assert(clientImage === 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', 'Client side shows correct Preview Image URL', clientImage);
    assert(clientBranch === 'feature/checkout-v2', 'Client side shows correct Branch name', clientBranch);
    assert(clientPR === 'https://github.com/acme-corp/ecommerce-storefront/pull/108', 'Client side shows correct Pull Request URL', clientPR);
  }

  // -------------------------------------------------------------------------
  // SUITE 2: Deliverable Update & Client Sync
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: DELIVERABLE UPDATE SYNC ---');

  const updatedTitle = 'E-Commerce Platform Redesign Deliverable (Approved Rev)';
  const updatedDeliverable = await FreelancerDeliverableService.updateDeliverable(createdDeliverable.id, {
    title: updatedTitle,
    status: 'approved',
    approvalStatus: 'approved',
  });

  assert(Boolean(updatedDeliverable), 'Freelancer updates deliverable');

  const refreshedClientDeliverables = await ClientDeliverableService.getDeliverables(testClientId);
  const clientUpdatedDel = refreshedClientDeliverables.find((d) => d.id === createdDeliverable.id);

  assert(Boolean(clientUpdatedDel), 'Client side still finds updated deliverable');
  assert(clientUpdatedDel?.title === updatedTitle, 'Client side reflects updated title', clientUpdatedDel?.title);
  assert(clientUpdatedDel?.status === 'approved', 'Client side reflects updated status', clientUpdatedDel?.status);

  // -------------------------------------------------------------------------
  // SUITE 3: Deliverable Deletion & Client Clean-up
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: DELIVERABLE DELETION SYNC ---');

  const deleteDelSuccess = await FreelancerDeliverableService.deleteDeliverable(createdDeliverable.id);
  assert(deleteDelSuccess, 'Freelancer deletes deliverable');

  const clientDeliverablesAfterDelete = await ClientDeliverableService.getDeliverables(testClientId);
  const deletedDelFound = clientDeliverablesAfterDelete.some((d) => d.id === createdDeliverable.id);
  assert(!deletedDelFound, 'Deleted deliverable is immediately purged from Client side');

  // -------------------------------------------------------------------------
  // SUITE 4: Invoice Creation & Client Reflection
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: INVOICE CREATION & CLIENT REFLECTION ---');

  const invoicePayload: any = {
    clientId: testClientId,
    clientName: testClientName,
    clientEmail: 'billing@acme-corp.com',
    invoiceNumber: `INV-TEST-${Date.now().toString().slice(-4)}`,
    issueDate: '2026-10-30',
    dueDate: '2026-11-14',
    currency: 'INR',
    items: [
      { description: 'Full-Stack UI Development & Animations', quantity: 1, rate: 2500 },
    ],
    taxPercentage: 18,
    taxName: 'GST (18%)',
    discount: 0,
    notes: 'Please settle invoice within 14 days.',
    paymentMethods: {
      bankTransferEnabled: true,
      upiEnabled: true,
      razorpayLinkEnabled: false,
      upiQrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi%3A%2F%2Fpay%3Fpa%3Dfreelancer%40okaxis%26pn%3DStudio%26am%3D2950',
    },
    upiId: 'freelancer@okaxis',
    upiQrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi%3A%2F%2Fpay%3Fpa%3Dfreelancer%40okaxis%26pn%3DStudio%26am%3D2950',
    bankDetails: {
      accountHolderName: 'Alex Studio LLC',
      bankName: 'HDFC Bank',
      accountNumber: '50100234567890',
      ifscCode: 'HDFC0001234',
      upiId: 'freelancer@okaxis',
    },
  };

  const createdInvoice = await FreelancerInvoiceService.createInvoice(invoicePayload);
  assert(Boolean(createdInvoice?.id), 'Freelancer creates invoice successfully', `Invoice #${createdInvoice?.invoiceNumber}`);

  const clientInvoices = await ClientInvoiceService.getInvoices(testClientId);
  const matchedClientInvoice = clientInvoices.find((i) => i.id === createdInvoice.id || i.invoiceNumber === createdInvoice.invoiceNumber);

  assert(Boolean(matchedClientInvoice), 'Created invoice is visible on Client side');

  if (matchedClientInvoice) {
    assert(matchedClientInvoice.invoiceNumber === createdInvoice.invoiceNumber, 'Invoice number matches on Client side');
    assert(Number(matchedClientInvoice.total) === 2950, 'Total with GST 18% matches ₹2,950', String(matchedClientInvoice.total));
    assert(matchedClientInvoice.bankDetails?.bankName === 'HDFC Bank', 'Client side shows Bank Details');
    assert(Boolean(matchedClientInvoice.upiQrCodeUrl || matchedClientInvoice.paymentMethods?.upiQrCodeUrl), 'Client side shows UPI QR Code URL');
  }

  // -------------------------------------------------------------------------
  // SUITE 5: Invoice Update & Client Sync
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 5: INVOICE UPDATE SYNC ---');

  const updatedNotes = 'Updated: Early settlement discount applied.';
  const updatedInvoice = await FreelancerInvoiceService.updateInvoice(createdInvoice.id, {
    notes: updatedNotes,
  });

  assert(Boolean(updatedInvoice), 'Freelancer updates invoice notes');

  const refreshedClientInvoices = await ClientInvoiceService.getInvoices(testClientId);
  const clientUpdatedInv = refreshedClientInvoices.find((i) => i.id === createdInvoice.id);

  assert(Boolean(clientUpdatedInv), 'Client side finds updated invoice');
  assert(clientUpdatedInv?.notes === updatedNotes, 'Client side reflects updated invoice notes', clientUpdatedInv?.notes);

  // -------------------------------------------------------------------------
  // SUITE 6: Invoice Deletion & Client Clean-up
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 6: INVOICE DELETION SYNC ---');

  const deleteInvSuccess = await FreelancerInvoiceService.deleteInvoice(createdInvoice.id);
  assert(deleteInvSuccess, 'Freelancer deletes invoice');

  const clientInvoicesAfterDelete = await ClientInvoiceService.getInvoices(testClientId);
  const deletedInvFound = clientInvoicesAfterDelete.some((i) => i.id === createdInvoice.id);
  assert(!deletedInvFound, 'Deleted invoice is immediately purged from Client side');

  // -------------------------------------------------------------------------
  // SUITE 7: Remote Supabase Connection Probe
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 7: REMOTE SUPABASE PROBE ---');
  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
    const probePromise = supabaseAdmin.from('invoices').select('id').limit(1);
    const res = await Promise.race([probePromise, timeoutPromise]) as any;
    if (res?.error) {
      console.log('  \x1b[33mℹ NOTICE\x1b[0m: Supabase remote query notice: ' + res.error.message);
    } else {
      console.log('  \x1b[32m✔ PASS\x1b[0m: Supabase remote table reachable');
      passedTests++;
    }
  } catch {
    console.log('  \x1b[33mℹ NOTICE\x1b[0m: Supabase remote probe skipped (offline/timeout)');
  }

  // Summary
  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHeadlessSyncVerification().catch((err) => {
  console.error('Unexpected error running headless sync verification:', err);
  process.exit(1);
});
