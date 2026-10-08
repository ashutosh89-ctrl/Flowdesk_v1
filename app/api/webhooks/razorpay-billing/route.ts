import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';
import { razorpaySubscriptionProvider } from '@/backend/billing/razorpay-subscription-provider';
import { DEFAULT_GRACE_PERIOD_DAYS, BILLING_PLANS } from '@/shared/billing';
import { EmailService } from '@/backend/email/email-service';
import { NotificationHelper } from '@/backend/utilities/notification-helper';
import { getAppBaseUrl } from '@/shared/utils/url';

// Fast in-memory deduplication cache for demo/test mode
const demoProcessedEvents = new Set<string>();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Size Pre-Check (100 KB limit)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 100 * 1024) {
      return NextResponse.json({ error: 'Payload exceeds size limit' }, { status: 400 });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 100 * 1024) {
      return NextResponse.json({ error: 'Payload exceeds size limit' }, { status: 400 });
    }

    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      logger.warn('RAZORPAY_BILLING_WEBHOOK_MISSING_SIGNATURE', { path: '/api/webhooks/razorpay-billing' });
      return NextResponse.json({ error: 'Missing webhook signature header' }, { status: 400 });
    }

    // 2. Secret Fail-Closed
    const secret = process.env.RAZORPAY_BILLING_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('RAZORPAY_BILLING_WEBHOOK_SECRET_NOT_CONFIGURED', {
        message: 'Fail-closed: RAZORPAY_BILLING_WEBHOOK_SECRET is not configured on server.',
      });
      return NextResponse.json({ error: 'Webhook processing unavailable' }, { status: 500 });
    }

    // 3. Timing-Safe HMAC Validation
    const isValid = razorpaySubscriptionProvider.verifyWebhook(rawBody, signature, secret);
    if (!isValid) {
      logger.warn('RAZORPAY_BILLING_WEBHOOK_INVALID_SIGNATURE', { path: '/api/webhooks/razorpay-billing' });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // 4. Parse Event
    const event = JSON.parse(rawBody);
    const eventId = event.id || `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const eventType = event.event;
    const payload = event.payload;

    logger.info('RAZORPAY_BILLING_WEBHOOK_RECEIVED', { eventId, eventType });

    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    // 5. Idempotency Check (billing_events table or in-memory demo cache)
    if (isDemoModeActive()) {
      if (demoProcessedEvents.has(eventId)) {
        logger.info('RAZORPAY_BILLING_WEBHOOK_DUPLICATE_SKIPPED', { eventId, eventType });
        return NextResponse.json({ received: true, duplicate: true });
      }
      demoProcessedEvents.add(eventId);
    } else if (supabaseAdmin) {
      const { data: existingEvent } = await supabaseAdmin
        .from('billing_events')
        .select('id')
        .eq('provider_event_id', eventId)
        .maybeSingle();

      if (existingEvent) {
        logger.info('RAZORPAY_BILLING_WEBHOOK_DUPLICATE_SKIPPED', { eventId, eventType });
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    // 6. Subscription State Handling
    const subscriptionEntity = payload?.subscription?.entity;
    const providerSubId = subscriptionEntity?.id;
    let workspaceId: string | null = null;

    if (providerSubId && supabaseAdmin && !isDemoModeActive()) {
      const { data: storedSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, workspace_id, status, plan_key')
        .eq('provider_subscription_id', providerSubId)
        .maybeSingle();

      if (storedSub) {
        workspaceId = storedSub.workspace_id;
        const nowIso = new Date().toISOString();
        let targetStatus: string = storedSub.status;
        const updateFields: Record<string, any> = {
          updated_at: nowIso,
        };

        // Extract period timestamps safely from gateway
        if (subscriptionEntity.current_start) {
          updateFields.current_period_start = new Date(subscriptionEntity.current_start * 1000).toISOString();
        }
        if (subscriptionEntity.current_end) {
          updateFields.current_period_end = new Date(subscriptionEntity.current_end * 1000).toISOString();
        }

        switch (eventType) {
          case 'subscription.authenticated':
            // Mandate authorized
            targetStatus = 'active';
            break;

          case 'subscription.activated':
          case 'subscription.charged':
          case 'subscription.resumed':
            targetStatus = 'active';
            updateFields.cancel_at_period_end = false;
            updateFields.grace_ends_at = null;
            break;

          case 'subscription.pending':
            targetStatus = 'past_due';
            break;

          case 'subscription.halted':
            targetStatus = 'grace';
            updateFields.grace_ends_at = new Date(
              Date.now() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
            ).toISOString();
            break;

          case 'subscription.cancelled':
            targetStatus = 'canceled';
            updateFields.canceled_at = nowIso;
            break;

          case 'subscription.paused':
            targetStatus = 'past_due';
            break;

          case 'payment.failed':
            // Individual charge failed; move to past_due if active
            if (storedSub.status === 'active') {
              targetStatus = 'past_due';
            }
            break;

          default:
            logger.info('RAZORPAY_BILLING_WEBHOOK_UNHANDLED_EVENT', { eventType, eventId });
            break;
        }

        updateFields.status = targetStatus;

        // Atomic update of subscription record
        await supabaseAdmin
          .from('subscriptions')
          .update(updateFields)
          .eq('id', storedSub.id);

        logger.security('BILLING_SUBSCRIPTION_STATE_TRANSITION', {
          status: 'SUCCESS',
          workspaceId,
          subscriptionId: storedSub.id,
          providerSubId,
          fromStatus: storedSub.status,
          toStatus: targetStatus,
          eventType,
        });

        // Dispatch notifications & emails asynchronously without blocking webhook acknowledgement
        try {
          const { data: ws } = await supabaseAdmin
            .from('workspaces')
            .select('name, owner_id')
            .eq('id', storedSub.workspace_id)
            .maybeSingle();

          if (ws?.owner_id) {
            const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(ws.owner_id);
            const ownerEmail = ownerUser?.user?.email;
            const ownerName = ownerUser?.user?.user_metadata?.full_name || 'Creator';
            const planConfig = BILLING_PLANS[storedSub.plan_key as keyof typeof BILLING_PLANS];
            const planDisplayName = planConfig?.name || storedSub.plan_key;
            const baseUrl = getAppBaseUrl();

            if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
              await NotificationHelper.billingSubscriptionActivated(planDisplayName, {
                workspaceId: storedSub.workspace_id,
                userId: ws.owner_id,
              });
              if (ownerEmail && eventType === 'subscription.activated') {
                await EmailService.sendBillingSubscriptionActivated(
                  ownerEmail,
                  {
                    userName: ownerName,
                    workspaceName: ws.name,
                    planName: planDisplayName,
                    interval: 'monthly',
                    dashboardUrl: `${baseUrl}/freelancer/settings`,
                  },
                  { workspaceId: storedSub.workspace_id, userId: ws.owner_id, subscriptionId: storedSub.id }
                );
              }
            } else if (eventType === 'payment.failed') {
              const reason = payload?.payment?.entity?.error_description || 'Card payment declined';
              await NotificationHelper.billingPaymentFailed(planDisplayName, reason, {
                workspaceId: storedSub.workspace_id,
                userId: ws.owner_id,
              });
              if (ownerEmail) {
                await EmailService.sendBillingPaymentFailed(
                  ownerEmail,
                  {
                    userName: ownerName,
                    workspaceName: ws.name,
                    planName: planDisplayName,
                    updateUrl: `${baseUrl}/freelancer/settings`,
                    reason,
                  },
                  { workspaceId: storedSub.workspace_id, userId: ws.owner_id, subscriptionId: storedSub.id }
                );
              }
            } else if (eventType === 'subscription.halted') {
              await NotificationHelper.billingGraceEndingSoon(DEFAULT_GRACE_PERIOD_DAYS, {
                workspaceId: storedSub.workspace_id,
                userId: ws.owner_id,
              });
              if (ownerEmail) {
                await EmailService.sendBillingGraceEndingSoon(
                  ownerEmail,
                  {
                    userName: ownerName,
                    workspaceName: ws.name,
                    daysRemaining: DEFAULT_GRACE_PERIOD_DAYS,
                    updateUrl: `${baseUrl}/freelancer/settings`,
                  },
                  { workspaceId: storedSub.workspace_id, userId: ws.owner_id, subscriptionId: storedSub.id }
                );
              }
            } else if (eventType === 'subscription.cancelled') {
              const effectiveDate = subscriptionEntity?.current_end
                ? new Date(subscriptionEntity.current_end * 1000).toLocaleDateString()
                : 'end of billing period';
              await NotificationHelper.billingSubscriptionCanceled(planDisplayName, effectiveDate, {
                workspaceId: storedSub.workspace_id,
                userId: ws.owner_id,
              });
              if (ownerEmail) {
                await EmailService.sendBillingSubscriptionCanceled(
                  ownerEmail,
                  {
                    userName: ownerName,
                    workspaceName: ws.name,
                    planName: planDisplayName,
                    effectiveDate,
                    resubscribeUrl: `${baseUrl}/freelancer/settings`,
                  },
                  { workspaceId: storedSub.workspace_id, userId: ws.owner_id, subscriptionId: storedSub.id }
                );
              }
            }
          }
        } catch (notifErr: any) {
          logger.warn('RAZORPAY_BILLING_NOTIFICATION_DISPATCH_FAILED', {
            error: notifErr?.message,
            workspaceId: storedSub.workspace_id,
          });
        }
      } else {
        logger.warn('RAZORPAY_BILLING_WEBHOOK_UNKNOWN_SUBSCRIPTION', { providerSubId, eventType });
      }
    }

    // 7. Record Processed Event in billing_events table
    if (supabaseAdmin && !isDemoModeActive()) {
      await supabaseAdmin.from('billing_events').insert({
        provider: 'razorpay',
        provider_event_id: eventId,
        type: eventType,
        workspace_id: workspaceId,
        payload_hash: payloadHash,
        processed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error('RAZORPAY_BILLING_WEBHOOK_PROCESSING_ERROR', { error: err?.message });
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
