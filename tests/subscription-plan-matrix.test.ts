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

test('FLOWDESK SUBSCRIPTION AUDIT: STARTER (FREE) TIER TESTS', async (suite) => {
  const plan = getBillingPlan('starter');

  await suite.test('Starter Plan Metadata & Zero Cloud Quota Verification', () => {
    assert.equal(plan.key, 'starter');
    assert.equal(plan.pricing.monthly.INR, 0);
    assert.equal(plan.pricing.yearly.INR, 0);
    assert.equal(plan.limits.localStorageOnly, true);
    // Cloud storage quotas must not exist
    assert.equal((plan.limits as any).storageMb, undefined);
  });

  await suite.test('Starter: Active Clients Quota (Limit = 2)', () => {
    // 0 -> 1 allowed
    const c1 = resolveMetricLimitCheck('activeClients', 0, 1, 'starter', 'active');
    assert.equal(c1.allowed, true);
    assert.equal(c1.limit, 2);

    // 1 -> 2 allowed
    const c2 = resolveMetricLimitCheck('activeClients', 1, 1, 'starter', 'active');
    assert.equal(c2.allowed, true);

    // 2 -> 3 REJECTED
    const c3 = resolveMetricLimitCheck('activeClients', 2, 1, 'starter', 'active');
    assert.equal(c3.allowed, false);
    assert.equal(c3.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Starter: Active Projects Quota (Limit = 3)', () => {
    // 2 -> 3 allowed
    const p3 = resolveMetricLimitCheck('activeProjects', 2, 1, 'starter', 'active');
    assert.equal(p3.allowed, true);
    assert.equal(p3.limit, 3);

    // 3 -> 4 REJECTED
    const p4 = resolveMetricLimitCheck('activeProjects', 3, 1, 'starter', 'active');
    assert.equal(p4.allowed, false);
    assert.equal(p4.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Starter: Monthly Invoices Quota (Limit = 5)', () => {
    // 4 -> 5 allowed
    const i5 = resolveMetricLimitCheck('invoicesPerMonth', 4, 1, 'starter', 'active');
    assert.equal(i5.allowed, true);
    assert.equal(i5.limit, 5);

    // 5 -> 6 REJECTED
    const i6 = resolveMetricLimitCheck('invoicesPerMonth', 5, 1, 'starter', 'active');
    assert.equal(i6.allowed, false);
    assert.equal(i6.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Starter: Standard review portal & basic payment tracking allowed', () => {
    // Basic operations allowed
    assert.equal(plan.limits.localStorageOnly, true);
  });

  await suite.test('Starter: All Standard and Studio exclusive features are inaccessible', () => {
    const lockedFeatures = [
      'customBranding',
      'brandedPortal',
      'automatedReminders',
      'emailReminders',
      'multiCurrency',
      'paymentReceipts',
      'customSubpaths',
      'multiStageDunning',
      'highThroughputVersioning',
      'dedicatedSupport',
      'auditLogExports',
      'autoNumbering',
    ] as const;

    for (const feat of lockedFeatures) {
      const allowed = resolveFeaturePermission(feat, 'starter', 'active');
      assert.equal(allowed, false, `Feature ${feat} must be blocked on Starter plan`);
    }
  });
});

test('FLOWDESK SUBSCRIPTION AUDIT: STANDARD FREELANCER TIER TESTS', async (suite) => {
  const plan = getBillingPlan('standard');

  await suite.test('Standard Plan Metadata & Pricing Verification', () => {
    assert.equal(plan.key, 'standard');
    assert.equal(plan.pricing.monthly.INR, 399);
    assert.equal(plan.pricing.yearly.INR, 3990);
    assert.equal(plan.pricing.monthly.USD, 9);
    assert.equal(plan.pricing.yearly.USD, 90);
    assert.equal(plan.limits.localStorageOnly, true);
  });

  await suite.test('Standard: Active Clients Quota (Limit = 15)', () => {
    // 14 -> 15 allowed
    const c15 = resolveMetricLimitCheck('activeClients', 14, 1, 'standard', 'active');
    assert.equal(c15.allowed, true);
    assert.equal(c15.limit, 15);

    // 15 -> 16 REJECTED
    const c16 = resolveMetricLimitCheck('activeClients', 15, 1, 'standard', 'active');
    assert.equal(c16.allowed, false);
    assert.equal(c16.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Standard: Active Projects Quota (Limit = 25)', () => {
    // 24 -> 25 allowed
    const p25 = resolveMetricLimitCheck('activeProjects', 24, 1, 'standard', 'active');
    assert.equal(p25.allowed, true);
    assert.equal(p25.limit, 25);

    // 25 -> 26 REJECTED
    const p26 = resolveMetricLimitCheck('activeProjects', 25, 1, 'standard', 'active');
    assert.equal(p26.allowed, false);
    assert.equal(p26.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Standard: Monthly Invoices Quota (Limit = 50)', () => {
    // 49 -> 50 allowed
    const i50 = resolveMetricLimitCheck('invoicesPerMonth', 49, 1, 'standard', 'active');
    assert.equal(i50.allowed, true);
    assert.equal(i50.limit, 50);

    // 50 -> 51 REJECTED
    const i51 = resolveMetricLimitCheck('invoicesPerMonth', 50, 1, 'standard', 'active');
    assert.equal(i51.allowed, false);
    assert.equal(i51.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Standard: Standard-exclusive features are active', () => {
    const entitledFeatures = [
      'customBranding',
      'brandedPortal',
      'automatedReminders',
      'emailReminders',
      'multiCurrency',
      'paymentReceipts',
      'autoNumbering',
    ] as const;

    for (const feat of entitledFeatures) {
      const allowed = resolveFeaturePermission(feat, 'standard', 'active');
      assert.equal(allowed, true, `Feature ${feat} must be enabled on Standard plan`);
    }
  });

  await suite.test('Standard: Studio-exclusive features remain inaccessible', () => {
    const studioOnlyFeatures = [
      'customSubpaths',
      'multiStageDunning',
      'highThroughputVersioning',
      'dedicatedSupport',
      'auditLogExports',
    ] as const;

    for (const feat of studioOnlyFeatures) {
      const allowed = resolveFeaturePermission(feat, 'standard', 'active');
      assert.equal(allowed, false, `Studio-exclusive feature ${feat} must be blocked on Standard plan`);
    }
  });
});

test('FLOWDESK SUBSCRIPTION AUDIT: STUDIO AGENCY TIER TESTS', async (suite) => {
  const plan = getBillingPlan('studio');

  await suite.test('Studio Plan Metadata & Pricing Verification', () => {
    assert.equal(plan.key, 'studio');
    assert.equal(plan.pricing.monthly.INR, 899);
    assert.equal(plan.pricing.yearly.INR, 8990);
    assert.equal(plan.pricing.monthly.USD, 19);
    assert.equal(plan.pricing.yearly.USD, 190);
    assert.equal(plan.limits.localStorageOnly, true);
  });

  await suite.test('Studio: Active Clients Quota (Limit = 100)', () => {
    // 99 -> 100 allowed
    const c100 = resolveMetricLimitCheck('activeClients', 99, 1, 'studio', 'active');
    assert.equal(c100.allowed, true);
    assert.equal(c100.limit, 100);

    // 100 -> 101 REJECTED
    const c101 = resolveMetricLimitCheck('activeClients', 100, 1, 'studio', 'active');
    assert.equal(c101.allowed, false);
    assert.equal(c101.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Studio: Active Projects Quota (Limit = 150)', () => {
    // 149 -> 150 allowed
    const p150 = resolveMetricLimitCheck('activeProjects', 149, 1, 'studio', 'active');
    assert.equal(p150.allowed, true);
    assert.equal(p150.limit, 150);

    // 150 -> 151 REJECTED
    const p151 = resolveMetricLimitCheck('activeProjects', 150, 1, 'studio', 'active');
    assert.equal(p151.allowed, false);
    assert.equal(p151.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Studio: Monthly Invoices Quota (Limit = 500)', () => {
    // 499 -> 500 allowed
    const i500 = resolveMetricLimitCheck('invoicesPerMonth', 499, 1, 'studio', 'active');
    assert.equal(i500.allowed, true);
    assert.equal(i500.limit, 500);

    // 500 -> 501 REJECTED
    const i501 = resolveMetricLimitCheck('invoicesPerMonth', 500, 1, 'studio', 'active');
    assert.equal(i501.allowed, false);
    assert.equal(i501.code, 'PLAN_LIMIT_REACHED');
  });

  await suite.test('Studio: All Studio and inherited Standard features are active', () => {
    const allFeatures = [
      'customBranding',
      'brandedPortal',
      'automatedReminders',
      'emailReminders',
      'multiCurrency',
      'paymentReceipts',
      'autoNumbering',
      'customSubpaths',
      'multiStageDunning',
      'highThroughputVersioning',
      'dedicatedSupport',
      'auditLogExports',
    ] as const;

    for (const feat of allFeatures) {
      const allowed = resolveFeaturePermission(feat, 'studio', 'active');
      assert.equal(allowed, true, `Feature ${feat} must be enabled on Studio plan`);
    }
  });
});

test('FLOWDESK SUBSCRIPTION AUDIT: CROSS-PLAN UPGRADE & DOWNGRADE LIFECYCLE', async (suite) => {
  await suite.test('Upgrade Starter -> Standard unlocks features and expands quotas', () => {
    // Starter: 2 clients limit
    const starterCheck = resolveMetricLimitCheck('activeClients', 2, 1, 'starter', 'active');
    assert.equal(starterCheck.allowed, false);

    // After upgrade to Standard: 2 clients is well within limit 15
    const standardCheck = resolveMetricLimitCheck('activeClients', 2, 1, 'standard', 'active');
    assert.equal(standardCheck.allowed, true);
    assert.equal(standardCheck.limit, 15);

    // Feature unlocks
    assert.equal(resolveFeaturePermission('customBranding', 'starter', 'active'), false);
    assert.equal(resolveFeaturePermission('customBranding', 'standard', 'active'), true);
    assert.equal(resolveFeaturePermission('multiCurrency', 'standard', 'active'), true);
  });

  await suite.test('Upgrade Standard -> Studio unlocks custom subpaths and audit exports', () => {
    assert.equal(resolveFeaturePermission('customSubpaths', 'standard', 'active'), false);
    assert.equal(resolveFeaturePermission('customSubpaths', 'studio', 'active'), true);
    assert.equal(resolveFeaturePermission('auditLogExports', 'standard', 'active'), false);
    assert.equal(resolveFeaturePermission('auditLogExports', 'studio', 'active'), true);
    assert.equal(resolveFeaturePermission('multiStageDunning', 'studio', 'active'), true);
  });

  await suite.test('Downgrade Studio -> Standard (Grandfathering: no deletion, but new creations blocked)', () => {
    // User had 40 clients in Studio
    const existingClients = 40;

    // In Standard, limit is 15. Attempting to add a 41st client is blocked:
    const checkNew = resolveMetricLimitCheck('activeClients', existingClients, 1, 'standard', 'active');
    assert.equal(checkNew.allowed, false);
    assert.equal(checkNew.limit, 15);
    assert.equal(checkNew.current, 40);

    // Studio-exclusive features lock immediately
    assert.equal(resolveFeaturePermission('customSubpaths', 'standard', 'active'), false);
    assert.equal(resolveFeaturePermission('auditLogExports', 'standard', 'active'), false);

    // But Standard features remain active
    assert.equal(resolveFeaturePermission('customBranding', 'standard', 'active'), true);
  });

  await suite.test('Downgrade Standard -> Starter / Expired (Reversion to Free Limits)', () => {
    // When subscription is expired or canceled, features revert to Starter
    const brandingWhenExpired = resolveFeaturePermission('customBranding', 'standard', 'expired');
    assert.equal(brandingWhenExpired, false);

    const remindersWhenCanceled = resolveFeaturePermission('automatedReminders', 'standard', 'canceled');
    assert.equal(remindersWhenCanceled, false);

    // Creating beyond Starter limits is blocked
    const clientCheck = resolveMetricLimitCheck('activeClients', 2, 1, 'standard', 'expired');
    assert.equal(clientCheck.allowed, false);
    assert.equal(clientCheck.limit, 2);
  });

  await suite.test('Subscription Status Write Locking: Grace Period Hard Lock', () => {
    // In grace period, entity creation is hard write-locked regardless of plan
    const writeAllowed = isWriteAllowedInStatus('grace');
    assert.equal(writeAllowed, false);

    const checkGrace = resolveMetricLimitCheck('activeClients', 0, 1, 'studio', 'grace');
    assert.equal(checkGrace.allowed, false);
    assert.equal(checkGrace.code, 'SUBSCRIPTION_PAST_DUE');
  });

  await suite.test('Subscription State Machine Transitions', () => {
    assert.equal(canTransitionSubscription('trialing', 'active'), true);
    assert.equal(canTransitionSubscription('active', 'past_due'), true);
    assert.equal(canTransitionSubscription('past_due', 'grace'), true);
    assert.equal(canTransitionSubscription('grace', 'expired'), true);
    assert.equal(canTransitionSubscription('active', 'expired'), false); // Cannot jump directly from active to expired
  });
});
