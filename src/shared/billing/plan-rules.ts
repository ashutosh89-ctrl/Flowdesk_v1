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
  | 'invoicesPerMonth'
  | 'maxVersionsPerDeliverable'
  | 'aiCreditsPerMonth';

export type EntitlementFeature =
  | 'customBranding'
  | 'brandedPortal'
  | 'automatedReminders'
  | 'emailReminders'
  | 'multiCurrency'
  | 'paymentReceipts'
  | 'customSubpaths'
  | 'multiStageDunning'
  | 'highThroughputVersioning'
  | 'dedicatedSupport'
  | 'auditLogExports'
  | 'autoNumbering';

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
  public readonly currentPlan?: PlanKey;
  public readonly recommendedPlan?: PlanKey | null;

  constructor(
    message: string,
    code: PlanLimitErrorCode = 'PLAN_LIMIT_REACHED',
    options?: {
      statusCode?: number;
      metric?: string;
      limit?: number;
      current?: number;
      currentPlan?: PlanKey;
      recommendedPlan?: PlanKey | null;
    }
  ) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    this.statusCode = options?.statusCode ?? (code === 'FEATURE_NOT_IN_PLAN' ? 403 : 403);
    this.metric = options?.metric;
    this.limit = options?.limit;
    this.current = options?.current;
    this.currentPlan = options?.currentPlan;
    this.recommendedPlan = options?.recommendedPlan;
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
  if (typeof overrides.invoicesPerMonth === 'number') baseLimits.invoicesPerMonth = overrides.invoicesPerMonth;
  if (typeof overrides.maxVersionsPerDeliverable === 'number') baseLimits.maxVersionsPerDeliverable = overrides.maxVersionsPerDeliverable;
  if (typeof overrides.aiCreditsPerMonth === 'number') baseLimits.aiCreditsPerMonth = overrides.aiCreditsPerMonth;

  // Apply boolean feature overrides
  if (typeof overrides.customBranding === 'boolean') {
    baseLimits.customBranding = overrides.customBranding;
    baseLimits.brandedPortal = overrides.customBranding;
  }
  if (typeof overrides.brandedPortal === 'boolean') {
    baseLimits.brandedPortal = overrides.brandedPortal;
    baseLimits.customBranding = overrides.brandedPortal;
  }
  if (typeof overrides.automatedReminders === 'boolean') {
    baseLimits.automatedReminders = overrides.automatedReminders;
    baseLimits.emailReminders = overrides.automatedReminders;
  }
  if (typeof overrides.emailReminders === 'boolean') {
    baseLimits.emailReminders = overrides.emailReminders;
    baseLimits.automatedReminders = overrides.emailReminders;
  }
  if (typeof overrides.multiCurrency === 'boolean') baseLimits.multiCurrency = overrides.multiCurrency;
  if (typeof overrides.paymentReceipts === 'boolean') baseLimits.paymentReceipts = overrides.paymentReceipts;
  if (typeof overrides.customSubpaths === 'boolean') baseLimits.customSubpaths = overrides.customSubpaths;
  if (typeof overrides.multiStageDunning === 'boolean') baseLimits.multiStageDunning = overrides.multiStageDunning;
  if (typeof overrides.highThroughputVersioning === 'boolean') baseLimits.highThroughputVersioning = overrides.highThroughputVersioning;
  if (typeof overrides.dedicatedSupport === 'boolean') baseLimits.dedicatedSupport = overrides.dedicatedSupport;
  if (typeof overrides.auditLogExports === 'boolean') baseLimits.auditLogExports = overrides.auditLogExports;
  if (typeof overrides.autoNumbering === 'boolean') baseLimits.autoNumbering = overrides.autoNumbering;

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
  // Check override first (supporting feature aliases)
  if (overrides) {
    if (typeof overrides[feature] === 'boolean') {
      return overrides[feature];
    }
    if (feature === 'customBranding' && typeof overrides.brandedPortal === 'boolean') {
      return overrides.brandedPortal;
    }
    if (feature === 'brandedPortal' && typeof overrides.customBranding === 'boolean') {
      return overrides.customBranding;
    }
    if (feature === 'automatedReminders' && typeof overrides.emailReminders === 'boolean') {
      return overrides.emailReminders;
    }
    if (feature === 'emailReminders' && typeof overrides.automatedReminders === 'boolean') {
      return overrides.automatedReminders;
    }
  }

  // If workspace is expired, fall back to Starter/Free plan capabilities
  const effectivePlanKey = (status === 'expired' || status === 'canceled') ? 'starter' : planKey;
  const plan = getBillingPlan(effectivePlanKey);

  // Normalize aliases
  if (feature === 'brandedPortal' || feature === 'customBranding') {
    return Boolean(plan.limits.customBranding || plan.limits.brandedPortal);
  }
  if (feature === 'emailReminders' || feature === 'automatedReminders') {
    return Boolean(plan.limits.automatedReminders || plan.limits.emailReminders);
  }

  return Boolean(plan.limits[feature as keyof PlanLimits]);
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

  // If expired or canceled, evaluate against Starter/Free tier limits
  const effectivePlanKey = (status === 'expired' || status === 'canceled') ? 'starter' : planKey;
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
