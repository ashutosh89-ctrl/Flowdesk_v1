/**
 * FlowDesk SaaS Billing Plans & Entitlements Configuration
 *
 * Single Source of Truth for SaaS tiers, pricing, quotas, and feature flags.
 * Used identically across:
 * - Public Pricing Page (`/pricing` and landing)
 * - Freelancer Billing Settings (`BillingPlanPanel`)
 * - Checkout and Upgrade Modals (`UpgradeModal`)
 * - Backend Quota Assertion Middleware (`assertWithinLimit`)
 */

export type PlanKey = 'free' | 'pro' | 'studio';
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
  /** Maximum storage allocation in megabytes (MB) */
  storageMb: number;
  /** Maximum number of invoices created per calendar month */
  invoicesPerMonth: number;
  /** Whether the workspace client portal can be custom-branded */
  brandedPortal: boolean;
  /** Whether automatic transactional email payment reminders are enabled */
  emailReminders: boolean;
  /** AI assistance credits per month (placeholder) */
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
  isPopular?: boolean;
}

export const BILLING_PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Starter',
    tagline: 'Essential tools for solo freelancers and emerging creators starting out.',
    pricing: {
      monthly: { INR: 0, USD: 0 },
      yearly: { INR: 0, USD: 0 },
    },
    limits: {
      activeClients: 2,
      activeProjects: 3,
      storageMb: 250,
      invoicesPerMonth: 5,
      brandedPortal: false,
      emailReminders: false,
      aiCreditsPerMonth: 0,
    },
    features: [
      'Up to 2 active clients',
      'Up to 3 active projects',
      '250 MB secure document storage',
      'Up to 5 invoices per month',
      'Standard client review portal',
      'Manual invoice tracking',
    ],
    providerPlanIds: {
      razorpay: {},
    },
  },

  pro: {
    key: 'pro',
    name: 'Standard',
    tagline: 'Reliable operating system for growing freelancers with ongoing client engagements.',
    badge: 'Most Popular',
    isPopular: true,
    pricing: {
      monthly: { INR: 399, USD: 6 },
      yearly: { INR: 3990, USD: 60 },
    },
    limits: {
      activeClients: 10,
      activeProjects: 15,
      storageMb: 5000, // 5 GB
      invoicesPerMonth: 50,
      brandedPortal: true,
      emailReminders: true,
      aiCreditsPerMonth: 100,
    },
    features: [
      'Up to 10 active clients',
      'Up to 15 active projects',
      '5 GB secure document storage',
      '50 invoices per month with auto-numbering',
      'Custom branded client portal',
      'Automated email payment reminders',
      'Multi-currency invoicing & receipts',
      'Standard support via contact portal',
    ],
    providerPlanIds: {
      razorpay: {
        monthly: process.env.RAZORPAY_PLAN_STANDARD_MONTHLY || 'plan_placeholder_standard_monthly',
        yearly: process.env.RAZORPAY_PLAN_STANDARD_YEARLY || 'plan_placeholder_standard_yearly',
      },
    },
  },

  studio: {
    key: 'studio',
    name: 'Studio',
    tagline: 'High-capacity workspace for established studios and boutique agency teams.',
    badge: 'High Capacity',
    pricing: {
      monthly: { INR: 899, USD: 14 },
      yearly: { INR: 8990, USD: 140 },
    },
    limits: {
      activeClients: 10000, // Unlimited subject to fair use
      activeProjects: 10000, // Unlimited
      storageMb: 25000, // 25 GB
      invoicesPerMonth: 500,
      brandedPortal: true,
      emailReminders: true,
      aiCreditsPerMonth: 500,
    },
    features: [
      'Unlimited active clients (fair use)',
      'Unlimited active projects',
      '25 GB secure document storage',
      '500 invoices per month',
      'Custom branded client portal',
      'Automated invoice payment reminders & dunning',
      'High-throughput deliverable versioning',
      'Priority email support & audit exports',
    ],
    providerPlanIds: {
      razorpay: {
        monthly: process.env.RAZORPAY_PLAN_STUDIO_MONTHLY || 'plan_placeholder_studio_monthly',
        yearly: process.env.RAZORPAY_PLAN_STUDIO_YEARLY || 'plan_placeholder_studio_yearly',
      },
    },
  },
};

/** Default currency used for billing FlowDesk subscriptions */
export const DEFAULT_BILLING_CURRENCY: CurrencyCode = 'INR';

/** Grace period duration in days after payment exhaustion before workspace is restricted */
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

/** Default trial duration in days when a new workspace activates a trial */
export const DEFAULT_TRIAL_PERIOD_DAYS = 14;

/** Helper to retrieve a plan definition safely, falling back to 'free' */
export function getBillingPlan(planKey: string | undefined | null): PlanDefinition {
  if (planKey) {
    if (planKey === 'standard') return BILLING_PLANS.pro;
    if (planKey in BILLING_PLANS) {
      return BILLING_PLANS[planKey as PlanKey];
    }
  }
  return BILLING_PLANS.free;
}
