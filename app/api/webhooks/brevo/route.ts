import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/backend/utilities/supabase';

/**
 * Brevo Transactional Email Webhook Handler
 * Updates outbox records in `email_events` with delivery, bounce, open, and click statuses.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ received: false, error: 'Invalid webhook JSON payload' }, { status: 400 });
    }

    const event = payload.event || payload.type;
    const messageId = payload['message-id'] || payload.message_id || payload.messageId || payload.id;
    const recipient = payload.email;

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
