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
  domain: string;
  siteUrl: string;
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
  legalEntityName: 'FlowDesk',
  domain: 'www.flow-desk.live',
  siteUrl: 'https://www.flow-desk.live',
  supportEmail: 'flowdesk11@gmail.com',
  privacyEmail: 'flowdesk11@gmail.com',
  securityEmail: 'flowdesk11@gmail.com',
  contactResponseTarget: 'Within 1-2 business days',

  registeredAddress: {
    line1: 'FlowDesk Support Desk',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110001',
    country: 'India',
  },

  grievanceOfficer: {
    name: 'FlowDesk Support Desk',
    title: 'Privacy and Support Desk',
    email: 'flowdesk11@gmail.com',
    address: 'FlowDesk Support Desk, New Delhi, India',
  },

  governingLaw: {
    country: 'India',
    state: 'Delhi',
    jurisdictionCity: 'New Delhi',
    arbitrationCity: 'New Delhi',
  },

  registration: {
    cin: '',
    gstin: '',
    taxStatement: 'Prices displayed in INR. FlowDesk is operated as an independent software platform and does not claim GST registration or issue GST tax invoices.',
  },

  policies: {
    terms: {
      version: '1.1.0',
      lastUpdated: 'November 7, 2026',
      effectiveDate: 'November 7, 2026',
    },
    privacy: {
      version: '1.1.0',
      lastUpdated: 'November 7, 2026',
      effectiveDate: 'November 7, 2026',
      draftForLegalReview: false,
    },
    refund: {
      version: '1.1.0',
      lastUpdated: 'November 7, 2026',
      effectiveDate: 'November 7, 2026',
    },
    cancellation: {
      version: '1.1.0',
      lastUpdated: 'November 7, 2026',
      effectiveDate: 'November 7, 2026',
    },
    security: {
      version: '1.1.0',
      lastUpdated: 'November 7, 2026',
      effectiveDate: 'November 7, 2026',
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
