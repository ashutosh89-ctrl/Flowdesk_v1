import { NextRequest } from 'next/server';
import { FreelancerDeliverableService } from '../src/backend/freelancer';
import { ClientDeliverableService } from '../src/backend/client/client-deliverable-service';
import { FlowDeskStore } from '../src/backend/store/storage-store';
import { POST as createDeliverablePost, GET as listDeliverablesGet } from '../app/api/deliverables/route';
import { POST as approvePost } from '../app/api/deliverables/[deliverableId]/approve/route';
import { POST as submitPost } from '../app/api/deliverables/[deliverableId]/submit/route';
import { POST as revisionPost } from '../app/api/deliverables/[deliverableId]/revision/route';
import { POST as versionsPost } from '../app/api/deliverables/[deliverableId]/versions/route';
import { POST as commentsPost } from '../app/api/deliverables/[deliverableId]/comments/route';

async function runTestSuite() {
  process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  console.log('=== TEST SUITE: DELIVERABLES LIFECYCLE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(desc: string, cond: boolean, extra?: any) {
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`, extra ?? '');
      failed++;
    }
  }

  // --- PART 1: FreelancerDeliverableService (Store & Fallback) ---
  console.log('--- Part 1: FreelancerDeliverableService ---');

  const created = await FreelancerDeliverableService.addDeliverable({
    projectId: 'proj-1',
    clientId: 'cli-test-1',
    clientName: 'Acme Test Corp',
    title: 'Brand Identity Design System',
    description: 'Figma tokens, design library and asset exports',
    dueDate: '2026-10-30',
    reviewDeadline: '2026-11-05',
    version: 'v1.0.0',
    priority: 'high',
    status: 'draft',
    approvalStatus: 'pending',
    fileName: 'brand-identity-v1.pdf',
    fileSize: '12.4 MB',
    fileUrl: 'https://flowdesk.app/assets/brand-identity-v1.pdf',
  });

  assert('addDeliverable creates deliverable with ID', !!created?.id);
  assert('addDeliverable sets title correctly', created?.title === 'Brand Identity Design System');
  assert('addDeliverable sets version correctly', created?.version === 'v1.0.0');

  const fetched = await FreelancerDeliverableService.getDeliverableById(created.id);
  assert('getDeliverableById retrieves created deliverable', !!fetched && fetched.id === created.id);

  const allDels = await FreelancerDeliverableService.getDeliverables();
  assert('getDeliverables lists created deliverable', allDels.some((d) => d.id === created.id));

  // Upload new version
  const withNewVer = await FreelancerDeliverableService.uploadNewVersion(created.id, {
    version: 'v1.1.0',
    note: 'Added color palette refinements',
    fileName: 'brand-identity-v1.1.pdf',
    fileSize: '13.1 MB',
    uploadedBy: 'Designer',
  });
  assert('uploadNewVersion increments version', withNewVer?.version === 'v1.1.0');

  // Submit for client review
  const submitted = await FreelancerDeliverableService.submitDeliverableClientReview(created.id, {
    submissionMessage: 'Please review the updated Figma tokens.',
  });
  assert('submitDeliverableClientReview updates status to ready_for_review / submitted', submitted?.status === 'ready_for_review' || submitted?.status === 'submitted');

  // Approve
  const approved = await FreelancerDeliverableService.approveDeliverable(created.id, 'Looks good!');
  assert('approveDeliverable marks deliverable approved', approved?.approvalStatus === 'approved');

  // Request revision
  const revised = await FreelancerDeliverableService.requestDeliverableRevision(created.id, 'Need dark theme tokens');
  assert('requestDeliverableRevision marks revision_requested', revised?.approvalStatus === 'revision_requested');

  // Duplicate
  const duplicated = await FreelancerDeliverableService.duplicateDeliverable(created.id);
  assert('duplicateDeliverable creates a clone', !!duplicated && duplicated.title.includes('(Copy)'));

  // Archive
  const archived = await FreelancerDeliverableService.archiveDeliverable(created.id);
  assert('archiveDeliverable toggles archive', !!archived && Boolean(archived.status === 'archived' || archived.isArchived));

  // Delete
  const deleted = await FreelancerDeliverableService.deleteDeliverable(created.id);
  assert('deleteDeliverable removes deliverable', deleted === true);

  if (duplicated?.id) {
    await FreelancerDeliverableService.deleteDeliverable(duplicated.id);
  }

  // --- PART 2: ClientDeliverableService ---
  console.log('\n--- Part 2: ClientDeliverableService ---');

  // Create another deliverable for client testing
  const clientDeliv = await FreelancerDeliverableService.addDeliverable({
    projectId: 'proj-portal-1',
    clientId: 'cli-portal-1',
    clientName: 'Portal Client',
    title: 'Portal UI Kit',
    description: 'Deliverable for client portal verification',
    dueDate: '2026-11-15',
    version: 'v1.0.0',
    priority: 'medium',
    status: 'submitted',
    approvalStatus: 'pending',
  });

  const clientList = await ClientDeliverableService.getDeliverables('cli-portal-1');
  assert('ClientDeliverableService.getDeliverables returns items for clientId', clientList.some((d) => d.id === clientDeliv.id));

  const clientItem = await ClientDeliverableService.getDeliverableById(clientDeliv.id, 'cli-portal-1');
  assert('ClientDeliverableService.getDeliverableById finds item', !!clientItem && clientItem.id === clientDeliv.id);

  const clientApproved = await ClientDeliverableService.approveDeliverable('cli-portal-1', clientDeliv.id, 'Approved via portal');
  assert('ClientDeliverableService.approveDeliverable succeeds', clientApproved.success === true);

  const clientRev = await ClientDeliverableService.requestRevision('cli-portal-1', clientDeliv.id, 'Please revise margins');
  assert('ClientDeliverableService.requestRevision succeeds', clientRev.success === true);

  const commentRes = await ClientDeliverableService.addComment('cli-portal-1', clientDeliv.id, 'Great job on typography');
  assert('ClientDeliverableService.addComment succeeds', commentRes.success === true);

  // Clean up
  await FreelancerDeliverableService.deleteDeliverable(clientDeliv.id);

  // --- PART 3: API Route Handlers in Demo Mode ---
  console.log('\n--- Part 3: API Route Handlers ---');

  // POST /api/deliverables
  const reqPost = new NextRequest('http://localhost:3000/api/deliverables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'cli-demo',
      clientName: 'Demo Client',
      title: 'API Created Package',
      description: 'Package created via POST route',
      dueDate: '2026-11-01',
      version: 'v1.0.0',
      priority: 'high',
    }),
  });
  const resPost = await createDeliverablePost(reqPost);
  const dataPost = await resPost.json();
  assert('POST /api/deliverables returns 201', resPost.status === 201);
  assert('POST /api/deliverables returns deliverable', dataPost.success === true && !!dataPost.deliverable?.id);

  const testDelId = dataPost.deliverable.id;

  // GET /api/deliverables
  const reqGet = new NextRequest('http://localhost:3000/api/deliverables', { method: 'GET' });
  const resGet = await listDeliverablesGet(reqGet);
  const dataGet = await resGet.json();
  assert('GET /api/deliverables returns 200', resGet.status === 200);
  assert('GET /api/deliverables returns deliverables array', Array.isArray(dataGet.deliverables));

  // POST /api/deliverables/[id]/approve
  const reqApprove = new NextRequest(`http://localhost:3000/api/deliverables/${testDelId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Sign-off approved' }),
  });
  const resApprove = await approvePost(reqApprove, { params: Promise.resolve({ deliverableId: testDelId }) });
  const dataApprove = await resApprove.json();
  assert('POST /api/deliverables/[id]/approve returns 200 with non-UUID demo ID', resApprove.status === 200);
  assert('POST /api/deliverables/[id]/approve reports success', dataApprove.success === true);

  // POST /api/deliverables/[id]/submit
  const reqSubmit = new NextRequest(`http://localhost:3000/api/deliverables/${testDelId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionMessage: 'Ready for review' }),
  });
  const resSubmit = await submitPost(reqSubmit, { params: Promise.resolve({ deliverableId: testDelId }) });
  const dataSubmit = await resSubmit.json();
  assert('POST /api/deliverables/[id]/submit returns 200', resSubmit.status === 200);
  assert('POST /api/deliverables/[id]/submit reports success', dataSubmit.success === true);

  // POST /api/deliverables/[id]/revision
  const reqRevision = new NextRequest(`http://localhost:3000/api/deliverables/${testDelId}/revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revisionComment: 'Adjust button padding' }),
  });
  const resRevision = await revisionPost(reqRevision, { params: Promise.resolve({ deliverableId: testDelId }) });
  const dataRevision = await resRevision.json();
  assert('POST /api/deliverables/[id]/revision returns 200', resRevision.status === 200);
  assert('POST /api/deliverables/[id]/revision reports success', dataRevision.success === true);

  // POST /api/deliverables/[id]/versions
  const reqVer = new NextRequest(`http://localhost:3000/api/deliverables/${testDelId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'v2 iteration' }),
  });
  const resVer = await versionsPost(reqVer, { params: Promise.resolve({ deliverableId: testDelId }) });
  const dataVer = await resVer.json();
  assert('POST /api/deliverables/[id]/versions returns 201', resVer.status === 201);
  assert('POST /api/deliverables/[id]/versions reports success', dataVer.success === true);

  // POST /api/deliverables/[id]/comments
  const reqCmt = new NextRequest(`http://localhost:3000/api/deliverables/${testDelId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Test note on deliverable' }),
  });
  const resCmt = await commentsPost(reqCmt, { params: Promise.resolve({ deliverableId: testDelId }) });
  const dataCmt = await resCmt.json();
  assert('POST /api/deliverables/[id]/comments returns 201', resCmt.status === 201);
  assert('POST /api/deliverables/[id]/comments reports success', dataCmt.success === true);

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
