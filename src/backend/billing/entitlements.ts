/**
 * FlowDesk Entitlements & Subscription Authority
 * 
 * Enforces server-side subscription quotas, plan boundaries, and support overrides.
 * Uses request-level memoization to eliminate redundant database queries within a single request.
 */

import { cache } from 'react';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import {
  PlanKey,
  PlanLimits,
  BILLING_PLANS,
  getBillingPlan,
  SubscriptionStatus,
  EntitlementMetric,
  EntitlementFeature,
  PlanLimitError,
  PlanLimitErrorCode,
  resolveEffectiveLimits,
  resolveFeaturePermission,
  resolveMetricLimitCheck,
  isWriteAllowedInStatus,
} from '@/shared/billing';

export interface WorkspaceEntitlements {
  workspaceId: string;
  planKey: PlanKey;
  planName: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
  usage: {
    activeClients: number;
    activeProjects: number;
    invoicesPerMonth: number;
    aiCreditsPerMonth: number;
  };
  isGrace: boolean;
  isPastDue: boolean;
  isTrialing: boolean;
  isWriteAllowed: boolean;
  trialInfo?: {
    isTrialActive: boolean;
    isExpired: boolean;
    daysRemaining: number;
    trialStart: string | null;
    trialEnd: string | null;
    promotionType: string;
    announcementSeen: boolean;
  };
}

// In-memory cache for fast repeated quota checks across API routes (60s TTL)
const entitlementsMemoryCache = new Map<string, { data: WorkspaceEntitlements; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateWorkspaceEntitlements(workspaceId: string): void {
  for (const key of entitlementsMemoryCache.keys()) {
    if (key.startsWith(workspaceId)) {
      entitlementsMemoryCache.delete(key);
    }
  }
}

/**
 * Request-scoped resolution of workspace subscription and active overrides.
 */
export const getWorkspaceEntitlements = cache(
  async (workspaceId: string, callerEmail?: string | null): Promise<WorkspaceEntitlements> => {
    const cacheKey = `${workspaceId}_${callerEmail || ''}`;
    // 0. Check in-memory cache first
    const cached = entitlementsMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    let userEmail = callerEmail?.toLowerCase()?.trim() || '';
    let ownerUserId: string | null = null;

    // If callerEmail was not provided, look up the workspace owner's email
    if (supabaseAdmin && workspaceId && !workspaceId.startsWith('demo-')) {
      try {
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('owner_id')
          .eq('id', workspaceId)
          .maybeSingle();

        if (ws?.owner_id) {
          ownerUserId = ws.owner_id;
          if (!userEmail) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('id', ws.owner_id)
              .maybeSingle();
            if (profile?.email) {
              userEmail = profile.email.toLowerCase().trim();
            } else {
              const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(ws.owner_id);
              if (authUser?.user?.email) {
                userEmail = authUser.user.email.toLowerCase().trim();
              }
            }
          }
        }
      } catch (err) {
        // Safe fall-through
      }
    }

    // 1. In demo mode or if workspaceId is missing
    if (isDemoModeActive() || !workspaceId || workspaceId.startsWith('demo-')) {
      const activePlanKey: PlanKey = 'starter';
      const assignedPlan = getBillingPlan(activePlanKey);
      return {
        workspaceId,
        planKey: activePlanKey,
        planName: assignedPlan.name,
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        limits: assignedPlan.limits,
        usage: {
          activeClients: 0,
          activeProjects: 0,
          invoicesPerMonth: 0,
          aiCreditsPerMonth: 0,
        },
        isGrace: false,
        isPastDue: false,
        isTrialing: false,
        isWriteAllowed: true,
      };
    }

    // Default fallback to Free Starter
    let planKey: PlanKey = 'starter';
    let status: SubscriptionStatus = 'active';
    let currentPeriodStart: string | null = null;
    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let overrides: Record<string, any> = {};
    let trialInfo: WorkspaceEntitlements['trialInfo'] = undefined;

    // 2. Query subscription, trial promotion, and overrides via supabaseAdmin
    if (supabaseAdmin) {
      try {
        // Evaluate 30-day Standard launch promotion
        const { LaunchPromotionService } = await import('./launch-promotion-service');
        const promo = await LaunchPromotionService.ensureLaunchPromotion(workspaceId, ownerUserId);
        if (promo) {
          trialInfo = {
            isTrialActive: promo.isTrialActive,
            isExpired: promo.isExpired,
            daysRemaining: promo.daysRemaining,
            trialStart: promo.trialStart,
            trialEnd: promo.trialEnd,
            promotionType: promo.promotionType,
            announcementSeen: promo.announcementSeen,
          };
          planKey = promo.planKey;
          status = promo.status;
          if (promo.trialEnd) {
            currentPeriodEnd = promo.trialEnd;
          }
        }

        // Query active or latest subscription
        const { data: subData } = await supabaseAdmin
          .from('subscriptions')
          .select('plan_key, status, current_period_start, current_period_end, cancel_at_period_end')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData) {
          if (subData.status === 'active' && !promo?.isTrialActive && (subData.plan_key === 'standard' || subData.plan_key === 'studio')) {
            planKey = (subData.plan_key as PlanKey) || 'starter';
            status = 'active';
            currentPeriodStart = subData.current_period_start;
            currentPeriodEnd = subData.current_period_end;
            cancelAtPeriodEnd = Boolean(subData.cancel_at_period_end);
          } else if (promo?.isTrialActive) {
            planKey = 'standard';
            status = 'trialing';
            currentPeriodEnd = promo.trialEnd;
          } else if (promo?.isExpired || subData.status === 'expired' || subData.status === 'canceled') {
            planKey = 'starter';
            status = 'expired';
          }
        }

        // Query active entitlement overrides
        const { data: overrideRows } = await supabaseAdmin
          .from('entitlement_overrides')
          .select('feature, value, expires_at')
          .eq('workspace_id', workspaceId);

        if (overrideRows && overrideRows.length > 0) {
          const now = Date.now();
          for (const row of overrideRows) {
            if (!row.expires_at || new Date(row.expires_at).getTime() > now) {
              overrides[row.feature] = row.value;
            }
          }
        }
      } catch (err) {
        console.warn(`[getWorkspaceEntitlements] DB lookup notice for workspace ${workspaceId}:`, err);
      }
    }

    // 3. Compute live usage metrics for the workspace
    // Active records: Exclude archived and deleted records
    let activeClients = 0;
    let activeProjects = 0;
    let invoicesPerMonth = 0;

    if (supabaseAdmin) {
      try {
        const now = Date.now();
        const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
        let billingCycleStart = startOfMonth;
        if (currentPeriodStart && planKey !== 'starter' && planKey !== 'free') {
          const periodStartTime = new Date(currentPeriodStart).getTime();
          // Use current subscription period start only if it falls within the last 32 days
          if (periodStartTime <= now && (now - periodStartTime) < 32 * 24 * 60 * 60 * 1000) {
            billingCycleStart = currentPeriodStart;
          }
        }

        const [clientsRes, projectsRes, invoicesRes] = await Promise.all([
          supabaseAdmin
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .not('status', 'in', '("archived","pending_deletion")')
            .is('deleted_at', null),
          supabaseAdmin
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .not('status', 'in', '("archived","completed_archived")'),
          supabaseAdmin
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .gte('created_at', billingCycleStart)
            .neq('status', 'cancelled'),
        ]);

        activeClients = clientsRes.count ?? 0;
        activeProjects = projectsRes.count ?? 0;
        invoicesPerMonth = invoicesRes.count ?? 0;
      } catch (countErr) {
        console.warn(`[getWorkspaceEntitlements] Usage count notice for workspace ${workspaceId}:`, countErr);
      }
    }

    const limits = resolveEffectiveLimits(planKey, overrides);
    const plan = getBillingPlan(planKey);

    const result: WorkspaceEntitlements = {
      workspaceId,
      planKey,
      planName: plan.name,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      limits,
      usage: {
        activeClients,
        activeProjects,
        invoicesPerMonth,
        aiCreditsPerMonth: 0,
      },
      isGrace: status === 'grace',
      isPastDue: status === 'past_due',
      isTrialing: status === 'trialing',
      isWriteAllowed: isWriteAllowedInStatus(status),
      trialInfo,
    };

    entitlementsMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }
);

