import test from 'node:test';
import assert from 'node:assert/strict';
import { siteConfig, getUnconfirmedPlaceholders } from '../src/shared/config/site-config';
import { BILLING_PLANS, getBillingPlan, isWriteAllowedInStatus } from '../src/shared/billing';
import { ContactSubmissionSchema } from '../src/shared/validation/schemas';
import { checkRateLimit } from '../src/backend/utilities/rate-limiter';

test('Legal Compliance: Central Site Configuration & Placeholders', async (suite) => {
  await suite.test('siteConfig defines required identity, emails, and jurisdiction', () => {
    assert.equal(siteConfig.brandName, 'FlowDesk');
    assert.ok(siteConfig.supportEmail.includes('@'));
    assert.ok(siteConfig.privacyEmail.includes('@'));
    assert.ok(siteConfig.securityEmail.includes('@'));
    assert.equal(siteConfig.governingLaw.country, 'India');
  });

  await suite.test('all policy metadata entries have version and valid dates', () => {
    const policies = ['terms', 'privacy', 'refund', 'cancellation', 'security'] as const;
    for (const p of policies) {
      const meta = siteConfig.policies[p];
      assert.ok(meta, `Policy ${p} exists in siteConfig`);
      assert.ok(meta.version.length > 0, `Policy ${p} has version`);
      assert.ok(meta.lastUpdated.length > 0, `Policy ${p} has lastUpdated`);
      assert.ok(meta.effectiveDate.length > 0, `Policy ${p} has effectiveDate`);
    }
  });

  await suite.test('getUnconfirmedPlaceholders returns empty list for verified production config', () => {
    const placeholders = getUnconfirmedPlaceholders();
    assert.ok(Array.isArray(placeholders));
    assert.equal(placeholders.length, 0, 'No unconfirmed placeholders remain in verified production config');
  });
});

test('Plan Alignment: Single Source of Truth for Pricing & Quotas', async (suite) => {
  await suite.test('Starter (free) tier aligns with ₹0 pricing and strict quotas', () => {
    const plan = getBillingPlan('free');
    assert.equal(plan.name, 'Free Starter');
    assert.equal(plan.pricing.monthly.INR, 0);
    assert.equal(plan.pricing.yearly.INR, 0);
    assert.equal(plan.limits.activeClients, 2);
    assert.equal(plan.limits.activeProjects, 3);
    assert.equal(plan.limits.invoicesPerMonth, 5);
    assert.equal(plan.limits.localStorageOnly, true);
  });

  await suite.test('Standard (pro) tier aligns with ₹399/mo and ₹3,990/yr', () => {
    const plan = getBillingPlan('pro');
    assert.equal(plan.name, 'Standard Freelancer');
    assert.equal(plan.pricing.monthly.INR, 399);
    assert.equal(plan.pricing.yearly.INR, 3990);
    assert.equal(plan.limits.activeClients, 15);
    assert.equal(plan.limits.activeProjects, 25);
    assert.equal(plan.limits.invoicesPerMonth, 50);
  });

  await suite.test('Standard alias resolves cleanly to standard tier', () => {
    const plan = getBillingPlan('standard');
    assert.equal(plan.key, 'standard');
    assert.equal(plan.name, 'Standard Freelancer');
    assert.equal(plan.pricing.monthly.INR, 399);
  });

  await suite.test('Studio tier aligns with ₹899/mo and ₹8,990/yr', () => {
    const plan = getBillingPlan('studio');
    assert.equal(plan.name, 'Studio Agency');
    assert.equal(plan.pricing.monthly.INR, 899);
    assert.equal(plan.pricing.yearly.INR, 8990);
    assert.equal(plan.limits.activeClients, 100);
    assert.equal(plan.limits.activeProjects, 150);
    assert.equal(plan.limits.invoicesPerMonth, 500);
  });

  await suite.test('Subscription cancellation maintains access until period end, then locks write', () => {
    assert.equal(isWriteAllowedInStatus('active'), true);
    assert.equal(isWriteAllowedInStatus('canceled_at_period_end'), true);
    assert.equal(isWriteAllowedInStatus('canceled'), false);
    assert.equal(isWriteAllowedInStatus('expired'), false);
    assert.equal(isWriteAllowedInStatus('grace'), false);
  });
});

test('Contact & Support: Validation, Honeypot & Rate Limiting', async (suite) => {
  await suite.test('valid contact submission parses successfully', () => {
    const payload = {
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      category: 'Refund Request',
      subject: 'Billing discrepancy for invoice #104',
      message: 'Hello, I was double charged for my monthly subscription. Please review.',
      orderOrPaymentId: 'order_12345',
      privacyConsent: true,
      hp_website: '',
    };
    const res = ContactSubmissionSchema.safeParse(payload);
    assert.equal(res.success, true);
  });

  await suite.test('honeypot field triggers spam detection when filled', () => {
    const payload = {
      name: 'Bot Runner',
      email: 'bot@spam.com',
      category: 'Technical Issue',
      subject: 'Spam Subject',
      message: 'Buy cheap watches here please',
      hp_website: 'https://spam-link.ru',
    };
    const res = ContactSubmissionSchema.safeParse(payload);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.ok(res.error.issues.some((i) => i.path.includes('hp_website')));
    }
  });

  await suite.test('invalid email address is rejected', () => {
    const payload = {
      name: 'Test User',
      email: 'not-an-email',
      category: 'General Support',
      subject: 'Hello',
      message: 'This is a message from a user with bad email.',
    };
    const res = ContactSubmissionSchema.safeParse(payload);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.ok(res.error.issues.some((i) => i.path.includes('email')));
    }
  });

  await suite.test('unsupported category is rejected', () => {
    const payload = {
      name: 'Test User',
      email: 'test@example.com',
      category: 'NonExistentCategory' as any,
      subject: 'Invalid Category Subject',
      message: 'Message content longer than ten characters.',
    };
    const res = ContactSubmissionSchema.safeParse(payload);
    assert.equal(res.success, false);
  });

  await suite.test('rate limiting isolates bursts per IP or identifier', async () => {
    const testKey = `test-contact-rate-limit-${Date.now()}`;
    const firstCheck = await checkRateLimit(testKey, { maxRequests: 2, windowSeconds: 60, prefix: 'test_legal' });
    assert.equal(firstCheck.allowed, true);
    assert.equal(firstCheck.remaining, 1);

    const secondCheck = await checkRateLimit(testKey, { maxRequests: 2, windowSeconds: 60, prefix: 'test_legal' });
    assert.equal(secondCheck.allowed, true);
    assert.equal(secondCheck.remaining, 0);

    const thirdCheck = await checkRateLimit(testKey, { maxRequests: 2, windowSeconds: 60, prefix: 'test_legal' });
    assert.equal(thirdCheck.allowed, false);
    assert.ok(thirdCheck.retryAfterSeconds > 0);
  });
});
