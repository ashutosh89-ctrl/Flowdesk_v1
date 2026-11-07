/**
 * FlowDesk SaaS Billing Plans & Entitlements Configuration
 * 
 * Single authoritative source of truth for all FlowDesk subscription plans,
 * pricing, limits, and feature flags across Starter, Standard, and Studio.
 */

export type PlanKey = 'starter' | 'standard' | 'studio' | 'free' | 'pro';
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
  /** Local device storage architecture (zero cloud quotas) */
  localStorageOnly: boolean;
  /** Whether the workspace client portal can be custom-branded */
  customBranding: boolean;
  /** Compatibility alias for customBranding */
  brandedPortal: boolean;
  /** Whether automatic invoice payment reminders are enabled */
  automatedReminders: boolean;
  /** Compatibility alias for automatedReminders */
  emailReminders: boolean;
  /** Multi-currency invoicing allowed */
  multiCurrency: boolean;
  /** Payment receipts issued to clients upon payment confirmation */
  paymentReceipts: boolean;
  /** Custom portal subpaths / slugs */
  customSubpaths: boolean;
  /** Multi-stage automated dunning sequences */
  multiStageDunning: boolean;
  /** High-throughput deliverable versioning without artificial version caps */
  highThroughputVersioning: boolean;
  /** Dedicated priority support */
  dedicatedSupport: boolean;
  /** Export audit logs as structured data / CSV */
  auditLogExports: boolean;
  /** Invoice auto-numbering and custom sequence formats */
  autoNumbering: boolean;
  /** Maximum deliverable versions allowed per deliverable (Infinity for Studio) */
  maxVersionsPerDeliverable: number;
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
}

const starterPlan: PlanDefinition = {
  key: 'starter',
  name: 'Free Starter',
  tagline: 'Essential tools for solo freelancers starting out.',
  pricing: {
    monthly: { INR: 0, USD: 0 },
    yearly: { INR: 0, USD: 0 },
  },
  limits: {
    activeClients: 15,
    activeProjects: 25,
    invoicesPerMonth: 50,
    localStorageOnly: true,
    customBranding: true,
    brandedPortal: true,
    automatedReminders: true,
    emailReminders: true,
    multiCurrency: true,
    paymentReceipts: true,
    customSubpaths: true,
    multiStageDunning: true,
    highThroughputVersioning: true,
    dedicatedSupport: false,
    auditLogExports: true,
    autoNumbering: true,
    maxVersionsPerDeliverable: 10,
    aiCreditsPerMonth: 50,
  },
  features: [
    'Up to 15 active clients',
    'Up to 25 active projects',
    'Local device storage (zero cloud quotas)',
    'Up to 50 invoices per month with auto-numbering',
    'Custom branded client review portal',
    'Automated & manual invoice reminders',
    'Multi-currency invoicing & payment tracking',
    'Instant QR & bank transfer settlements',
  ],
  providerPlanIds: {
    razorpay: {},
  },
};

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
    localStorageOnly: true,
    customBranding: true,
    brandedPortal: true,
    automatedReminders: true,
    emailReminders: true,
    multiCurrency: true,
    paymentReceipts: true,
    customSubpaths: false,
    multiStageDunning: false,
    highThroughputVersioning: false,
    dedicatedSupport: false,
    auditLogExports: false,
    autoNumbering: true,
    maxVersionsPerDeliverable: 5,
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
      monthly: process.env.RAZORPAY_PLAN_STANDARD_MONTHLY || 'plan_TxMuv0IAbfn6PN',
      yearly: process.env.RAZORPAY_PLAN_STANDARD_YEARLY || 'plan_TxMvCYuh8YmpX9',
    },
  },
};

const studioPlan: PlanDefinition = {
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
    localStorageOnly: true,
    customBranding: true,
    brandedPortal: true,
    automatedReminders: true,
    emailReminders: true,
    multiCurrency: true,
    paymentReceipts: true,
    customSubpaths: true,
    multiStageDunning: true,
    highThroughputVersioning: true,
    dedicatedSupport: true,
    auditLogExports: true,
    autoNumbering: true,
    maxVersionsPerDeliverable: 1000,
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
      monthly: process.env.RAZORPAY_PLAN_STUDIO_MONTHLY || 'plan_TxMvCqZmMGl7U1',
      yearly: process.env.RAZORPAY_PLAN_STUDIO_YEARLY || 'plan_TxMvD3mr4WyW8z',
    },
  },
};

export const BILLING_PLANS: Record<PlanKey, PlanDefinition> = {
  starter: starterPlan,
  standard: standardPlan,
  studio: studioPlan,
  // Backward compatibility aliases
  free: {
    ...starterPlan,
    key: 'free',
  },
  pro: {
    ...standardPlan,
    key: 'pro',
  },
};

/** Default currency used for billing FlowDesk subscriptions */
export const DEFAULT_BILLING_CURRENCY: CurrencyCode = 'INR';

/** Grace period duration in days after payment exhaustion before workspace is restricted */
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

/** Default trial duration in days when a new workspace activates a Standard trial */
export const DEFAULT_TRIAL_PERIOD_DAYS = 14;

/** Helper to retrieve a plan definition safely, falling back to 'free' / 'starter' */
export function getBillingPlan(planKey: string | undefined | null): PlanDefinition {
  if (planKey === 'pro') {
    return BILLING_PLANS.pro;
  }
  if (planKey === 'standard') {
    return BILLING_PLANS.standard;
  }
  if (planKey === 'studio') {
    return BILLING_PLANS.studio;
  }
  if (planKey === 'free') {
    return BILLING_PLANS.free;
  }
  if (planKey === 'starter') {
    return BILLING_PLANS.starter;
  }
  if (planKey && planKey in BILLING_PLANS) {
    return BILLING_PLANS[planKey as PlanKey];
  }
  return BILLING_PLANS.free;
}
