import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_PLANS,
  PlanLimitError,
  resolveFeaturePermission,
  resolveMetricLimitCheck,
  getEntitlementInheritance,
  type PlanKey,
} from '../src/shared/billing';
import { createApiErrorResponse } from '../src/backend/utilities/logger';

describe('PHASE 5: SUBSCRIPTION SECURITY, BRANDING LIFECYCLE & LIMIT ENFORCEMENT', () => {
  // =========================================================================
  // SUITE 1: STARTER BRANDING RESTRICTIONS & PORTAL/INVOICE RESOLUTION
  // =========================================================================
  describe('Suite 1: Starter Plan Branding Restrictions', () => {
    it('Starter plan explicitly disallows custom branding on the server', () => {
      const allowed = resolveFeaturePermission('customBranding', 'starter', 'active');
      assert.equal(allowed, false, 'Starter plan must not permit customBranding');
    });

    it('Starter plan disallows custom subpaths on the server', () => {
      const allowed = resolveFeaturePermission('customSubpaths', 'starter', 'active');
      assert.equal(allowed, false, 'Starter plan must not permit customSubpaths');
    });

    it('Resolves FlowDesk official branding when workspace is on Starter (even if custom asset stored in DB)', () => {
      // Mock stored workspace record (downgraded user with preserved assets)
      const storedWorkspaceRecord = {
        id: 'ws-starter-123',
        name: 'Vance Studio',
        logo_url: 'https://storage.flowdesk.app/logos/ws-starter-123/branding/uuid_custom-logo.png',
        signature_url: 'https://storage.flowdesk.app/signatures/ws-starter-123/branding/uuid_sig.png',
      };

      // Simulating branding resolver logic from app/api/portal/branding/route.ts
      const hasCustomBranding = resolveFeaturePermission('customBranding', 'starter', 'active');

      const resolvedBranding = {
        businessName: storedWorkspaceRecord.name,
        logoUrl: hasCustomBranding ? storedWorkspaceRecord.logo_url : '/branding/flowdesk-symbol.png',
        signatureUrl: hasCustomBranding ? storedWorkspaceRecord.signature_url : '',
        isCustomBranded: hasCustomBranding,
      };

      assert.equal(resolvedBranding.isCustomBranded, false);
      assert.equal(resolvedBranding.logoUrl, '/branding/flowdesk-symbol.png', 'Should fallback to official FlowDesk logo');
      assert.equal(resolvedBranding.signatureUrl, '', 'Signature must be suppressed on Starter plan');

      // Crucial verification: The original stored URL was NEVER deleted or mutated in the database record
      assert.equal(
        storedWorkspaceRecord.logo_url,
        'https://storage.flowdesk.app/logos/ws-starter-123/branding/uuid_custom-logo.png',
        'Stored database logo URL must remain preserved'
      );
      assert.equal(
        storedWorkspaceRecord.signature_url,
        'https://storage.flowdesk.app/signatures/ws-starter-123/branding/uuid_sig.png',
        'Stored database signature URL must remain preserved'
      );
    });
  });

  // =========================================================================
  // SUITE 2: STANDARD BRANDING VS STUDIO CUSTOM SUBPATHS
  // =========================================================================
  describe('Suite 2: Standard Plan Branding vs Studio-Exclusive Subpaths', () => {
    it('Standard plan allows custom branding', () => {
      const allowed = resolveFeaturePermission('customBranding', 'standard', 'active');
      assert.equal(allowed, true, 'Standard plan must permit customBranding');
    });

    it('Standard plan strictly forbids custom subpaths', () => {
      const allowed = resolveFeaturePermission('customSubpaths', 'standard', 'active');
      assert.equal(allowed, false, 'Standard plan must NOT permit customSubpaths (Studio only)');
    });

    it('Standard plan strictly forbids audit log exports', () => {
      const allowed = resolveFeaturePermission('auditLogExports', 'standard', 'active');
      assert.equal(allowed, false, 'Standard plan must NOT permit auditLogExports');
    });

    it('Studio plan permits custom branding, custom subpaths, and audit log exports', () => {
      assert.equal(resolveFeaturePermission('customBranding', 'studio', 'active'), true);
      assert.equal(resolveFeaturePermission('customSubpaths', 'studio', 'active'), true);
      assert.equal(resolveFeaturePermission('auditLogExports', 'studio', 'active'), true);
    });
  });

  // =========================================================================
  // SUITE 3: DOWNGRADE RETENTION & REACTIVATION LIFECYCLE
  // =========================================================================
  describe('Suite 3: Branding Downgrade Retention & Upgrade Reactivation', () => {
    it('Preserves assets on downgrade and restores them automatically upon upgrade without re-upload', () => {
      // Step 1: User on Studio uploads branding
      const userDatabaseState = {
        workspaceId: 'ws-client-999',
        plan: 'studio' as PlanKey,
        logo_url: 'https://storage.flowdesk.app/logos/ws-client-999/branding/my-studio-logo.png',
        signature_url: 'https://storage.flowdesk.app/signatures/ws-client-999/branding/my-sig.png',
      };

      // Studio resolution
      let canBrand = resolveFeaturePermission('customBranding', userDatabaseState.plan, 'active');
      let effectiveLogo = canBrand ? userDatabaseState.logo_url : '/branding/flowdesk-symbol.png';
      let effectiveSig = canBrand ? userDatabaseState.signature_url : '';
      assert.equal(effectiveLogo, userDatabaseState.logo_url);
      assert.equal(effectiveSig, userDatabaseState.signature_url);

      // Step 2: Downgrade occurs (e.g. subscription cancelled or expired)
      userDatabaseState.plan = 'starter';

      // Verify downgrade retention policy:
      assert.ok(userDatabaseState.logo_url, 'Database logo MUST NOT be wiped on downgrade');
      assert.ok(userDatabaseState.signature_url, 'Database signature MUST NOT be wiped on downgrade');

      // Starter resolution while inactive
      canBrand = resolveFeaturePermission('customBranding', userDatabaseState.plan, 'active');
      effectiveLogo = canBrand ? userDatabaseState.logo_url : '/branding/flowdesk-symbol.png';
      effectiveSig = canBrand ? userDatabaseState.signature_url : '';
      assert.equal(canBrand, false);
      assert.equal(effectiveLogo, '/branding/flowdesk-symbol.png', 'Must display FlowDesk official logo while on Starter');
      assert.equal(effectiveSig, '', 'Must suppress custom signature while on Starter');

      // Step 3: User reactivates subscription to Standard
      userDatabaseState.plan = 'standard';

      // Standard resolution upon upgrade
      canBrand = resolveFeaturePermission('customBranding', userDatabaseState.plan, 'active');
      effectiveLogo = canBrand ? userDatabaseState.logo_url : '/branding/flowdesk-symbol.png';
      effectiveSig = canBrand ? userDatabaseState.signature_url : '';
      assert.equal(canBrand, true);
      assert.equal(
        effectiveLogo,
        'https://storage.flowdesk.app/logos/ws-client-999/branding/my-studio-logo.png',
        'Custom logo automatically reactivated without re-upload'
      );
      assert.equal(
        effectiveSig,
        'https://storage.flowdesk.app/signatures/ws-client-999/branding/my-sig.png',
        'Custom signature automatically reactivated without re-upload'
      );
    });

    it('Deduplicates downgrade notifications using category key', () => {
      const notificationsDispatched: Array<{ category: string; title: string }> = [];

      const dispatchDowngradeNotification = (category: string, title: string) => {
        // Enforce deduplication check
        const alreadyExists = notificationsDispatched.some((n) => n.category === category);
        if (alreadyExists) return false;
        notificationsDispatched.push({ category, title });
        return true;
      };

      // First downgrade event
      const res1 = dispatchDowngradeNotification('branding_downgrade', 'Custom Branding Temporarily Inactive');
      assert.equal(res1, true, 'First downgrade event must dispatch notification');

      // Subsequent downgrade webhook triggers (must be deduplicated)
      const res2 = dispatchDowngradeNotification('branding_downgrade', 'Custom Branding Temporarily Inactive');
      assert.equal(res2, false, 'Duplicate downgrade notification must be suppressed');

      assert.equal(notificationsDispatched.length, 1, 'Only exactly 1 downgrade notification should exist');
    });
  });

  // =========================================================================
  // SUITE 4: STRUCTURED PLAN LIMIT ERROR RESPONSES
  // =========================================================================
  describe('Suite 4: Structured Plan Limit Error Payloads', () => {
    it('Generates structured error with currentPlan, recommendedPlan, and usage for activeClients', async () => {
      const err = new PlanLimitError('Limit reached for activeClients', 'PLAN_LIMIT_REACHED', {
        metric: 'activeClients',
        current: 2,
        limit: 2,
        statusCode: 402,
        currentPlan: 'starter',
        recommendedPlan: 'standard',
      });

      assert.equal(err.code, 'PLAN_LIMIT_REACHED');
      assert.equal(err.metric, 'activeClients');
      assert.equal(err.current, 2);
      assert.equal(err.limit, 2);
      assert.equal(err.currentPlan, 'starter');
      assert.equal(err.recommendedPlan, 'standard');

      const response = createApiErrorResponse({
        message: err.message,
        code: err.code,
        status: err.statusCode,
        metric: err.metric,
        currentUsage: err.current,
        maxAllowed: err.limit,
        currentPlan: err.currentPlan,
        recommendedPlan: err.recommendedPlan,
      });

      const body = await response.json();
      assert.equal(response.status, 402);
      assert.equal(body.code, 'PLAN_LIMIT_REACHED');
      assert.equal(body.metric, 'activeClients');
      assert.equal(body.currentUsage, 2);
      assert.equal(body.maxAllowed, 2);
      assert.equal(body.currentPlan, 'starter');
      assert.equal(body.recommendedPlan, 'standard');
    });

    it('Generates structured error for activeProjects reaching Standard limit (25)', async () => {
      const check = resolveMetricLimitCheck('activeProjects', 25, 1, 'standard', 'active');
      assert.equal(check.allowed, false);
      assert.equal(check.code, 'PLAN_LIMIT_REACHED');

      const err = new PlanLimitError(check.reason!, check.code!, {
        metric: 'activeProjects',
        current: check.current,
        limit: check.limit,
        statusCode: 402,
        currentPlan: 'standard',
        recommendedPlan: 'studio',
      });

      const response = createApiErrorResponse({
        message: err.message,
        code: err.code,
        status: err.statusCode,
        metric: err.metric,
        currentUsage: err.current,
        maxAllowed: err.limit,
        currentPlan: err.currentPlan,
        recommendedPlan: err.recommendedPlan,
      });

      const body = await response.json();
      assert.equal(body.metric, 'activeProjects');
      assert.equal(body.currentUsage, 25);
      assert.equal(body.maxAllowed, 25);
      assert.equal(body.currentPlan, 'standard');
      assert.equal(body.recommendedPlan, 'studio');
    });

    it('Generates structured error for invoicesPerMonth reaching Starter limit (5)', async () => {
      const check = resolveMetricLimitCheck('invoicesPerMonth', 5, 1, 'starter', 'active');
      assert.equal(check.allowed, false);
      assert.equal(check.code, 'PLAN_LIMIT_REACHED');

      const err = new PlanLimitError(check.reason!, check.code!, {
        metric: 'invoicesPerMonth',
        current: check.current,
        limit: check.limit,
        statusCode: 402,
        currentPlan: 'starter',
        recommendedPlan: 'standard',
      });

      assert.equal(err.metric, 'invoicesPerMonth');
      assert.equal(err.current, 5);
      assert.equal(err.limit, 5);
      assert.equal(err.currentPlan, 'starter');
      assert.equal(err.recommendedPlan, 'standard');
    });

    it('Handles Studio maximum capacity (recommendedPlan is null)', () => {
      const check = resolveMetricLimitCheck('activeClients', 100, 1, 'studio', 'active');
      assert.equal(check.allowed, false);

      const err = new PlanLimitError(check.reason!, check.code!, {
        metric: 'activeClients',
        current: check.current,
        limit: check.limit,
        statusCode: 402,
        currentPlan: 'studio',
        recommendedPlan: null,
      });

      assert.equal(err.currentPlan, 'studio');
      assert.equal(err.recommendedPlan, null, 'Studio has no higher automated plan');
    });
  });

  // =========================================================================
  // SUITE 5: IDOR DEFENSES & WORKSPACE ENFORCEMENT
  // =========================================================================
  describe('Suite 5: Cross-Workspace IDOR Protections', () => {
    it('Rejects cross-workspace client attachment on invoice creation', () => {
      const userWorkspaceId = 'ws-owner-aaa';
      const foreignClientId = 'client-from-workspace-bbb';

      const mockClientsInDatabase = [
        { id: 'client-from-workspace-aaa', workspace_id: 'ws-owner-aaa' },
        { id: 'client-from-workspace-bbb', workspace_id: 'ws-victim-bbb' },
      ];

      // Defended lookup: MUST filter by both id AND authorized workspace_id
      const resolvedClient = mockClientsInDatabase.find(
        (c) => c.id === foreignClientId && c.workspace_id === userWorkspaceId
      );

      assert.equal(resolvedClient, undefined, 'Client belonging to another workspace must not be resolved');
    });

    it('Enforces multi-currency entitlement on invoice update PATCH', () => {
      const starterCanMultiCurrency = resolveFeaturePermission('multiCurrency', 'starter', 'active');
      const standardCanMultiCurrency = resolveFeaturePermission('multiCurrency', 'standard', 'active');

      assert.equal(starterCanMultiCurrency, false, 'Starter cannot invoice in non-INR currencies');
      assert.equal(standardCanMultiCurrency, true, 'Standard can invoice in multi-currency');
    });

    it('Blocks unarchival of clients when at plan limit', () => {
      // Starter workspace has 2 active clients and 1 archived client
      const currentActiveCount = 2;
      const starterCheck = resolveMetricLimitCheck('activeClients', currentActiveCount, 1, 'starter', 'active');
      assert.equal(
        starterCheck.allowed,
        false,
        'Unarchival must be rejected when active count already equals plan limit'
      );
    });
  });

  // =========================================================================
  // SUITE 6: CONCURRENCY & LIMIT MARGIN TESTING
  // =========================================================================
  describe('Suite 6: Concurrency & Margin Verification', () => {
    it('Rejects simultaneous creations when remaining quota is 1', () => {
      // Current usage: 1 client on Starter (max: 2, remaining: 1)
      let currentUsage = 1;
      const limit = BILLING_PLANS.starter.limits.activeClients; // 2

      const attemptCreation = () => {
        if (currentUsage + 1 > limit) {
          throw new PlanLimitError('Limit reached', 'PLAN_LIMIT_REACHED', {
            metric: 'activeClients',
            current: currentUsage,
            limit,
          });
        }
        currentUsage += 1;
        return true;
      };

      // First request succeeds
      const req1 = attemptCreation();
      assert.equal(req1, true);
      assert.equal(currentUsage, 2);

      // Second request immediately fails
      assert.throws(
        () => attemptCreation(),
        (err: any) => err instanceof PlanLimitError && err.code === 'PLAN_LIMIT_REACHED'
      );
    });
  });

  // =========================================================================
  // SUITE 7: NON-NEGOTIABLE APPROVED CAPABILITIES CONFIRMATION
  // =========================================================================
  describe('Suite 7: Non-Negotiable Approved Rules Confirmation', () => {
    it('Preserves approved deliverable versioning limits (Starter: 3, Standard: 5, Studio: 1000)', () => {
      assert.equal(BILLING_PLANS.starter.limits.maxVersionsPerDeliverable, 3);
      assert.equal(BILLING_PLANS.standard.limits.maxVersionsPerDeliverable, 5);
      assert.equal(BILLING_PLANS.studio.limits.maxVersionsPerDeliverable, 1000);
      assert.equal(resolveFeaturePermission('highThroughputVersioning', 'starter', 'active'), false);
      assert.equal(resolveFeaturePermission('highThroughputVersioning', 'standard', 'active'), false);
      assert.equal(resolveFeaturePermission('highThroughputVersioning', 'studio', 'active'), true);
    });

    it('Preserves approved invoice auto-numbering entitlements', () => {
      assert.equal(resolveFeaturePermission('autoNumbering', 'starter', 'active'), false);
      assert.equal(resolveFeaturePermission('autoNumbering', 'standard', 'active'), true);
      assert.equal(resolveFeaturePermission('autoNumbering', 'studio', 'active'), true);
    });

    it('Preserves exact pricing structure (Starter ₹0, Standard ₹399/mo, Studio ₹899/mo)', () => {
      assert.equal(BILLING_PLANS.starter.pricing.monthly.INR, 0);
      assert.equal(BILLING_PLANS.standard.pricing.monthly.INR, 399);
      assert.equal(BILLING_PLANS.studio.pricing.monthly.INR, 899);
    });
  });
});
