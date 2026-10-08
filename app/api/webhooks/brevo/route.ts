import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, supabaseAdmin } from '@/backend/utilities/supabase';

const ALLOWED_BREVO_EVENTS = new Set([
  'delivered',
  'hard_bounce',
  'soft_bounce',
  'blocked',
  'invalid_email',
  'error',
  'spam',
  'complaint',
  'opened',
  'unique_opened',
  'click',
]);

function timingSafeEqualSecret(provided: string, expected: string): boolean {
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

/**
 * Brevo Transactional Email Webhook Handler
 * Updates outbox records in `email_events` with delivery, bounce, open, and click statuses.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Fail Closed: Require BREVO_WEBHOOK_SECRET
    const webhookSecret = process.env.BREVO_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      console.error('[Brevo Webhook] BREVO_WEBHOOK_SECRET environment variable is missing or empty on server.');
      return NextResponse.json(
        { received: false, error: 'Webhook service configuration unavailable' },
        { status: 503 }
      );
    }

    // 2. Authenticate from headers only (Bearer token or custom headers; query string rejected)
    const authHeader = request.headers.get('authorization');
    const customToken =
      request.headers.get('x-sib-webhook-token') || request.headers.get('x-brevo-token');

    let providedToken: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (customToken) {
      providedToken = customToken.trim();
    }

    if (!providedToken || !timingSafeEqualSecret(providedToken, webhookSecret)) {
      return NextResponse.json(
        { received: false, error: 'Unauthorized: Invalid Brevo webhook signature/secret.' },
        { status: 401 }
      );
    }

    // 3. Payload size check & shape validation (max 50 KB)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 50 * 1024) {
      return NextResponse.json({ received: false, error: 'Payload exceeds size limit' }, { status: 400 });
    }

    const rawBody = await request.text().catch(() => '');
    if (new TextEncoder().encode(rawBody).length > 50 * 1024) {
      return NextResponse.json({ received: false, error: 'Payload exceeds size limit' }, { status: 400 });
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ received: false, error: 'Invalid webhook JSON payload' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ received: false, error: 'Invalid webhook JSON payload' }, { status: 400 });
    }


    const event = payload.event || payload.type;
    if (!event || typeof event !== 'string' || !ALLOWED_BREVO_EVENTS.has(event)) {
      return NextResponse.json(
        { received: false, error: `Invalid or unapproved Brevo event type: ${String(event).slice(0, 50)}` },
        { status: 400 }
      );
    }

    const rawMessageId = payload['message-id'] || payload.message_id || payload.messageId || payload.id;
    const messageId = typeof rawMessageId === 'string' ? rawMessageId.slice(0, 255) : null;
    const rawRecipient = payload.email;
    const recipient = typeof rawRecipient === 'string' ? rawRecipient.slice(0, 255) : null;

    if (!messageId && !recipient) {
      return NextResponse.json({ received: true, note: 'No messageId or recipient identified' });
    }

    const db = supabaseAdmin || supabase;
    let updateData: Record<string, any> = {};

    switch (event) {
      case 'delivered':
        updateData = {
          status: 'delivered',
          delivered_at: payload.date || new Date().toISOString(),
        };
        break;
      case 'hard_bounce':
      case 'soft_bounce':
      case 'blocked':
      case 'invalid_email':
      case 'error':
        updateData = {
          status: 'failed',
          last_error: payload.reason || `Email ${event} at recipient gateway`,
        };
        break;
      case 'spam':
      case 'complaint':
        updateData = {
          status: 'failed',
          last_error: 'Recipient marked email as spam / complaint',
        };
        break;
      case 'opened':
      case 'unique_opened':
        updateData = {
          opened_at: payload.date || new Date().toISOString(),
        };
        break;
      case 'click':
        updateData = {
          clicked_at: payload.date || new Date().toISOString(),
        };
        break;
      default:
        // Ignore unhandled event types
        break;
    }

    if (Object.keys(updateData).length > 0 && messageId) {
      const { error } = await db
        .from('email_events')
        .update(updateData)
        .eq('provider_message_id', messageId);

      if (error) {
        console.warn('[Webhook /api/webhooks/brevo] Notice updating email_event:', error.message);
      }
    }

    return NextResponse.json({ received: true, event, messageId });
  } catch (err: any) {
    console.error('[Webhook /api/webhooks/brevo] Webhook processing error:', err);
    return NextResponse.json(
      { received: false, error: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
