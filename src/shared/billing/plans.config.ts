/**
 * FlowDesk SaaS Billing Plans & Entitlements Configuration
 * 
 * IMPORTANT FOR OWNER / PRODUCT LEAD:
 * All prices, currency defaults, quota limits, and Razorpay Plan IDs below are
 * PLACEHOLDERS. You must configure real business values before launching to production.
 * 
 * TODO [OWNER]:
 * 1. Set real subscription prices in INR and USD.
 * 2. Set actual quota limits for Free, Pro, and Studio tiers.
 * 3. Pre-create recurring Plans in Razorpay Dashboard and paste the resulting
 *    Plan IDs (e.g., 'plan_M1234567890ABC') into `providerPlanIds.razorpay`.
 * 4. Verify GST compliance and subscription tax requirements with your accountant.
 */

export type PlanKey = 'free' | 'standard' | 'studio' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';
export type CurrencyCode = 'INR' | 'USD';

export interface PlanPricing {
  monthly: {
    INR: number;
    USD: number;
  };
  yearly: {
    INR: number;
    USD: number;
  };
}

export interface PlanLimits {
  /** Maximum number of active (non-deleted) clients */
  activeClients: number;
  /** Maximum number of active (non-archived) projects */
  activeProjects: number;
  /** Maximum number of invoices created per calendar month */
  invoicesPerMonth: number;
  /** Whether the workspace client portal can be custom-branded */
  brandedPortal: boolean;
  /** Whether automatic transactional email payment reminders are enabled */
  emailReminders: boolean;
  /** AI assistance credits per month (placeholder, currently unmetered/unused) */
  aiCreditsPerMonth: number;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  tagline: string;
  badge?: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: string[];
  /** Razorpay Plan IDs created in Razorpay Dashboard for recurring billing */
  providerPlanIds: {
    razorpay: {
      monthly?: string;
      yearly?: string;
    };
  };
}

const standardPlan: PlanDefinition = {
  key: 'standard',
  name: 'Standard Freelancer',
  tagline: 'Advanced tools for full-time professionals scaling client work.',
  badge: 'Most Popular',
  pricing: {
    monthly: { INR: 399, USD: 9 },
    yearly: { INR: 3990, USD: 90 },
  },
  limits: {
    activeClients: 15,
    activeProjects: 25,
    invoicesPerMonth: 50,
    brandedPortal: true,
    emailReminders: true,
    aiCreditsPerMonth: 100,
  },
  features: [
    'Up to 15 active clients',
    'Up to 25 active projects',
    'Local device storage (zero cloud quotas)',
    '50 invoices per month with auto-numbering',
    'Custom branded client portal',
    'Automated invoice payment reminders',
    'Multi-currency invoicing & payment receipts',
    'Priority email support',
  ],
  providerPlanIds: {
    razorpay: {
      monthly: 'plan_placeholder_standard_monthly',
      yearly: 'plan_placeholder_standard_yearly',
    },
  },
};

export const BILLING_PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free Starter',
    tagline: 'Essential tools for solo freelancers starting out.',
    pricing: {
      monthly: { INR: 0, USD: 0 },
      yearly: { INR: 0, USD: 0 },
    },
    limits: {
      activeClients: 2,
      activeProjects: 3,
      invoicesPerMonth: 5,
      brandedPortal: false,
      emailReminders: false,
      aiCreditsPerMonth: 0,
    },
    features: [
      'Up to 2 active clients',
      'Up to 3 active projects',
      'Local device storage (zero cloud quotas)',
      'Up to 5 invoices per month',
      'Standard client review portal',
      'Basic payment tracking',
    ],
    providerPlanIds: {
      razorpay: {},
    },
  },

  standard: standardPlan,

  // Backward compatibility alias for legacy 'pro' records
  pro: {
    ...standardPlan,
    key: 'pro',
  },

  studio: {
    key: 'studio',
    name: 'Studio Agency',
    tagline: 'High-capacity workspace for boutique agencies and top-tier studios.',
    badge: 'High Capacity',
    pricing: {
      monthly: { INR: 899, USD: 19 },
      yearly: { INR: 8990, USD: 190 },
    },
    limits: {
      activeClients: 100,
      activeProjects: 150,
      invoicesPerMonth: 500,
      brandedPortal: true,
      emailReminders: true,
      aiCreditsPerMonth: 500,
    },
    features: [
      'Up to 100 active clients',
      'Up to 150 active projects',
      'Local device storage (zero cloud quotas)',
      '500 invoices per month',
      'Fully branded client experience & custom subpaths',
      'Automated multi-stage dunning & invoice reminders',
      'High-throughput deliverable versioning',
      'Dedicated support & audit log exports',
    ],
    providerPlanIds: {
      razorpay: {
        monthly: 'plan_placeholder_studio_monthly',
        yearly: 'plan_placeholder_studio_yearly',
      },
    },
  },
};

/** Default currency used for billing FlowDesk subscriptions */
export const DEFAULT_BILLING_CURRENCY: CurrencyCode = 'INR';

/** Grace period duration in days after payment exhaustion before workspace is restricted */
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

/** Default trial duration in days when a new workspace activates a Standard trial */
export const DEFAULT_TRIAL_PERIOD_DAYS = 14;

/** Helper to retrieve a plan definition safely, falling back to 'free' */
export function getBillingPlan(planKey: string | undefined | null): PlanDefinition {
  if (planKey === 'pro') {
    return BILLING_PLANS.standard;
  }
  if (planKey && planKey in BILLING_PLANS) {
    return BILLING_PLANS[planKey as PlanKey];
  }
  return BILLING_PLANS.free;
}
