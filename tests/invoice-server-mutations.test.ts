import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

// 1. Mock api-auth and rate limiter
let mockCaller: any = null;
let mockRateLimitAllowed = true;

const originalEnv = { ...process.env };

test('Batch 1: Invoice Server Mutations Suite', async (suite) => {
  // Set demo mode active to ensure clean credential-free execution
  process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

  const { POST: handleInvoiceStatus } = await import('../app/api/invoices/[invoiceId]/status/route');
  const { POST: handleOfflinePayment } = await import('../app/api/invoices/[invoiceId]/payments/offline/route');
  const { GET: handleNextNumber } = await import('../app/api/invoices/next-number/route');
  const { POST: handleCreateInvoice } = await import('../app/api/invoices/route');
  const { PATCH: handleUpdateInvoice, DELETE: handleDeleteInvoice } = await import('../app/api/invoices/[invoiceId]/route');

  await suite.test('Invoice Status: rejects unauthenticated caller with 401 when in production mode', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'production';
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });
    const res = await handleInvoiceStatus(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.code, 'UNAUTHORIZED');
    process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';
  });

  await suite.test('Invoice Status: rejects invalid UUID parameter with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/invalid-uuid/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });
    const res = await handleInvoiceStatus(req, {
      params: Promise.resolve({ invoiceId: 'invalid-uuid' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PARAM');
  });

  await suite.test('Invoice Status: rejects invalid status payload with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'hacked_status' }),
    });
    const res = await handleInvoiceStatus(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PAYLOAD');
  });

  await suite.test('Invoice Status: succeeds and returns valid demo response', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent', notes: 'Delivered statement' }),
    });
    const res = await handleInvoiceStatus(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.invoice.status, 'sent');
    assert.equal(data.invoice.notes, 'Delivered statement');
  });

  await suite.test('Offline Payment: rejects negative or zero amount with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111/payments/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -500 }),
    });
    const res = await handleOfflinePayment(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_PAYLOAD');
  });

  await suite.test('Offline Payment: records settlement in demo mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111/payments/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'bank_transfer', amount: 250, notes: 'Wire transfer received' }),
    });
    const res = await handleOfflinePayment(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.settlement.amountSettled, 250);
    assert.equal(data.settlement.paymentMethod, 'bank_transfer');
  });

  await suite.test('Invoice Number Suggestion: returns formatted sequence', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/next-number');
    const res = await handleNextNumber(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.match(data.nextInvoiceNumber, /^INV-\d{4}-\d{4}$/);
  });

  await suite.test('Invoice Create: creates invoice and recalculates totals', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'c1c1c1c1-1111-4111-8111-111111111111',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [
          { description: 'Consulting', quantity: 10, rate: 100 },
        ],
        taxPercentage: 10,
        discount: 50,
      }),
    });
    const res = await handleCreateInvoice(req);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.invoice.subtotal, 1000);
    assert.equal(data.invoice.tax, 100);
    assert.equal(data.invoice.total, 1050); // 1000 + 100 - 50
  });

  await suite.test('Invoice Update: updates invoice details cleanly', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Updated invoice payment instructions',
      }),
    });
    const res = await handleUpdateInvoice(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.invoice.notes, 'Updated invoice payment instructions');
  });

  await suite.test('Invoice Delete: handles deletion cleanly', async () => {
    const req = new NextRequest('http://localhost:3000/api/invoices/b5a5b5a5-1111-4111-8111-111111111111', {
      method: 'DELETE',
    });
    const res = await handleDeleteInvoice(req, {
      params: Promise.resolve({ invoiceId: 'b5a5b5a5-1111-4111-8111-111111111111' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });
});
