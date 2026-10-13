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
    storageMb: number;
    invoicesPerMonth: number;
    aiCreditsPerMonth: number;
  };
  isGrace: boolean;
  isPastDue: boolean;
  isTrialing: boolean;
  isWriteAllowed: boolean;
}

/**
 * Request-scoped resolution of workspace subscription and active overrides.
 */
export const getWorkspaceEntitlements = cache(
  async (workspaceId: string): Promise<WorkspaceEntitlements> => {
    // 1. In demo mode or if workspaceId is missing, return generous Pro entitlements
    if (isDemoModeActive() || !workspaceId || workspaceId.startsWith('demo-')) {
      const demoPlan = BILLING_PLANS.pro;
      return {
        workspaceId,
        planKey: 'pro',
        planName: demoPlan.name,
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        limits: demoPlan.limits,
        usage: {
          activeClients: 1,
          activeProjects: 1,
          storageMb: 10,
          invoicesPerMonth: 1,
          aiCreditsPerMonth: 0,
        },
        isGrace: false,
        isPastDue: false,
        isTrialing: false,
        isWriteAllowed: true,
      };
    }

    // Default fallback to Free Starter
    let planKey: PlanKey = 'free';
    let status: SubscriptionStatus = 'active';
    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let overrides: Record<string, any> = {};

    // 2. Query subscription and overrides via supabaseAdmin
    if (supabaseAdmin) {
      try {
        // Query active or latest subscription
        const { data: subData } = await supabaseAdmin
          .from('subscriptions')
          .select('plan_key, status, current_period_end, cancel_at_period_end')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData) {
          planKey = (subData.plan_key as PlanKey) || 'free';
          status = (subData.status as SubscriptionStatus) || 'active';
          currentPeriodEnd = subData.current_period_end;
          cancelAtPeriodEnd = Boolean(subData.cancel_at_period_end);
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
    let activeClients = 0;
    let activeProjects = 0;
    let storageMb = 0;
    let invoicesPerMonth = 0;

    if (supabaseAdmin) {
      try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        const [clientsRes, projectsRes, invoicesRes, storageRes] = await Promise.all([
          supabaseAdmin
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .neq('status', 'pending_deletion'),
          supabaseAdmin
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .neq('status', 'archived'),
          supabaseAdmin
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .gte('created_at', startOfMonth),
          // Storage estimation: query usage_counters or fallback to documents size
          supabaseAdmin
            .from('usage_counters')
            .select('value')
            .eq('workspace_id', workspaceId)
            .eq('metric', 'storage_bytes')
            .maybeSingle(),
        ]);

        activeClients = clientsRes.count ?? 0;
        activeProjects = projectsRes.count ?? 0;
        invoicesPerMonth = invoicesRes.count ?? 0;
        if (storageRes.data?.value) {
          storageMb = Math.round(Number(storageRes.data.value) / (1024 * 1024));
        }
      } catch (countErr) {
        console.warn(`[getWorkspaceEntitlements] Usage count notice for workspace ${workspaceId}:`, countErr);
      }
    }

    const limits = resolveEffectiveLimits(planKey, overrides);
    const plan = getBillingPlan(planKey);

    return {
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
        storageMb,
        invoicesPerMonth,
        aiCreditsPerMonth: 0,
      },
      isGrace: status === 'grace',
      isPastDue: status === 'past_due',
      isTrialing: status === 'trialing',
      isWriteAllowed: isWriteAllowedInStatus(status),
    };
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
  const current = entitlements.usage[metric] ?? 0;
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
  const allowed = await can(workspaceId, feature);
  if (!allowed) {
    throw new PlanLimitError(
      `Feature '${feature}' is not included in your current workspace plan. Please upgrade to access.`,
      'FEATURE_NOT_IN_PLAN',
      { statusCode: 403 }
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
  const check = await checkLimit(workspaceId, metric, increment);
  if (!check.allowed) {
    throw new PlanLimitError(
      check.reason || `Plan limit reached for ${metric}.`,
      check.code || 'PLAN_LIMIT_REACHED',
      {
        statusCode: check.code === 'SUBSCRIPTION_PAST_DUE' ? 402 : 402,
        metric,
        limit: check.limit,
        current: check.current,
      }
    );
  }
}
