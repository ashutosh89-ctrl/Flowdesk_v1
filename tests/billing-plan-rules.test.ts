import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBillingPlan,
  BILLING_PLANS,
  PlanLimitError,
  isWriteAllowedInStatus,
  canTransitionSubscription,
  resolveEffectiveLimits,
  resolveFeaturePermission,
  resolveMetricLimitCheck,
} from '../src/shared/billing';

test('Billing Plan Rules: Plan Resolution & Fallbacks', async (suite) => {
  await suite.test('resolves free starter plan with correct defaults', () => {
    const plan = getBillingPlan('free');
    assert.equal(plan.key, 'free');
    assert.equal(plan.limits.activeClients, BILLING_PLANS.free.limits.activeClients);
    assert.equal(plan.limits.activeProjects, BILLING_PLANS.free.limits.activeProjects);
    assert.equal(plan.limits.storageMb, BILLING_PLANS.free.limits.storageMb);
    assert.equal(plan.limits.brandedPortal, false);
    assert.equal(plan.limits.emailReminders, false);
    assert.equal(plan.pricing.monthly.INR, 0);
  });

  await suite.test('resolves pro tier with expanded limits and features', () => {
    const plan = getBillingPlan('pro');
    assert.equal(plan.key, 'pro');
    assert.equal(plan.limits.activeClients, BILLING_PLANS.pro.limits.activeClients);
    assert.equal(plan.limits.activeProjects, BILLING_PLANS.pro.limits.activeProjects);
    assert.equal(plan.limits.brandedPortal, true);
    assert.equal(plan.limits.emailReminders, true);
    assert.ok(plan.pricing.monthly.INR > 0);
  });

  await suite.test('resolves studio tier with higher capacity', () => {
    const plan = getBillingPlan('studio');
    assert.equal(plan.key, 'studio');
    assert.equal(plan.limits.activeClients, BILLING_PLANS.studio.limits.activeClients);
    assert.equal(plan.limits.activeProjects, BILLING_PLANS.studio.limits.activeProjects);
    assert.equal(plan.limits.brandedPortal, true);
  });

  await suite.test('gracefully falls back to free plan for unknown plan keys', () => {
    const plan = getBillingPlan('enterprise_nonexistent' as any);
    assert.equal(plan.key, 'free');
    assert.equal(plan.name, 'Free Starter');
  });
});

test('Billing Plan Rules: Effective Limits & Support Overrides', async (suite) => {
  await suite.test('returns base limits when no overrides provided', () => {
    const limits = resolveEffectiveLimits('free');
    assert.equal(limits.activeClients, BILLING_PLANS.free.limits.activeClients);
    assert.equal(limits.storageMb, BILLING_PLANS.free.limits.storageMb);
    assert.equal(limits.brandedPortal, false);
  });

  await suite.test('applies specific numeric overrides while keeping other defaults', () => {
    const limits = resolveEffectiveLimits('free', { activeClients: 10, storageMb: 2000 });
    assert.equal(limits.activeClients, 10);
    assert.equal(limits.storageMb, 2000);
    assert.equal(limits.activeProjects, BILLING_PLANS.free.limits.activeProjects); // unchanged free limit
    assert.equal(limits.brandedPortal, false);
  });

  await suite.test('applies feature flag overrides correctly', () => {
    const limits = resolveEffectiveLimits('free', { brandedPortal: true });
    assert.equal(limits.brandedPortal, true);
    assert.equal(limits.emailReminders, false);
  });
});

test('Billing Plan Rules: Feature Entitlement Checks', async (suite) => {
  await suite.test('blocks branded portal on free tier', () => {
    const allowed = resolveFeaturePermission('brandedPortal', 'free', 'active');
    assert.equal(allowed, false);
  });

  await suite.test('allows branded portal on pro tier', () => {
    const allowed = resolveFeaturePermission('brandedPortal', 'pro', 'active');
    assert.equal(allowed, true);
  });

  await suite.test('honor override enabling feature on free tier', () => {
    const allowed = resolveFeaturePermission('brandedPortal', 'free', 'active', { brandedPortal: true });
    assert.equal(allowed, true);
  });

  await suite.test('reverts features to free tier when subscription has expired', () => {
    const allowed = resolveFeaturePermission('brandedPortal', 'pro', 'expired');
    assert.equal(allowed, false);
  });

  await suite.test('reverts features to free tier when subscription is canceled', () => {
    const allowed = resolveFeaturePermission('brandedPortal', 'pro', 'canceled');
    assert.equal(allowed, false);
  });
});

