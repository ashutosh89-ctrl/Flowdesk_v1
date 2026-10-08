/**
 * FlowDesk Pure Billing & Entitlements Rules
 * 
 * Pure functions with ZERO I/O and zero external dependencies.
 * Easily unit-tested with exhaustive matrices.
 */

import { BILLING_PLANS, PlanKey, PlanLimits, getBillingPlan } from './plans.config';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace'
  | 'canceled_at_period_end'
  | 'canceled'
  | 'expired';

export type EntitlementMetric =
  | 'activeClients'
  | 'activeProjects'
  | 'storageMb'
  | 'invoicesPerMonth'
  | 'aiCreditsPerMonth';

export type EntitlementFeature =
  | 'brandedPortal'
  | 'emailReminders';

export type PlanLimitErrorCode =
  | 'PLAN_LIMIT_REACHED'
  | 'FEATURE_NOT_IN_PLAN'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'WORKSPACE_WRITE_LOCKED';

export class PlanLimitError extends Error {
  public readonly code: PlanLimitErrorCode;
  public readonly statusCode: number;
  public readonly metric?: string;
  public readonly limit?: number;
  public readonly current?: number;

  constructor(
    message: string,
    code: PlanLimitErrorCode = 'PLAN_LIMIT_REACHED',
    options?: { statusCode?: number; metric?: string; limit?: number; current?: number }
  ) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    this.statusCode = options?.statusCode ?? (code === 'FEATURE_NOT_IN_PLAN' ? 403 : 402);
    this.metric = options?.metric;
    this.limit = options?.limit;
    this.current = options?.current;
    Object.setPrototypeOf(this, PlanLimitError.prototype);
  }
}

/**
 * Checks whether state allows creating new workspace records.
 * During 'grace' and 'expired', entity creation is hard write-locked.
 */
export function isWriteAllowedInStatus(status: SubscriptionStatus): boolean {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'canceled_at_period_end':
    case 'past_due':
      return true;
    case 'grace':
    case 'canceled':
    case 'expired':
      return false;
    default:
      return true;
  }
}

/**
 * Validates whether a state machine transition is legally permitted.
 */
export function canTransitionSubscription(
  current: SubscriptionStatus,
  target: SubscriptionStatus
): boolean {
  if (current === target) return true;

  const validTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    trialing: ['active', 'expired', 'canceled'],
    active: ['canceled_at_period_end', 'past_due', 'canceled'],
    canceled_at_period_end: ['active', 'canceled', 'expired'],
    past_due: ['active', 'grace', 'canceled'],
    grace: ['active', 'expired', 'canceled'],
    canceled: ['active', 'trialing'],
    expired: ['active', 'trialing'],
  };

  return validTransitions[current]?.includes(target) ?? false;
}

/**
 * Resolves effective plan limits incorporating any manual support overrides.
 * Resolution hierarchy: Overrides > Subscription Plan > Free Starter
 */
export function resolveEffectiveLimits(
  planKey: PlanKey,
  overrides?: Record<string, any>
): PlanLimits {
  const basePlan = getBillingPlan(planKey);
  const baseLimits = { ...basePlan.limits };

  if (!overrides) {
    return baseLimits;
  }

  // Apply explicit numeric overrides if present and not expired
  if (typeof overrides.activeClients === 'number') baseLimits.activeClients = overrides.activeClients;
  if (typeof overrides.activeProjects === 'number') baseLimits.activeProjects = overrides.activeProjects;
  if (typeof overrides.storageMb === 'number') baseLimits.storageMb = overrides.storageMb;
  if (typeof overrides.invoicesPerMonth === 'number') baseLimits.invoicesPerMonth = overrides.invoicesPerMonth;
  if (typeof overrides.brandedPortal === 'boolean') baseLimits.brandedPortal = overrides.brandedPortal;
  if (typeof overrides.emailReminders === 'boolean') baseLimits.emailReminders = overrides.emailReminders;
  if (typeof overrides.aiCreditsPerMonth === 'number') baseLimits.aiCreditsPerMonth = overrides.aiCreditsPerMonth;

  return baseLimits;
}

/**
 * Checks if a specific boolean feature is allowed for a given workspace state.
 */
export function resolveFeaturePermission(
  feature: EntitlementFeature,
  planKey: PlanKey,
  status: SubscriptionStatus,
  overrides?: Record<string, any>
): boolean {
  // Check override first
  if (overrides && typeof overrides[feature] === 'boolean') {
    return overrides[feature];
  }

  // If workspace is expired, fall back to Free plan capabilities
  const effectivePlanKey = (status === 'expired' || status === 'canceled') ? 'free' : planKey;
  const plan = getBillingPlan(effectivePlanKey);
  return Boolean(plan.limits[feature]);
}

/**
 * Checks whether an increment would violate quota limits for a given metric.
 */
export function resolveMetricLimitCheck(
  metric: EntitlementMetric,
  current: number,
  increment: number = 1,
  planKey: PlanKey,
  status: SubscriptionStatus,
  overrides?: Record<string, any>
): {
  allowed: boolean;
  current: number;
  limit: number;
  reason?: string;
  code?: PlanLimitErrorCode;
} {
  // 1. If workspace is in grace or expired, structural creation is write-locked
  if (status === 'grace') {
    return {
      allowed: false,
      current,
      limit: 0,
      reason: 'Workspace is in grace period due to failed payment retries. Please update payment to resume writes.',
      code: 'SUBSCRIPTION_PAST_DUE',
    };
  }

  // If expired or canceled, evaluate against Free tier limits
  const effectivePlanKey = (status === 'expired' || status === 'canceled') ? 'free' : planKey;
  const effectiveLimits = resolveEffectiveLimits(effectivePlanKey, overrides);
  const limit = effectiveLimits[metric];

  // 2. Evaluate quota
  if (current + increment > limit) {
    return {
      allowed: false,
      current,
      limit,
      reason: `Plan limit reached for ${metric}. Current: ${current}, Limit: ${limit}.`,
      code: 'PLAN_LIMIT_REACHED',
    };
  }

  return {
    allowed: true,
    current,
    limit,
  };
}
