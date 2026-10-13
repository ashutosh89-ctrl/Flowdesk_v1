import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

test('Batch 2: Deliverable Server Mutations Suite', async (suite) => {
  process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

  const { POST: handleSubmit } = await import('../app/api/deliverables/[deliverableId]/submit/route');
  const { POST: handleRevision } = await import('../app/api/deliverables/[deliverableId]/revision/route');
  const { POST: handleVersions } = await import('../app/api/deliverables/[deliverableId]/versions/route');
  const { POST: handleComments } = await import('../app/api/deliverables/[deliverableId]/comments/route');

  await suite.test('Deliverable Submit: rejects unauthenticated caller with 401 in production', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/deliverables/d1d1d1d1-1111-4111-8111-111111111111/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionMessage: 'Ready for review' }),
    });
    const res = await handleSubmit(req, {
      params: Promise.resolve({ deliverableId: 'd1d1d1d1-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'UNAUTHORIZED');
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Deliverable Submit: rejects invalid UUID parameter with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/deliverables/invalid-uuid/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionMessage: 'Ready for review' }),
    });
    const res = await handleSubmit(req, {
      params: Promise.resolve({ deliverableId: 'invalid-uuid' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PARAM');
  });

  await suite.test('Deliverable Submit: successfully transitions to submitted in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/deliverables/d1d1d1d1-1111-4111-8111-111111111111/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionMessage: 'First design drafts attached' }),
    });
    const res = await handleSubmit(req, {
      params: Promise.resolve({ deliverableId: 'd1d1d1d1-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.deliverable.status, 'submitted');
    assert.equal(data.deliverable.approval_status, 'pending');
  });

  await suite.test('Deliverable Revision: rejects empty comment with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/deliverables/d1d1d1d1-1111-4111-8111-111111111111/revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionComment: '' }),
    });
    const res = await handleRevision(req, {
      params: Promise.resolve({ deliverableId: 'd1d1d1d1-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PAYLOAD');
  });

  await suite.test('Deliverable Revision: successfully records revision request in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/deliverables/d1d1d1d1-1111-4111-8111-111111111111/revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionComment: 'Please adjust primary branding color to navy blue' }),
    });
    const res = await handleRevision(req, {
      params: Promise.resolve({ deliverableId: 'd1d1d1d1-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.deliverable.status, 'revision_requested');
    assert.equal(data.deliverable.rejection_reason, 'Please adjust primary branding color to navy blue');
  });

  await suite.test('Deliverable Versions: registers version in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/deliverables/d1d1d1d1-1111-4111-8111-111111111111/versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: 'Updated hero section assets',
        fileName: 'hero-v2.fig',
        fileSize: '4.2 MB',
      }),
    });
    const res = await handleVersions(req, {
      params: Promise.resolve({ deliverableId: 'd1d1d1d1-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.version.versionNumber, 'v2.0');
    assert.equal(data.version.fileName, 'hero-v2.fig');
  });

  await suite.test('Deliverable Comments: posts collaboration comment in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/deliverables/d1d1d1d1-1111-4111-8111-111111111111/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Reviewing the updated typography now.',
        isInternal: false,
      }),
    });
    const res = await handleComments(req, {
      params: Promise.resolve({ deliverableId: 'd1d1d1d1-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.comment.content, 'Reviewing the updated typography now.');
  });
});
