/**
 * FlowDesk Central Site & Legal Configuration
 * Single authoritative source of truth for business identity, legal disclosures,
 * governing law, support contact endpoints, and policy versioning.
 *
 * NOTE: Values marked with [TO BE CONFIRMED: ...] are explicit placeholders
 * that must be replaced by the entity owner prior to production launch.
 */

export interface PolicyMetadata {
  version: string;
  lastUpdated: string;
  effectiveDate: string;
  draftForLegalReview?: boolean;
}

export interface SiteConfig {
  brandName: string;
  legalEntityName: string;
  supportEmail: string;
  privacyEmail: string;
  securityEmail: string;
  contactResponseTarget: string;
  registeredAddress: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  grievanceOfficer: {
    name: string;
    title: string;
    email: string;
    address: string;
  };
  governingLaw: {
    country: string;
    state: string;
    jurisdictionCity: string;
    arbitrationCity: string;
  };
  registration: {
    cin: string;
    gstin: string;
    taxStatement: string;
  };
  policies: {
    terms: PolicyMetadata;
    privacy: PolicyMetadata;
    refund: PolicyMetadata;
    cancellation: PolicyMetadata;
    security: PolicyMetadata;
  };
}

export const siteConfig: SiteConfig = {
  brandName: 'FlowDesk',
  legalEntityName: '[TO BE CONFIRMED: Legal Entity Name e.g. FlowDesk Technologies Private Limited]',
  supportEmail: 'flowdesk11@gmail.com',
  privacyEmail: 'flowdesk11@gmail.com',
  securityEmail: 'flowdesk11@gmail.com',
  contactResponseTarget: 'Within 1-2 business days',

  registeredAddress: {
    line1: '[TO BE CONFIRMED: Registered Office Address Line 1]',
    city: '[TO BE CONFIRMED: City e.g. Mumbai]',
    state: '[TO BE CONFIRMED: State e.g. Maharashtra]',
    postalCode: '[TO BE CONFIRMED: Postal Code]',
    country: 'India',
  },

  grievanceOfficer: {
    name: '[TO BE CONFIRMED: Grievance Officer Name]',
    title: 'Grievance Redressal Officer & Data Protection Liaison',
    email: 'flowdesk11@gmail.com',
    address: '[TO BE CONFIRMED: Postal Address for Grievances, India]',
  },

  governingLaw: {
    country: 'India',
    state: '[TO BE CONFIRMED: State e.g. Maharashtra]',
    jurisdictionCity: '[TO BE CONFIRMED: Courts at City, India]',
    arbitrationCity: '[TO BE CONFIRMED: Arbitration City, India]',
  },

  registration: {
    cin: '[TO BE CONFIRMED: Corporate Identification Number (CIN) or Pending Registration]',
    gstin: '[TO BE CONFIRMED: Goods and Services Tax Identification Number (GSTIN)]',
    taxStatement: 'Prices displayed in INR exclude 18% Goods & Services Tax (GST) unless explicitly stated. Tax invoices are furnished upon subscription settlement.',
  },

  policies: {
    terms: {
      version: '1.0.0',
      lastUpdated: 'November 4, 2026',
      effectiveDate: 'November 4, 2026',
    },
    privacy: {
      version: '1.0.0',
      lastUpdated: 'November 4, 2026',
      effectiveDate: 'November 4, 2026',
      draftForLegalReview: true,
    },
    refund: {
      version: '1.0.0',
      lastUpdated: 'November 4, 2026',
      effectiveDate: 'November 4, 2026',
    },
    cancellation: {
      version: '1.0.0',
      lastUpdated: 'November 4, 2026',
      effectiveDate: 'November 4, 2026',
    },
    security: {
      version: '1.0.0',
      lastUpdated: 'November 4, 2026',
      effectiveDate: 'November 4, 2026',
    },
  },
};

/**
 * Scans siteConfig for placeholders and returns an array of unconfirmed items.
 * Used for development warnings and launch readiness checks.
 */
export function getUnconfirmedPlaceholders(): { key: string; placeholder: string }[] {
  const unconfirmed: { key: string; placeholder: string }[] = [];

  function scan(obj: any, prefix = '') {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        if (v.includes('[TO BE CONFIRMED:')) {
          unconfirmed.push({ key: fullKey, placeholder: v });
        }
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        scan(v, fullKey);
      }
    }
  }

  scan(siteConfig);
  return unconfirmed;
}

export const SITE_CONFIG = siteConfig;

// Runtime warning in non-production environments to ensure launch visibility
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  const placeholders = getUnconfirmedPlaceholders();
  if (placeholders.length > 0) {
    // Log once on module load
    console.info(`[FlowDesk SiteConfig] ${placeholders.length} legal placeholders active awaiting owner confirmation.`);
  }
}
