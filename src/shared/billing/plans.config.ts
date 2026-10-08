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

export type PlanKey = 'free' | 'pro' | 'studio';
export type BillingInterval = 'monthly' | 'yearly';
export type CurrencyCode = 'INR' | 'USD';

export interface PlanPricing {
  monthly: {
    INR: number; // Placeholder in INR (e.g. 999 = ₹999/mo)
    USD: number; // Placeholder in USD (e.g. 15 = $15/mo)
  };
  yearly: {
    INR: number; // Placeholder in INR (e.g. 9990 = ₹9,990/yr)
    USD: number; // Placeholder in USD (e.g. 150 = $150/yr)
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
      activeClients: 2,           // TODO [OWNER]: Set final Free limit
      activeProjects: 3,          // TODO [OWNER]: Set final Free limit
      storageMb: 250,             // 250 MB storage
      invoicesPerMonth: 5,        // 5 invoices / month
      brandedPortal: false,       // Default FlowDesk portal branding
      emailReminders: false,      // Manual reminders only
      aiCreditsPerMonth: 0,       // Unused placeholder
    },
    features: [
      'Up to 2 active clients',
      'Up to 3 active projects',
      '250 MB secure document storage',
      'Up to 5 invoices per month',
      'Standard client review portal',
      'Basic payment tracking',
    ],
    providerPlanIds: {
      razorpay: {},
    },
  },

  pro: {
    key: 'pro',
    name: 'Pro Freelancer',
    tagline: 'Advanced tools for full-time professionals scaling client work.',
    badge: 'Most Popular',
    pricing: {
      monthly: { INR: 799, USD: 12 },    // TODO [OWNER]: Replace placeholder ₹799/mo ($12/mo)
      yearly: { INR: 7990, USD: 120 },   // TODO [OWNER]: Replace placeholder ₹7,990/yr ($120/yr)
    },
    limits: {
      activeClients: 15,          // TODO [OWNER]: Set final Pro limit
      activeProjects: 25,         // TODO [OWNER]: Set final Pro limit
      storageMb: 5000,            // 5 GB storage
      invoicesPerMonth: 50,       // 50 invoices / month
      brandedPortal: true,        // Custom studio branding enabled
      emailReminders: true,       // Automated invoice payment reminders
      aiCreditsPerMonth: 100,     // Unused placeholder
    },
    features: [
      'Up to 15 active clients',
      'Up to 25 active projects',
      '5 GB secure document storage',
      '50 invoices per month with auto-numbering',
      'Custom branded client portal',
      'Automated invoice payment reminders',
      'Multi-currency invoicing & payment receipts',
      'Priority email support',
    ],
    providerPlanIds: {
      razorpay: {
        monthly: 'plan_placeholder_pro_monthly', // TODO [OWNER]: Set Razorpay Plan ID
        yearly: 'plan_placeholder_pro_yearly',   // TODO [OWNER]: Set Razorpay Plan ID
      },
    },
  },

  studio: {
    key: 'studio',
    name: 'Studio Agency',
    tagline: 'High-capacity workspace for boutique agencies and top-tier studios.',
    badge: 'High Capacity',
    pricing: {
      monthly: { INR: 1999, USD: 29 },   // TODO [OWNER]: Replace placeholder ₹1,999/mo ($29/mo)
      yearly: { INR: 19990, USD: 290 },  // TODO [OWNER]: Replace placeholder ₹19,990/yr ($290/yr)
    },
    limits: {
      activeClients: 100,         // TODO [OWNER]: Set final Studio limit
      activeProjects: 150,        // TODO [OWNER]: Set final Studio limit
      storageMb: 25000,           // 25 GB storage
      invoicesPerMonth: 500,      // 500 invoices / month
      brandedPortal: true,        // Custom studio branding enabled
      emailReminders: true,       // Automated invoice payment reminders
      aiCreditsPerMonth: 500,     // Unused placeholder
    },
    features: [
      'Up to 100 active clients',
      'Up to 150 active projects',
      '25 GB secure document storage',
      '500 invoices per month',
      'Fully branded client experience & custom subpaths',
      'Automated multi-stage dunning & invoice reminders',
      'High-throughput deliverable versioning',
      'Dedicated support & audit log exports',
    ],
    providerPlanIds: {
      razorpay: {
        monthly: 'plan_placeholder_studio_monthly', // TODO [OWNER]: Set Razorpay Plan ID
        yearly: 'plan_placeholder_studio_yearly',   // TODO [OWNER]: Set Razorpay Plan ID
      },
    },
  },
};

/** Default currency used for billing FlowDesk subscriptions */
export const DEFAULT_BILLING_CURRENCY: CurrencyCode = 'INR';

/** Grace period duration in days after payment exhaustion before workspace is restricted */
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

/** Default trial duration in days when a new workspace activates a Pro trial */
export const DEFAULT_TRIAL_PERIOD_DAYS = 14;

/** Helper to retrieve a plan definition safely, falling back to 'free' */
export function getBillingPlan(planKey: string | undefined | null): PlanDefinition {
  if (planKey && planKey in BILLING_PLANS) {
    return BILLING_PLANS[planKey as PlanKey];
  }
  return BILLING_PLANS.free;
}
