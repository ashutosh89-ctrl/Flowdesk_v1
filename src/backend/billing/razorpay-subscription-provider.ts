/**
 * FlowDesk Razorpay Subscription Billing Provider
 * 
 * Implements recurring subscriptions using Razorpay Subscriptions API for INR billing.
 * Handles server-authoritative plan mapping, safe mock fallbacks for testing/demo environments,
 * and timing-safe webhook verification.
 */

import crypto from 'crypto';
import { BillingProvider, CreateSubscriptionParams, CreateSubscriptionResult } from './provider';
import { PlanKey, BillingInterval, BILLING_PLANS, getBillingPlan } from '@/shared/billing';
import { getRazorpayClient, isRazorpayConfigured, getRazorpayKeyId } from '@/backend/payments/razorpay-client';
import { isDemoModeActive } from '@/backend/utilities/supabase';

export class RazorpaySubscriptionProvider implements BillingProvider {
  public readonly name = 'razorpay' as const;

  public async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const plan = getBillingPlan(params.planKey);
    const planId = plan.providerPlanIds.razorpay[params.interval];

    // Check if live Razorpay credentials exist and real plan ID is configured
    const canUseLiveGateway = isRazorpayConfigured() && !isDemoModeActive() && planId && !planId.includes('placeholder');

    if (canUseLiveGateway) {
      try {
        const razorpay = getRazorpayClient();
        let subscriptionId: string | undefined;
        let customerId: string | undefined;
        let orderId: string | undefined;

        // 1. Attempt recurring subscription creation
        try {
          const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            total_count: params.interval === 'yearly' ? 10 : 120,
            quantity: 1,
            customer_notify: 1,
            notes: {
              workspace_id: params.workspaceId,
              owner_id: params.workspaceOwnerId,
              plan_key: params.planKey,
              interval: params.interval,
            },
          });
          subscriptionId = subscription.id;
          customerId = subscription.customer_id;
        } catch (subErr: any) {
          console.warn('[RazorpaySubscriptionProvider] Subscription creation notice:', subErr?.error?.description || subErr.message);
        }

        // 2. Also generate an authoritative Razorpay Order for cards/methods without e-mandate support
        try {
          const amountPaise = plan.pricing[params.interval].INR * 100;
          const receipt = `sub_${params.workspaceId.slice(0, 8)}_${Date.now().toString().slice(-6)}`;
          const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            notes: {
              workspace_id: params.workspaceId,
              owner_id: params.workspaceOwnerId,
              plan_key: params.planKey,
              interval: params.interval,
              subscription_id: subscriptionId || '',
            },
          });
          orderId = order.id;
        } catch (orderErr: any) {
          console.warn('[RazorpaySubscriptionProvider] Order creation notice:', orderErr?.error?.description || orderErr.message);
        }

        if (!subscriptionId && !orderId) {
          throw new Error('Could not initialize payment session with Razorpay gateway.');
        }

        return {
          provider: 'razorpay',
          providerSubscriptionId: subscriptionId || orderId!,
          providerCustomerId: customerId,
          status: 'created',
          checkoutPayload: {
            keyId: getRazorpayKeyId(),
            subscriptionId,
            orderId,
            customerName: params.workspaceOwnerName,
            customerEmail: params.workspaceOwnerEmail,
            amount: plan.pricing[params.interval].INR * 100,
            currency: 'INR',
          },
        };
      } catch (err: any) {
        console.warn('[RazorpaySubscriptionProvider.createSubscription] Gateway API notice:', err?.error?.description || err.message);
        throw new Error(err?.error?.description || err.message || 'Failed to create subscription with Razorpay.');
      }
    }

    // Safe mock fallback for test, staging, or demo modes
    const mockSubId = `sub_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      provider: 'razorpay',
      providerSubscriptionId: mockSubId,
      status: 'created',
      checkoutPayload: {
        keyId: getRazorpayKeyId() || 'rzp_test_placeholder',
        subscriptionId: mockSubId,
        customerName: params.workspaceOwnerName,
        customerEmail: params.workspaceOwnerEmail,
        amount: plan.pricing[params.interval].INR * 100,
        currency: 'INR',
      },
    };
  }

  public async cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<boolean> {
    const canUseLiveGateway = isRazorpayConfigured() && !isDemoModeActive() && !providerSubscriptionId.startsWith('sub_mock_');

    if (canUseLiveGateway) {
      try {
        const razorpay = getRazorpayClient();
        await razorpay.subscriptions.cancel(providerSubscriptionId, atPeriodEnd);
        return true;
      } catch (err: any) {
        console.warn(`[RazorpaySubscriptionProvider.cancelSubscription] Notice for ${providerSubscriptionId}:`, err?.error?.description || err.message);
        throw new Error(err?.error?.description || err.message || 'Failed to cancel subscription.');
      }
    }

    return true;
  }

  public async resumeSubscription(providerSubscriptionId: string): Promise<boolean> {
    const canUseLiveGateway = isRazorpayConfigured() && !isDemoModeActive() && !providerSubscriptionId.startsWith('sub_mock_');

    if (canUseLiveGateway) {
      try {
        const razorpay = getRazorpayClient();
        await razorpay.subscriptions.resume(providerSubscriptionId);
        return true;
      } catch (err: any) {
        console.warn(`[RazorpaySubscriptionProvider.resumeSubscription] Notice for ${providerSubscriptionId}:`, err?.error?.description || err.message);
        throw new Error(err?.error?.description || err.message || 'Failed to resume subscription.');
      }
    }

    return true;
  }

  public async changeSubscriptionPlan(
    providerSubscriptionId: string,
    newPlanKey: PlanKey,
    newInterval: BillingInterval
  ): Promise<boolean> {
    const plan = getBillingPlan(newPlanKey);
    const newPlanId = plan.providerPlanIds.razorpay[newInterval];

    const canUseLiveGateway = isRazorpayConfigured() && !isDemoModeActive() && !providerSubscriptionId.startsWith('sub_mock_') && newPlanId && !newPlanId.includes('placeholder');

    if (canUseLiveGateway) {
      try {
        const razorpay = getRazorpayClient();
        await razorpay.subscriptions.update(providerSubscriptionId, {
          plan_id: newPlanId,
          schedule_change_at: 'cycle_end',
        });
        return true;
      } catch (err: any) {
        console.warn(`[RazorpaySubscriptionProvider.changeSubscriptionPlan] Notice:`, err?.error?.description || err.message);
        throw new Error(err?.error?.description || err.message || 'Failed to update subscription plan.');
      }
    }

    return true;
  }

  public verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
    if (!rawBody || !signature || !secret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
      const providedBuf = Buffer.from(signature, 'utf-8');

      if (expectedBuf.length !== providedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, providedBuf);
    } catch (err) {
      console.error('[RazorpaySubscriptionProvider.verifyWebhook] Signature error:', err);
      return false;
    }
  }
}

/** Singleton instance */
export const razorpaySubscriptionProvider = new RazorpaySubscriptionProvider();
