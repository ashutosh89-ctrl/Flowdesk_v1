/**
 * FlowDesk Billing Provider Interface
 * 
 * Defines the contract for recurring subscription payment gateways.
 * Decouples billing callers from Razorpay so alternative providers (e.g., Stripe)
 * can be added without altering application routes or business rules.
 */

import { PlanKey, BillingInterval } from '@/shared/billing';

export interface CreateSubscriptionParams {
  workspaceId: string;
  workspaceOwnerId: string;
  workspaceOwnerEmail: string;
  workspaceOwnerName: string;
  planKey: PlanKey;
  interval: BillingInterval;
  returnUrl?: string;
}

export interface CreateSubscriptionResult {
  provider: 'razorpay' | 'stripe';
  providerSubscriptionId: string;
  providerCustomerId?: string;
  status: string;
  checkoutPayload: {
    keyId: string;
    subscriptionId: string;
    customerName: string;
    customerEmail: string;
    amount?: number;
    currency: string;
  };
}

export interface BillingProvider {
  readonly name: 'razorpay' | 'stripe';

  /**
   * Creates a recurring subscription server-side with the provider.
   */
  createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult>;

  /**
   * Cancels an active subscription (either immediately or at current period end).
   */
  cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<boolean>;

  /**
   * Resumes a subscription scheduled for cancellation at period end.
   */
  resumeSubscription(providerSubscriptionId: string): Promise<boolean>;

  /**
   * Upgrades or downgrades a subscription to a different plan/interval.
   */
  changeSubscriptionPlan(
    providerSubscriptionId: string,
    newPlanKey: PlanKey,
    newInterval: BillingInterval
  ): Promise<boolean>;

  /**
   * Verifies incoming webhook HMAC signature.
   */
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean;
}
