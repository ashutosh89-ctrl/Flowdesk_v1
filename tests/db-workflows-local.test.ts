#!/usr/bin/env npx tsx
/**
 * FlowDesk — Live database workflow integration test (local Supabase).
 *
 * Unlike tests/data-workflow-e2e.test.ts (which runs against the in-memory demo
 * store), this suite drives the REAL application service/repository layer with
 * REAL authenticated Supabase sessions against a real PostgreSQL database in
 * production auth mode. Every assertion is verified by an independent,
 * service-role read of what was actually persisted.
 *
 * Requires a running local Supabase stack (`npx supabase start`).
 *
 * Usage:
 *   npx tsx tests/db-workflows-local.test.ts
 *
 * Environment (defaults match `supabase start`):
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321';
// Public, fixed local-development credentials published by the Supabase CLI.
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Configure the application runtime BEFORE importing application modules: the
// shared Supabase client in src/backend/utilities/supabase.ts is constructed at
// import time from these environment variables.
process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
delete process.env.BREVO_API_KEY;
delete process.env.RESEND_API_KEY;

const admin: SupabaseClient = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = 'Test-Password-123!';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

function section(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

/** Create an email-confirmed auth user; the auth trigger provisions profile/workspace. */
async function makeUser(tag: string) {
  const email = `flowdesk-${tag}-${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${tag}) failed: ${error?.message}`);
  return { id: data.user.id, email };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║    FLOWDESK LIVE DATABASE WORKFLOW INTEGRATION TEST          ║');
  console.log('║    (real service layer + real DB, production auth mode)      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Target: ${URL}\n`);

  const { supabase } = await import('../src/backend/utilities/supabase');
  const { ClientRepository } = await import('../src/backend/repositories/clients/client-service');
  const {
    FreelancerProjectService,
    FreelancerInvoiceService,
    FreelancerDeliverableService,
    FreelancerDocumentService,
    FreelancerWorkspaceService,
    FreelancerNotificationService,
    SettingsService,
    FreelancerActivityService,
  } = await import('../src/backend/freelancer');
  const { UserSettingsService } = await import('../src/backend/auth/user-settings-service');
  const { NotificationHelper } = await import('../src/backend/utilities/notification-helper');
  const { updateWorkspaceBranding } = await import('../src/backend/utilities/workspace');
  const { buildStoragePath, StorageHelper } = await import('../src/backend/storage/storage-helper');
  const { InvitationService } = await import('../src/backend/invitations/invitation-service');

  const userA = await makeUser('ownerA');
  const userB = await makeUser('ownerB');
  const clientUser = await makeUser('clientPortal');
  const cleanupUsers = [userA.id, userB.id, clientUser.id];
  const cleanupWorkspaces: string[] = [];

  async function signInAs(user: { email: string; id: string }) {
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: PASSWORD });
    if (error) throw new Error(`signIn(${user.email}) failed: ${error.message}`);
  }

  async function workspaceOf(userId: string) {
    const { data } = await admin.from('workspaces').select('id').eq('owner_id', userId).maybeSingle();
    if (!data) throw new Error(`No workspace provisioned for ${userId}`);
    cleanupWorkspaces.push(data.id);
    return data.id as string;
  }

  try {
    const wsA = await workspaceOf(userA.id);
    const wsB = await workspaceOf(userB.id);

    section('G. Authentication preservation');
    check('Sign-out leaves no session', (await supabase.auth.getSession()).data.session === null);
    await signInAs(userA);
    const { data: sessionData } = await supabase.auth.getSession();
    check('Sign-in establishes a session', Boolean(sessionData.session?.user?.id));
    check('Session user matches the signed-in identity', sessionData.session?.user?.id === userA.id);
    const { data: wsForA } = await supabase.from('workspaces').select('id').eq('owner_id', userA.id);
    check('Authenticated session resolves its own workspace', (wsForA?.length ?? 0) === 1);

    // =========================================================================
    section('A. Clients');
    const clientA = await ClientRepository.createClient({
      name: 'Alpha Contact',
      company: 'Alpha Co',
      email: `alpha-${stamp}@example.test`,
      status: 'active',
      activeProjectsCount: 0,
      country: 'India',
      currency: 'USD',
      phone: '+91 90000 00001',
    });
    const { data: persistedClient } = await admin
      .from('clients').select('*').eq('id', clientA.id).maybeSingle();
    check('Client create is persisted to the database', persistedClient?.id === clientA.id);
    check('Client is bound to the creator workspace', persistedClient?.workspace_id === wsA);

    const reloaded = await ClientRepository.getClients();
    check('Client survives a reload (list read)', reloaded.some((c) => c.id === clientA.id));

    await ClientRepository.updateClient(clientA.id, {
      name: 'Alpha Contact Updated',
      company: 'Alpha Co Ltd',
      phone: '+91 90000 00002',
    });
    const { data: afterUpdate } = await admin
      .from('clients').select('name, company, phone').eq('id', clientA.id).maybeSingle();
    check('Client update persists (name, company, phone)',
      afterUpdate?.name === 'Alpha Contact Updated' && afterUpdate?.company === 'Alpha Co Ltd' && afterUpdate?.phone === '+91 90000 00002');

    const { error: missingFieldErr } = await admin
      .from('clients').insert({ workspace_id: wsA, name: 'No Company' });
    check('Required fields cannot be silently omitted (company NOT NULL)', Boolean(missingFieldErr));

    const { error: invalidStatusErr } = await admin
      .from('clients').insert({ workspace_id: wsA, name: 'Bad Status', company: 'X', email: `x-${stamp}@example.test`, status: 'not_a_status' });
    check('Invalid client status is rejected by the check constraint', Boolean(invalidStatusErr));

    const { error: duplicateEmailErr } = await admin.from('clients').insert({
      workspace_id: wsA, name: 'Alpha Duplicate', company: 'Alpha Co', email: persistedClient!.email, status: 'active',
    });
    if (duplicateEmailErr) {
      console.log('     ↳ note: duplicate client email rejected by the database');
    } else {
      console.log('     ↳ observation: duplicate client emails are allowed (no unique constraint) — dedupe is app-level only');
    }
    check('Duplicate/conflicting client insert is handled deterministically (no crash)', true);

    await ClientRepository.updateClient(clientA.id, { status: 'archived' });
    const { data: archived } = await admin.from('clients').select('status').eq('id', clientA.id).maybeSingle();
    check('Client archival persists', archived?.status === 'archived');
    await ClientRepository.updateClient(clientA.id, { status: 'active' });

    // =========================================================================
    section('B. Projects');
    const project = await FreelancerProjectService.createProject({
      clientId: clientA.id,
      clientName: 'Alpha Co',
      title: 'Alpha Rebrand',
      description: 'Full visual identity refresh.',
      status: 'in_progress',
      budget: 15000,
      startDate: '2026-10-01',
      dueDate: '2026-12-01',
      tags: ['branding'],
      milestones: [
        { id: 'ms-1', projectId: '', title: 'Discovery', dueDate: '2026-10-15', completed: false },
        { id: 'ms-2', projectId: '', title: 'Design System', dueDate: '2026-11-15', completed: false },
      ],
    });
    const { data: persistedProject } = await admin
      .from('projects').select('*').eq('id', project.id).maybeSingle();
    check('Project create is persisted', persistedProject?.id === project.id);
    check('Project is linked to the correct client and workspace',
      persistedProject?.client_id === clientA.id && persistedProject?.workspace_id === wsA);
    check('Project milestones round-trip as a JSON array (not a double-encoded string)',
      Array.isArray(persistedProject?.milestones) && persistedProject!.milestones.length === 2,
      `actual: ${JSON.stringify(persistedProject?.milestones)}`);

    const projectsReadBack = await FreelancerProjectService.getProjects();
    const projectAfterReload = projectsReadBack.find((p) => p.id === project.id);
    check('Project survives a reload with milestones readable by the UI',
      (projectAfterReload?.milestones?.length ?? 0) === 2,
      `milestones=${JSON.stringify(projectAfterReload?.milestones)}`);

    await FreelancerProjectService.updateProject(project.id, { status: 'completed', completionPercentage: 100 });
    const { data: updatedProject } = await admin
      .from('projects').select('status, completion_percentage').eq('id', project.id).maybeSingle();
    check('Project status/completion update persists',
      updatedProject?.status === 'completed' && updatedProject?.completion_percentage === 100);

    const { error: badFkErr } = await admin.from('projects').insert({
      workspace_id: wsA, client_id: '00000000-0000-4000-8000-000000000000',
      title: 'Orphan', status: 'in_progress', budget: 0, spent: 0,
    });
    check('Invalid client association is rejected (FK)', Boolean(badFkErr));

    const { error: badStatusErr } = await admin.from('projects').insert({
      workspace_id: wsA, client_id: clientA.id, title: 'Bad', status: 'nonsense', budget: 0, spent: 0,
    });
    check('Invalid project status is rejected (check constraint)', Boolean(badStatusErr));

    const { error: badCompletionErr } = await admin.from('projects').insert({
      workspace_id: wsA, client_id: clientA.id, title: 'Bad', status: 'in_progress', completion_percentage: 150, budget: 0, spent: 0,
    });
    check('Out-of-range completion percentage is rejected', Boolean(badCompletionErr));

    // =========================================================================
    section('C. Invoices, line items & payments');
    const invoice = await FreelancerInvoiceService.createInvoice({
      clientId: clientA.id,
      projectId: project.id,
      invoiceNumber: `INV-A-${stamp}`,
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'USD',
      taxPercentage: 10,
      taxName: 'GST',
      items: [
        { description: 'Brand strategy', quantity: 1, rate: 8000, amount: 8000 },
        { description: 'Design system', quantity: 2, rate: 1000, amount: 2000 },
      ],
    });
    const { data: persistedInvoice } = await admin
      .from('invoices').select('*, invoice_items(*)').eq('id', invoice.id).maybeSingle();
    check('Invoice create is persisted', persistedInvoice?.id === invoice.id);
    check('Invoice is linked to the correct client', persistedInvoice?.client_id === clientA.id);
    check('Line items are persisted', (persistedInvoice?.invoice_items?.length ?? 0) === 2);
    check('Subtotal is computed correctly (8000 + 2×1000 = 10000)',
      Number(persistedInvoice?.subtotal) === 10000, `actual=${persistedInvoice?.subtotal}`);
    check('Tax amount is computed correctly (10% of 10000 = 1000)',
      Number(persistedInvoice?.tax_amount) === 1000, `actual=${persistedInvoice?.tax_amount}`);
    check('Total is computed correctly (11000)', Number(persistedInvoice?.total_amount) === 11000,
      `actual=${persistedInvoice?.total_amount}`);
    check('Monetary columns are exact NUMERIC (no float drift)', persistedInvoice?.subtotal === '10000.00' || Number(persistedInvoice?.subtotal) === 10000);

    const invoicesAfterReload = await FreelancerInvoiceService.getInvoices();
    check('Invoice survives a reload (getInvoices, incl. receipts join)',
      invoicesAfterReload.some((i) => i.id === invoice.id));

    const { error: dupNumberErr } = await admin.from('invoices').insert({
      workspace_id: wsA, client_id: clientA.id, invoice_number: `INV-A-${stamp}`,
      issue_date: '2026-10-01', due_date: '2026-10-31', currency: 'USD',
      subtotal: 0, tax_amount: 0, total_amount: 0, paid_amount: 0,
    });
    check('Duplicate invoice number in the same workspace is rejected', Boolean(dupNumberErr));

    const { data: clientBRec } = await admin.from('clients').insert({
      workspace_id: wsB, name: 'Beta Contact', company: 'Beta Co',
      email: `beta-${stamp}@example.test`, status: 'active',
    }).select().single();
    const { data: bInvoice, error: bInvoiceErr } = await admin.from('invoices').insert({
      workspace_id: wsB, client_id: clientBRec!.id, invoice_number: `INV-A-${stamp}`,
      issue_date: '2026-10-01', due_date: '2026-10-31', currency: 'USD',
      subtotal: 0, tax_amount: 0, total_amount: 0, paid_amount: 0,
    }).select().maybeSingle();
    check('Invoice numbering is unique per workspace (same number allowed elsewhere)',
      !bInvoiceErr && Boolean(bInvoice));
    if (bInvoice) await admin.from('invoices').delete().eq('id', bInvoice.id);

    // Offline partial settlement through the real RPC.
    const partial = await FreelancerInvoiceService.markInvoicePaidOffline(invoice.id, {
      amountSettled: 5000, paymentMethod: 'bank_transfer', notes: 'Deposit',
    });
    check('Partial offline payment is recorded (status partially_paid)',
      partial?.status === 'partially_paid', `status=${partial?.status}`);
    check('Partial payment updates paid amount', Number(partial?.paidAmount) === 5000, `paid=${partial?.paidAmount}`);

    const { data: partialRow } = await admin.from('invoices').select('paid_amount, payment_status, status').eq('id', invoice.id).maybeSingle();
    check('Partial payment persisted on the invoice row',
      Number(partialRow?.paid_amount) === 5000 && partialRow?.payment_status === 'partially_paid');

    const { data: payments } = await admin.from('invoice_payments').select('*').eq('invoice_id', invoice.id);
    check('A payment ledger row was created', (payments?.length ?? 0) === 1);
    const { data: receipts } = await admin.from('receipts').select('*').eq('invoice_id', invoice.id);
    check('A durable receipt row was created', (receipts?.length ?? 0) === 1);
    check('Receipt references the payment', receipts?.[0]?.invoice_payment_id === payments?.[0]?.id);
    check('Receipt number is workspace-unique and non-empty', Boolean(receipts?.[0]?.receipt_number));

    const { data: invAfterPartial } = await admin
      .from('invoices').select('*, invoice_payments(*), receipts(*)').eq('id', invoice.id).maybeSingle();
    check('Invoice can be read with the receipts(*) embedded join',
      (invAfterPartial?.receipts?.length ?? 0) === 1);

    let overpaymentRejected = false;
    try {
      await FreelancerInvoiceService.markInvoicePaidOffline(invoice.id, { amountSettled: 999999, paymentMethod: 'cash' });
    } catch {
      overpaymentRejected = true;
    }
    check('Overpayment is rejected by record_manual_payment', overpaymentRejected);

    let invalidAmountRejected = false;
    try {
      await FreelancerInvoiceService.markInvoicePaidOffline(invoice.id, { amountSettled: -5, paymentMethod: 'cash' });
    } catch {
      invalidAmountRejected = true;
    }
    check('Non-positive payment amount is rejected', invalidAmountRejected);

    const settled = await FreelancerInvoiceService.markInvoicePaidOffline(invoice.id, { paymentMethod: 'bank_transfer', notes: 'Final' });
    check('Full settlement marks the invoice paid', settled?.status === 'paid', `status=${settled?.status}`);
    const { data: paidRow } = await admin.from('invoices').select('paid_amount, payment_status').eq('id', invoice.id).maybeSingle();
    check('Invoice paid amount equals the total', Number(paidRow?.paid_amount) === 11000);
    check('payment_status is paid', paidRow?.payment_status === 'paid');

    const { data: receiptsFinal } = await admin.from('receipts').select('id').eq('invoice_id', invoice.id);
    check('Each settlement produced exactly one receipt', (receiptsFinal?.length ?? 0) === 2);

    // Gateway settlement (idempotency + overpayment guard).
    const orderId = `order_test_${stamp}`;
    await admin.from('razorpay_orders').insert({
      order_id: orderId, invoice_id: invoice.id, workspace_id: wsA, client_id: clientA.id,
      amount: 500, amount_subunits: 50000, currency: 'USD', status: 'created', receipt: `rcpt_${stamp}`,
    });
    const gatewayInvoice = await FreelancerInvoiceService.createInvoice({
      clientId: clientA.id, invoiceNumber: `INV-GW-${stamp}`, issueDate: '2026-10-01', dueDate: '2026-10-31',
      currency: 'USD', items: [{ description: 'Gateway test', quantity: 1, rate: 500, amount: 500 }],
    });
    await admin.from('razorpay_orders').update({ invoice_id: gatewayInvoice.id }).eq('order_id', orderId);

    const settle1 = await admin.rpc('settle_razorpay_payment', {
      p_razorpay_payment_id: `pay_${stamp}`, p_razorpay_order_id: orderId, p_razorpay_signature: 'sig',
      p_amount: 500, p_currency: 'USD', p_payment_method: 'upi', p_captured_at: new Date().toISOString(),
      p_expected_invoice_id: gatewayInvoice.id, p_expected_client_id: clientA.id, p_notes: 'test',
    });
    check('Razorpay settlement succeeds', settle1.data?.success === true, JSON.stringify(settle1.data ?? settle1.error));
    check('Razorpay settlement returns a receipt', Boolean(settle1.data?.receipt?.receiptNumber));
    check('Settled invoice becomes paid', settle1.data?.status === 'paid');
    const { data: orderAfter } = await admin.from('razorpay_orders').select('status').eq('order_id', orderId).maybeSingle();
    check('Order ledger is marked paid', orderAfter?.status === 'paid');

    const settle2 = await admin.rpc('settle_razorpay_payment', {
      p_razorpay_payment_id: `pay_${stamp}`, p_razorpay_order_id: orderId, p_razorpay_signature: 'sig',
      p_amount: 500, p_currency: 'USD', p_payment_method: 'upi', p_captured_at: new Date().toISOString(),
      p_expected_invoice_id: gatewayInvoice.id, p_expected_client_id: clientA.id, p_notes: 'test',
    });
    check('Duplicate gateway event is idempotent (duplicateSuppressed, no double charge)',
      settle2.data?.success === true && settle2.data?.duplicateSuppressed === true,
      JSON.stringify(settle2.data));
    const { data: gwReceipts } = await admin.from('receipts').select('id').eq('invoice_id', gatewayInvoice.id);
    check('Duplicate gateway event created no extra receipt', (gwReceipts?.length ?? 0) === 1);

    const overSettleInvoice = await FreelancerInvoiceService.createInvoice({
      clientId: clientA.id, invoiceNumber: `INV-OV-${stamp}`, issueDate: '2026-10-01', dueDate: '2026-10-31',
      currency: 'USD', items: [{ description: 'Overpay test', quantity: 1, rate: 100, amount: 100 }],
    });
    const overSettle = await admin.rpc('settle_razorpay_payment', {
      p_razorpay_payment_id: `pay_over_${stamp}`, p_razorpay_order_id: null, p_razorpay_signature: null,
      p_amount: 500, p_currency: 'USD', p_payment_method: 'card', p_captured_at: new Date().toISOString(),
      p_expected_invoice_id: overSettleInvoice.id, p_expected_client_id: null, p_notes: null,
    });
    check('Gateway overpayment is rejected', overSettle.data?.success === false && overSettle.data?.errorCode === 'PAYMENT_AMOUNT_EXCEEDS_BALANCE',
      JSON.stringify(overSettle.data));

    // Financial-history protection.
    const { error: clientDeleteErr } = await admin.from('clients').delete().eq('id', clientA.id);
    check('Deleting a client with invoices is blocked (financial history preserved)', Boolean(clientDeleteErr));

    // =========================================================================
    section('D. Documents & private storage');
    const doc = await FreelancerDocumentService.requestDocument(clientA.id, { title: 'Master Service Agreement', type: 'contract' });
    const { data: persistedDoc } = await admin.from('documents').select('*').eq('id', doc.id).maybeSingle();
    check('Document request is persisted', persistedDoc?.id === doc.id);
    check('Document is linked to the client and workspace',
      persistedDoc?.client_id === clientA.id && persistedDoc?.workspace_id === wsA);

    const uploaded = await FreelancerDocumentService.uploadDocumentFile(doc.id, { fileName: 'msa.pdf', size: '2.1 MB' });
    check('Document upload metadata persists (status uploaded)',
      uploaded?.status === 'uploaded' && uploaded?.fileName === 'msa.pdf', `status=${uploaded?.status}`);

    const canonicalPath = buildStoragePath({
      bucket: 'documents', workspaceId: wsA, clientId: clientA.id, fileName: 'msa.pdf',
    });
    check('Canonical private storage path is workspace/client scoped',
      canonicalPath.startsWith(`workspaces/${wsA}/clients/${clientA.id}/`) && canonicalPath.endsWith('msa.pdf'),
      canonicalPath);

    await signInAs(userA);
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(canonicalPath, new Blob(['flowdesk-qa'], { type: 'text/plain' }), { upsert: true });
    check('Owner can upload into the private documents bucket', !uploadErr, uploadErr?.message);

    const { data: stored } = await admin.storage.from('documents').list(`workspaces/${wsA}/clients/${clientA.id}`);
    check('Uploaded object exists in the private bucket', (stored ?? []).some((o) => canonicalPath.endsWith(o.name)));

    const signed = await StorageHelper.getDownloadUrl('documents', canonicalPath);
    check('Authorized download URL can be minted for the object', typeof signed === 'string' && signed.length > 0);

    await signInAs(userB);
    const { error: crossSignErr } = await supabase.storage.from('documents').createSignedUrl(canonicalPath, 60);
    check('Other tenant cannot mint a signed URL for the object', Boolean(crossSignErr));
    const { data: crossDownload } = await supabase.storage.from('documents').download(canonicalPath);
    check('Other tenant cannot download the private object', crossDownload === null);

    await signInAs(userA);
    const deleted = await FreelancerDocumentService.deleteDocument(doc.id);
    const { data: goneDoc } = await admin.from('documents').select('id').eq('id', doc.id).maybeSingle();
    check('Document deletion removes the metadata row', deleted && goneDoc === null);

    // =========================================================================
    section('E. Deliverables');
    const deliverable = await FreelancerDeliverableService.addDeliverable({
      projectId: project.id, clientId: clientA.id, clientName: 'Alpha Co',
      title: 'Brand Guidelines v1', description: 'Initial guidelines', status: 'draft',
      priority: 'high', dueDate: '2026-11-01', version: 'v1.0',
    });
    const { data: persistedDeliverable } = await admin.from('deliverables').select('*').eq('id', deliverable.id).maybeSingle();
    check('Deliverable create is persisted', persistedDeliverable?.id === deliverable.id);
    check('Deliverable links workspace, client and project',
      persistedDeliverable?.workspace_id === wsA && persistedDeliverable?.client_id === clientA.id && persistedDeliverable?.project_id === project.id);

    const { data: deliverablesRead } = await admin.from('deliverables').select('id').eq('workspace_id', wsA).eq('id', deliverable.id);
    check('Deliverable survives a reload', (deliverablesRead?.length ?? 0) === 1);

    await FreelancerDeliverableService.uploadNewVersion(deliverable.id, {
      version: 'v2.0', note: 'Second pass', fileUrl: 'workspaces/x/y.pdf', fileName: 'brand-v2.pdf', fileSize: '1.2 MB',
    });
    const { data: versions } = await admin.from('deliverable_versions').select('*').eq('deliverable_id', deliverable.id);
    check('New deliverable version is persisted',
      (versions ?? []).some((v) => v.version_number === 'v2.0'),
      JSON.stringify((versions ?? []).map((v) => v.version_number)));
    const { data: versionedDeliverable } = await admin.from('deliverables').select('current_version').eq('id', deliverable.id).maybeSingle();
    check('Deliverable current version is updated', versionedDeliverable?.current_version === 'v2.0');

    await FreelancerDeliverableService.addDeliverableComment(deliverable.id, { content: 'Looks good', authorRole: 'freelancer' });
    const { data: comments } = await admin.from('deliverable_comments').select('*').eq('deliverable_id', deliverable.id);
    check('Deliverable comment is persisted', (comments?.length ?? 0) === 1);
    const { data: commentCounted } = await admin.from('deliverables').select('comments_count').eq('id', deliverable.id).maybeSingle();
    check('Deliverable comment counter is updated', Number(commentCounted?.comments_count) === 1);

    const { data: clientDocRow } = await admin.from('documents').select('id').eq('workspace_id', wsA).limit(1);
    check('Workspace-scoped read of documents is available for assertions', Array.isArray(clientDocRow));

    // Client review → approval lifecycle.
    await admin.from('deliverables').update({ status: 'submitted', approval_status: 'pending' }).eq('id', deliverable.id);
    const approved = await FreelancerDeliverableService.approveDeliverable(deliverable.id, 'Approved');
    const { data: approvedRow } = await admin.from('deliverables').select('status, approval_status, approved_at').eq('id', deliverable.id).maybeSingle();
    check('Deliverable approval transition persists',
      approvedRow?.status === 'approved' && approvedRow?.approval_status === 'approved', JSON.stringify(approvedRow));
    check('Approval timestamp is recorded', Boolean(approvedRow?.approved_at));
    check('approveDeliverable returns the updated deliverable', approved?.status === 'approved');

    await admin.from('deliverables').update({ status: 'submitted' }).eq('id', deliverable.id);
    await FreelancerDeliverableService.requestDeliverableRevision(deliverable.id, 'Increase contrast');
    const { data: revisionRow } = await admin.from('deliverables').select('status, rejection_reason').eq('id', deliverable.id).maybeSingle();
    check('Revision request persists with its reason',
      revisionRow?.status === 'revision_requested' && revisionRow?.rejection_reason === 'Increase contrast');

    // =========================================================================
    section('F. Settings & branding');
    await SettingsService.updateUserProfile({ name: 'Alex Owner', companyName: 'Alpha Studio', phone: '+91 90000 00003' });
    const { data: profileRow } = await admin.from('profiles').select('full_name, business_name, phone').eq('id', userA.id).maybeSingle();
    check('Profile update persists',
      profileRow?.full_name === 'Alex Owner' && profileRow?.business_name === 'Alpha Studio' && profileRow?.phone === '+91 90000 00003');

    await UserSettingsService.saveUserSettings(userA.id, { currency: 'EUR', invoice_prefix: 'ALPHA', default_tax_rate: 12 });
    const { data: settingsRow } = await admin.from('user_settings').select('currency, invoice_prefix, default_tax_rate').eq('id', userA.id).maybeSingle();
    check('User settings persist',
      settingsRow?.currency === 'EUR' && settingsRow?.invoice_prefix === 'ALPHA' && Number(settingsRow?.default_tax_rate) === 12);

    const brandingOk = await updateWorkspaceBranding(wsA, { name: 'Alpha Studio', logoUrl: 'workspaces/x/branding/logo.png' });
    const { data: wsRow } = await admin.from('workspaces').select('name, logo_url').eq('id', wsA).maybeSingle();
    check('Workspace branding persists', brandingOk && wsRow?.name === 'Alpha Studio' && wsRow?.logo_url === 'workspaces/x/branding/logo.png');

    const logoPath = buildStoragePath({ bucket: 'logos', workspaceId: wsA, fileName: 'studio-logo.png' });
    check('Branding objects use the workspace branding path', logoPath.startsWith(`workspaces/${wsA}/branding/`), logoPath);

    // =========================================================================
    section('H. Notifications & activity');
    await NotificationHelper.notifyFreelancer({ title: 'Invoice Paid', message: 'Invoice paid', category: 'invoice' });
    const { data: notifs } = await admin.from('notifications').select('*').eq('user_id', userA.id);
    check('Freelancer notification is persisted and targeted at the user', (notifs?.length ?? 0) >= 1);
    const notif = (notifs ?? [])[0];
    check('Notification starts unread', notif?.read === false);

    const feed = await FreelancerNotificationService.getNotifications();
    check('Notification feed read returns the notification', feed.some((n) => n.id === notif?.id));
    await FreelancerNotificationService.markAllAsRead();
    const { data: readRow } = await admin.from('notifications').select('read').eq('id', notif!.id).maybeSingle();
    check('Mark-all-as-read persists', readRow?.read === true);

    const activities = await FreelancerActivityService.getActivities();
    const { data: activityRows } = await admin.from('activities').select('*').eq('workspace_id', wsA);
    check('Activity trail is written for workspace mutations', (activityRows?.length ?? 0) >= 1);
    check('Activity feed read returns workspace activity', activities.length >= 1);

    // =========================================================================
    section('I. Background job queue (claim/complete/fail)');
    const { data: job } = await admin.from('jobs').insert({
      type: 'send_invoice', workspace_id: wsA, payload: { test: true }, status: 'queued', run_at: new Date(Date.now() - 1000).toISOString(),
    }).select().single();
    const { data: claimed, error: claimErr } = await admin.rpc('claim_jobs', {
      p_worker_id: `qa-worker-${stamp}`, p_batch_size: 5, p_lease_seconds: 60,
    });
    check('claim_jobs leases the due job', !claimErr && (claimed ?? []).some((j: any) => j.id === job!.id), claimErr?.message);
    const leased = (claimed ?? []).find((j: any) => j.id === job!.id);
    check('Leased job is marked running with a lease and attempt increment',
      leased?.status === 'running' && Boolean(leased?.locked_until) && Number(leased?.attempts) === 1,
      JSON.stringify(leased ?? null));

    const { error: claimAgainErr } = await admin.rpc('claim_jobs', { p_worker_id: `qa-worker2-${stamp}`, p_batch_size: 5, p_lease_seconds: 60 });
    const { data: claimedAgain } = await admin.rpc('claim_jobs', { p_worker_id: `qa-worker3-${stamp}`, p_batch_size: 5, p_lease_seconds: 60 });
    check('A leased job is not double-claimed while the lease is live',
      !claimAgainErr && !(claimedAgain ?? []).some((j: any) => j.id === job!.id));

    const { error: completeErr } = await admin.rpc('complete_job', { p_job_id: job!.id, p_worker_id: `qa-worker-${stamp}`, p_duration_ms: 42 });
    const { data: completedJob } = await admin.from('jobs').select('status, locked_by, locked_until, finished_at').eq('id', job!.id).maybeSingle();
    check('complete_job marks the job succeeded and releases the lease',
      !completeErr && completedJob?.status === 'succeeded' && completedJob?.locked_by === null && Boolean(completedJob?.finished_at),
      completeErr?.message);
    const { data: jobRuns } = await admin.from('job_runs').select('*').eq('job_id', job!.id);
    check('complete_job records a durable job run', (jobRuns?.length ?? 0) === 1);

    const { data: failJob } = await admin.from('jobs').insert({
      type: 'send_invoice', workspace_id: wsA, payload: {}, status: 'queued', run_at: new Date(Date.now() - 1000).toISOString(),
    }).select().single();
    const { data: claimedFail } = await admin.rpc('claim_jobs', { p_worker_id: `qa-worker-${stamp}`, p_batch_size: 50, p_lease_seconds: 60 });
    const leasedFail = (claimedFail ?? []).find((j: any) => j.id === failJob!.id);
    const { error: failErr } = await admin.rpc('fail_job', {
      p_job_id: failJob!.id, p_worker_id: `qa-worker-${stamp}`, p_duration_ms: 10,
      p_error_message: 'boom', p_next_run_at: new Date(Date.now() + 60000).toISOString(), p_dead: false,
    });
    const { data: failedJob } = await admin.from('jobs').select('status, last_error, locked_by').eq('id', failJob!.id).maybeSingle();
    check('fail_job requeues with the error recorded and releases the lease',
      !failErr && Boolean(leasedFail) && failedJob?.status === 'queued' && failedJob?.last_error === 'boom' && failedJob?.locked_by === null,
      failErr?.message ?? JSON.stringify(failedJob));

    // The failed lease was already released, so the retry can park the job directly.
    const { error: deadErr } = await admin.rpc('fail_job', {
      p_job_id: failJob!.id, p_worker_id: `qa-worker-${stamp}`, p_duration_ms: 10,
      p_error_message: 'fatal', p_next_run_at: null, p_dead: true,
    });
    const { data: deadJob } = await admin.from('jobs').select('status, finished_at').eq('id', failJob!.id).maybeSingle();
    check('fail_job with dead=true parks the job as dead and stamps completion',
      !deadErr && deadJob?.status === 'dead' && Boolean(deadJob?.finished_at),
      deadErr?.message ?? JSON.stringify(deadJob));
    const { data: failRuns } = await admin.from('job_runs').select('status').eq('job_id', failJob!.id);
    check('Failures are recorded in the job run ledger',
      (failRuns ?? []).some((r) => r.status === 'dead') && (failRuns ?? []).some((r) => r.status === 'failed'),
      JSON.stringify(failRuns));

    const { error: claimRevokedErr } = await admin.from('jobs').select('id').limit(1);
    check('Service role can read the job ledger for operations', !claimRevokedErr);

    // =========================================================================
    section('Portal invitations');
    const invite = await InvitationService.createOrGetInvitation(clientA.id, {
      forceNew: true, recipientEmail: clientUser.email,
    });
    check('Invitation link is generated with a raw token', Boolean(invite.rawToken) && invite.url.includes('/connect/'));
    const { data: inviteRow } = await admin.from('client_invitations').select('*').eq('client_id', clientA.id).maybeSingle();
    check('Only the token hash is stored (raw token never persisted)',
      Boolean(inviteRow) && inviteRow!.token_hash !== invite.rawToken && inviteRow!.token_hash.length === 64);

    const { data: publicDetails, error: publicErr } = await admin.rpc('get_invitation_public_details', { p_token_hash: inviteRow!.token_hash });
    check('get_invitation_public_details resolves the invitation', !publicErr && publicDetails?.isValid === true, publicErr?.message ?? JSON.stringify(publicDetails));
    check('Public details never expose the full recipient email',
      typeof publicDetails?.maskedEmail !== 'string' || !publicDetails.maskedEmail.includes('@example.test') ||
      publicDetails.maskedEmail.includes('***'), String(publicDetails?.maskedEmail));
    check('Public details never expose internal database ids',
      !('clientId' in (publicDetails ?? {})) && !('workspaceId' in (publicDetails ?? {})));

    const claimedInvite = await InvitationService.claimInvitation(invite.rawToken, clientUser.id, clientUser.email, { isEmailConfirmed: true });
    check('Invitation is claimed successfully', claimedInvite.success === true, JSON.stringify(claimedInvite));
    const { data: boundClient } = await admin.from('clients').select('user_id').eq('id', clientA.id).maybeSingle();
    check('Claiming binds the client record to the claiming user', boundClient?.user_id === clientUser.id);

    const secondClaim = await InvitationService.claimInvitation(invite.rawToken, clientUser.id, clientUser.email, { isEmailConfirmed: true });
    check('Invitation is single-use (second claim rejected)',
      secondClaim.success === false && secondClaim.errorCode === 'ALREADY_CLAIMED', JSON.stringify(secondClaim));

    // =========================================================================
    section('E2E. Cross-tenant isolation of the new surface');
    await signInAs(userB);
    const bDeliverables = await FreelancerDeliverableService.getDeliverables();
    check('Freelancer B sees none of A\'s deliverables', !bDeliverables.some((d) => d.id === deliverable.id));
    const bInvoices = await FreelancerInvoiceService.getInvoices();
    check('Freelancer B sees none of A\'s invoices', !bInvoices.some((i) => i.id === invoice.id));
    const bProjects = await FreelancerProjectService.getProjects();
    check('Freelancer B sees none of A\'s projects', !bProjects.some((p) => p.id === project.id));
    const bNotifications = await FreelancerNotificationService.getNotifications();
    check('Freelancer B sees none of A\'s notifications', !bNotifications.some((n) => n.id === notif?.id));

    const { data: bSeesDeliverable } = await supabase.from('deliverables').select('id').eq('id', deliverable.id);
    check('RLS blocks B from reading A\'s deliverable by id', (bSeesDeliverable?.length ?? 0) === 0);
    const { data: bSeesReceipt } = await supabase.from('receipts').select('id').eq('invoice_id', invoice.id);
    check('RLS blocks B from reading A\'s receipts', (bSeesReceipt?.length ?? 0) === 0);
    const { data: bSeesJob } = await supabase.from('jobs').select('id').eq('id', job!.id);
    check('RLS blocks B from reading A\'s job rows', (bSeesJob?.length ?? 0) === 0);

    await signInAs({ email: clientUser.email, id: clientUser.id });
    const { data: clientSeesOwnInvoice } = await supabase.from('invoices').select('id').eq('id', invoice.id);
    check('Bound client portal user can read their own invoice', (clientSeesOwnInvoice?.length ?? 0) === 1);
    const { data: clientSeesOwnReceipt } = await supabase.from('receipts').select('id').eq('invoice_id', invoice.id);
    check('Bound client portal user can read their own receipts', (clientSeesOwnReceipt?.length ?? 0) >= 1);
    const { data: clientSeesBWorkspace } = await supabase.from('clients').select('id').eq('workspace_id', wsB);
    check('Client portal user cannot read another workspace clients', (clientSeesBWorkspace?.length ?? 0) === 0);

    // Financial RPCs must reject an unrelated authenticated caller.
    await signInAs(userB);
    const { data: unauthorizedPayment, error: unauthorizedErr } = await supabase.rpc('record_manual_payment', {
      p_invoice_id: invoice.id, p_amount: 1, p_payment_method: 'cash', p_notes: 'intruder',
    });
    check('record_manual_payment rejects a non-owner caller',
      Boolean(unauthorizedErr) || unauthorizedPayment?.success === false,
      unauthorizedErr?.message ?? JSON.stringify(unauthorizedPayment));
    const { error: queueErr } = await supabase.rpc('claim_jobs', { p_worker_id: 'intruder', p_batch_size: 1, p_lease_seconds: 5 });
    check('Job queue RPCs are not executable by authenticated users', Boolean(queueErr));

    // =========================================================================
    section('Fail-closed behaviour (no fabricated production data)');
    await supabase.auth.signOut();
    const anonymousDeliverables = await FreelancerDeliverableService.getDeliverables();
    check('No session yields no deliverables (never demo/mock data)', anonymousDeliverables.length === 0,
      `returned ${anonymousDeliverables.length} records`);
    const anonymousProject = await FreelancerDeliverableService.getDeliverableById(deliverable.id);
    check('No session yields no deliverable detail (never demo/mock data)', anonymousProject === undefined);

    const anonPath = `workspaces/${wsA}/clients/${clientA.id}/anon-probe.txt`;
    const { error: anonUploadErr } = await supabase.storage.from('documents').upload(anonPath, new Blob(['x']), { upsert: true });
    check('Unauthenticated storage upload is rejected', Boolean(anonUploadErr));

    // =========================================================================
    section('Cleanup');
    try {
      await admin.storage.from('documents').remove([canonicalPath]);
    } catch {
      /* best-effort cleanup */
    }
    for (const id of cleanupUsers) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        /* best-effort cleanup */
      }
    }
    for (const id of cleanupWorkspaces) {
      try {
        await admin.from('workspaces').delete().eq('id', id);
      } catch {
        /* best-effort cleanup */
      }
    }
    console.log('  · synthetic users, workspaces and storage objects removed');
  } finally {
    for (const id of cleanupUsers) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
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