/**
 * Checks whether a boolean feature is enabled for the workspace.
 */
export async function can(workspaceId: string, feature: EntitlementFeature): Promise<boolean> {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  return resolveFeaturePermission(feature, entitlements.planKey, entitlements.status);
}

/**
 * Checks whether an increment would violate quota limits for a metric.
 */
export async function checkLimit(
  workspaceId: string,
  metric: EntitlementMetric,
  increment: number = 1
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  reason?: string;
  code?: PlanLimitErrorCode;
}> {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  const usageRecord = entitlements.usage as Record<string, number | undefined>;
  const current = usageRecord[metric] ?? 0;
  return resolveMetricLimitCheck(
    metric,
    current,
    increment,
    entitlements.planKey,
    entitlements.status
  );
}

/**
 * Asserts that a feature is permitted. Throws PlanLimitError if denied.
 */
export async function assertCan(workspaceId: string, feature: EntitlementFeature): Promise<void> {
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  const allowed = await can(workspaceId, feature);
  if (!allowed) {
    const recommendedPlan: PlanKey | null =
      entitlements.planKey === 'starter' ? 'standard' :
      entitlements.planKey === 'standard' ? 'studio' : null;

    throw new PlanLimitError(
      `Feature '${feature}' is not included in your current workspace plan. Please upgrade your subscription to access this feature.`,
      'FEATURE_NOT_IN_PLAN',
      {
        statusCode: 403,
        currentPlan: entitlements.planKey,
        recommendedPlan,
      }
    );
  }
}

/**
 * Asserts that an increment is within plan limits. Throws PlanLimitError if exceeded.
 */
export async function assertWithinLimit(
  workspaceId: string,
  metric: EntitlementMetric,
  increment: number = 1
): Promise<void> {
  // Clear cached entitlements for mutation calls so real-time counts are authoritative
  invalidateWorkspaceEntitlements(workspaceId);
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  const check = await checkLimit(workspaceId, metric, increment);
  if (!check.allowed) {
    const recommendedPlan: PlanKey | null =
      entitlements.planKey === 'starter' ? 'standard' :
      entitlements.planKey === 'standard' ? 'studio' : null;

    throw new PlanLimitError(
      check.reason || `Plan limit reached for ${metric}.`,
      check.code || 'PLAN_LIMIT_REACHED',
      {
        statusCode: check.code === 'SUBSCRIPTION_PAST_DUE' ? 402 : 403,
        metric,
        limit: check.limit,
        current: check.current,
        currentPlan: entitlements.planKey,
        recommendedPlan,
      }
    );
  }
}
