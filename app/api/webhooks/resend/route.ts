import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, supabaseAdmin } from '@/backend/utilities/supabase';

/**
 * Verifies Svix/Resend Webhook signature against raw request body
 * Rejects unsigned, forged, or stale/replayed (>5 minutes) requests
 */
function verifyResendWebhookSignature(params: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string;
}): boolean {
  const secret = params.secret || process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET is not configured on server.');
    return false;
  }

  const { rawBody, svixId, svixTimestamp, svixSignature } = params;

  if (!rawBody || !svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // 1. Enforce 5-minute timestamp tolerance to prevent replay attacks
  const timestampSec = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSec)) {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) {
    console.warn('[Resend Webhook] Stale or replayed webhook rejected (timestamp outside 5m window).');
    return false;
  }

  // 2. Decode webhook secret (Svix secrets typically prefixed with "whsec_")
  let secretBuffer: Buffer;
  try {
    if (secret.startsWith('whsec_')) {
      secretBuffer = Buffer.from(secret.slice(6), 'base64');
    } else {
      secretBuffer = Buffer.from(secret, 'utf-8');
    }
  } catch (err) {
    console.error('[Resend Webhook] Failed to decode webhook secret:', err);
    return false;
  }

  // 3. Compute expected HMAC SHA256 base64 signature: `${id}.${timestamp}.${body}`
  try {
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretBuffer)
      .update(toSign)
      .digest('base64');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');

    // 4. Parse provided signatures (space-delimited list of version,sig e.g. "v1,g0hM...")
    const signatures = svixSignature.split(' ');
    for (const versionedSig of signatures) {
      const parts = versionedSig.split(',');
      if (parts.length === 2 && parts[0] === 'v1') {
        const sigValue = parts[1];
        const providedBuf = Buffer.from(sigValue, 'utf-8');
        if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error('[Resend Webhook] Signature comparison error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body as text for cryptographic signature check
    const rawBody = await request.text();

    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    // 2. Verify Svix/Resend Authenticity
    const isValid = verifyResendWebhookSignature({
      rawBody,
      svixId,
      svixTimestamp,
      svixSignature,
    });

    if (!isValid) {
      console.warn('[Webhook /api/webhooks/resend] Security Alert: Webhook authentication failed.');
      return NextResponse.json(
        { received: false, error: 'Unauthorized: Invalid or missing webhook signature' },
        { status: 401 }
      );
    }

    // 3. Parse validated JSON payload
    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    if (!type || !data) {
      return NextResponse.json({ received: false, error: 'Invalid webhook payload structure' }, { status: 400 });
    }

    const emailId = data.email_id || data.id;
    if (!emailId) {
      return NextResponse.json({ received: true, note: 'No message ID identified in payload' });
    }

    const db = supabaseAdmin || supabase;
    let updateData: Record<string, any> = {};

    switch (type) {
      case 'email.delivered':
        updateData = {
          status: 'delivered',
          delivered_at: data.created_at || new Date().toISOString(),
        };
        break;
      case 'email.bounced':
        updateData = {
          status: 'failed',
          last_error: data.bounce?.message || 'Email bounced at recipient gateway',
        };
        break;
      case 'email.complained':
        updateData = {
          status: 'failed',
          last_error: 'Recipient marked email as spam / complaint',
        };
        break;
      case 'email.opened':
        updateData = {
          opened_at: data.created_at || new Date().toISOString(),
        };
        break;
      case 'email.clicked':
        updateData = {
          clicked_at: data.created_at || new Date().toISOString(),
        };
        break;
      default:
        // Ignore unhandled event types
        break;
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await db
        .from('email_events')
        .update(updateData)
        .eq('provider_message_id', emailId);

      if (error) {
        console.warn('[Webhook /api/webhooks/resend] Notice updating email_event:', error.message);
      }
    }

    return NextResponse.json({ received: true, event: type, messageId: emailId });
  } catch (err: any) {
    console.error('[Webhook /api/webhooks/resend] Error processing webhook:', err);
    return NextResponse.json(
      { received: false, error: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
