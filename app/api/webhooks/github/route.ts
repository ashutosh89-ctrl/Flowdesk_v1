import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/backend/integrations/github/github-service';
import { logger, getOrCreateRequestId, createApiErrorResponse } from '@/backend/utilities/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const event = request.headers.get('x-github-event') || 'ping';
  const deliveryId = request.headers.get('x-github-delivery') || `deliv-${Date.now()}`;
  const signature = request.headers.get('x-hub-signature-256');

  const rawBody = await request.text();

  // 1. Signature Verification
  // In production/configured environments, reject invalid signatures
  const isSignatureValid = GitHubService.verifyWebhookSignature(rawBody, signature);
  const isConfigured = GitHubService.isConfigured();

  if (isConfigured && !isSignatureValid) {
    logger.warn('[GitHubWebhook] Rejected invalid HMAC signature', { requestId, deliveryId, event });
    return createApiErrorResponse({
      message: 'Invalid webhook signature.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 2. Parse Payload
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return createApiErrorResponse({
      message: 'Invalid JSON payload.',
      code: 'BAD_REQUEST',
      status: 400,
      requestId,
    });
  }

  // Ping event response
  if (event === 'ping') {
    return NextResponse.json({ success: true, message: 'pong', requestId });
  }

  // 3. Process Webhook Event
  const result = await GitHubService.processWebhookEvent(event, deliveryId, payload);

  return NextResponse.json({
    success: result.success,
    event,
    actionTaken: result.actionTaken,
    requestId,
  });
}