test('Billing Plan Rules: Quota Limits & Downgrade Grandfathering', async (suite) => {
  await suite.test('permits creation when strictly below quota', () => {
    // Free tier activeClients limit is 2. Current 1 + 1 = 2 <= 2 => allowed
    const res = resolveMetricLimitCheck('activeClients', 1, 1, 'free', 'active');
    assert.equal(res.allowed, true);
    assert.equal(res.limit, BILLING_PLANS.free.limits.activeClients);
  });

  await suite.test('blocks creation when at quota limit', () => {
    // Free tier activeClients limit is 2. Current 2 + 1 = 3 > 2 => blocked
    const res = resolveMetricLimitCheck('activeClients', 2, 1, 'free', 'active');
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'PLAN_LIMIT_REACHED');
    assert.match(res.reason || '', /Plan limit reached for activeClients/);
  });

  await suite.test('downgrade grandfathering: existing items retained, new creations blocked', () => {
    // User had Pro (created 10 clients), then subscription lapsed to Free (limit 2).
    // The user still has 10 clients. Reading/viewing is not blocked.
    // But attempting to add an 11th client is rejected.
    const res = resolveMetricLimitCheck('activeClients', 10, 1, 'free', 'active');
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'PLAN_LIMIT_REACHED');
    assert.equal(res.current, 10);
    assert.equal(res.limit, BILLING_PLANS.free.limits.activeClients);
  });

  await suite.test('high capacity studio plan allows creation within its limit', () => {
    const res = resolveMetricLimitCheck('activeProjects', 50, 1, 'studio', 'active');
    assert.equal(res.allowed, true);
  });
});

test('Billing Plan Rules: Status-Based Write Locking', async (suite) => {
  await suite.test('allows writes in healthy and warning states', () => {
    assert.equal(isWriteAllowedInStatus('trialing'), true);
    assert.equal(isWriteAllowedInStatus('active'), true);
    assert.equal(isWriteAllowedInStatus('canceled_at_period_end'), true);
    assert.equal(isWriteAllowedInStatus('past_due'), true);
  });

  await suite.test('hard write-locks during grace, canceled, and expired states', () => {
    assert.equal(isWriteAllowedInStatus('grace'), false);
    assert.equal(isWriteAllowedInStatus('canceled'), false);
    assert.equal(isWriteAllowedInStatus('expired'), false);
  });

  await suite.test('blocks quota check with SUBSCRIPTION_PAST_DUE during grace period', () => {
    const res = resolveMetricLimitCheck('activeProjects', 1, 1, 'pro', 'grace');
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'SUBSCRIPTION_PAST_DUE');
    assert.match(res.reason || '', /grace period/i);
  });
});

test('Billing Plan Rules: State Machine Transitions', async (suite) => {
  await suite.test('allows self-transition idempotently', () => {
    assert.equal(canTransitionSubscription('active', 'active'), true);
    assert.equal(canTransitionSubscription('trialing', 'trialing'), true);
  });

  await suite.test('allows valid lifecycle progressions', () => {
    assert.equal(canTransitionSubscription('trialing', 'active'), true);
    assert.equal(canTransitionSubscription('active', 'past_due'), true);
    assert.equal(canTransitionSubscription('past_due', 'grace'), true);
    assert.equal(canTransitionSubscription('grace', 'expired'), true);
    assert.equal(canTransitionSubscription('grace', 'active'), true); // Payment recovered
    assert.equal(canTransitionSubscription('active', 'canceled_at_period_end'), true);
    assert.equal(canTransitionSubscription('canceled_at_period_end', 'active'), true); // Resumed
    assert.equal(canTransitionSubscription('canceled_at_period_end', 'canceled'), true);
  });

  await suite.test('rejects illegal state jumps', () => {
    // Cannot jump from trialing directly to grace without entering past_due
    assert.equal(canTransitionSubscription('trialing', 'grace'), false);
    // Cannot transition from expired directly to past_due
    assert.equal(canTransitionSubscription('expired', 'past_due'), false);
    // Cannot jump from canceled to grace
    assert.equal(canTransitionSubscription('canceled', 'grace'), false);
  });
});

test('Billing Plan Rules: PlanLimitError Class', async (suite) => {
  await suite.test('instantiates with default status codes and attributes', () => {
    const err = new PlanLimitError('Limit exceeded', 'PLAN_LIMIT_REACHED', {
      metric: 'activeClients',
      limit: 2,
      current: 2,
    });
    assert.equal(err.name, 'PlanLimitError');
    assert.equal(err.code, 'PLAN_LIMIT_REACHED');
    assert.equal(err.statusCode, 402);
    assert.equal(err.metric, 'activeClients');
    assert.equal(err.limit, 2);
    assert.equal(err.current, 2);
  });

  await suite.test('assigns 403 status code for FEATURE_NOT_IN_PLAN', () => {
    const err = new PlanLimitError('Branded portal requires Pro', 'FEATURE_NOT_IN_PLAN');
    assert.equal(err.statusCode, 403);
  });
});
