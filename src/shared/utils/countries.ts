/**
 * FlowDesk Country & Phone Region Master Configuration
 * Comprehensive ISO 3166-1 alpha-2 country registry with dial codes,
 * flags, and country-aware phone normalization & validation.
 *
 * Default country throughout FlowDesk is India (IN, +91).
 */

export interface CountryInfo {
  name: string;
  code: string; // ISO 3166-1 alpha-2 (e.g., 'IN', 'US', 'GB')
  dialCode: string; // e.g., '+91', '+1', '+44'
  flag: string; // Emoji flag
  example: string;
  minDigits: number;
  maxDigits: number;
  regex?: RegExp;
}

export const DEFAULT_COUNTRY = 'India';
export const DEFAULT_COUNTRY_CODE = 'IN';
export const DEFAULT_DIAL_CODE = '+91';

export const COUNTRIES: CountryInfo[] = [
  {
    name: 'India',
    code: 'IN',
    dialCode: '+91',
    flag: '🇮🇳',
    example: '98765 43210',
    minDigits: 10,
    maxDigits: 10,
    regex: /^[6-9]\d{9}$/,
  },
  {
    name: 'United States',
    code: 'US',
    dialCode: '+1',
    flag: '🇺🇸',
    example: '(555) 000-0000',
    minDigits: 10,
    maxDigits: 10,
    regex: /^[2-9]\d{9}$/,
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    dialCode: '+44',
    flag: '🇬🇧',
    example: '7911 123456',
    minDigits: 10,
    maxDigits: 11,
    regex: /^7\d{9}$/,
  },
  {
    name: 'Canada',
    code: 'CA',
    dialCode: '+1',
    flag: '🇨🇦',
    example: '(416) 555-0199',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Australia',
    code: 'AU',
    dialCode: '+61',
    flag: '🇦🇺',
    example: '412 345 678',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'Germany',
    code: 'DE',
    dialCode: '+49',
    flag: '🇩🇪',
    example: '151 23456789',
    minDigits: 10,
    maxDigits: 12,
  },
  {
    name: 'France',
    code: 'FR',
    dialCode: '+33',
    flag: '🇫🇷',
    example: '6 12 34 56 78',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    dialCode: '+971',
    flag: '🇦🇪',
    example: '50 123 4567',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Singapore',
    code: 'SG',
    dialCode: '+65',
    flag: '🇸🇬',
    example: '8123 4567',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    name: 'Japan',
    code: 'JP',
    dialCode: '+81',
    flag: '🇯🇵',
    example: '90 1234 5678',
    minDigits: 10,
    maxDigits: 11,
  },
  {
    name: 'Switzerland',
    code: 'CH',
    dialCode: '+41',
    flag: '🇨🇭',
    example: '78 123 45 67',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'Netherlands',
    code: 'NL',
    dialCode: '+31',
    flag: '🇳🇱',
    example: '6 12345678',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'Spain',
    code: 'ES',
    dialCode: '+34',
    flag: '🇪🇸',
    example: '612 34 56 78',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Italy',
    code: 'IT',
    dialCode: '+39',
    flag: '🇮🇹',
    example: '312 345 6789',
    minDigits: 9,
    maxDigits: 11,
  },
  {
    name: 'Brazil',
    code: 'BR',
    dialCode: '+55',
    flag: '🇧🇷',
    example: '11 91234-5678',
    minDigits: 10,
    maxDigits: 11,
  },
  {
    name: 'Mexico',
    code: 'MX',
    dialCode: '+52',
    flag: '🇲🇽',
    example: '55 1234 5678',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Saudi Arabia',
    code: 'SA',
    dialCode: '+966',
    flag: '🇸🇦',
    example: '50 123 4567',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'South Africa',
    code: 'ZA',
    dialCode: '+27',
    flag: '🇿🇦',
    example: '82 123 4567',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'New Zealand',
    code: 'NZ',
    dialCode: '+64',
    flag: '🇳🇿',
    example: '21 123 4567',
    minDigits: 8,
    maxDigits: 10,
  },
  {
    name: 'Ireland',
    code: 'IE',
    dialCode: '+353',
    flag: '🇮🇪',
    example: '87 123 4567',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Sweden',
    code: 'SE',
    dialCode: '+46',
    flag: '🇸🇪',
    example: '70 123 45 67',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'Norway',
    code: 'NO',
    dialCode: '+47',
    flag: '🇳🇴',
    example: '412 34 567',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    name: 'Denmark',
    code: 'DK',
    dialCode: '+45',
    flag: '🇩🇰',
    example: '20 12 34 56',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    name: 'Finland',
    code: 'FI',
    dialCode: '+358',
    flag: '🇫🇮',
    example: '40 1234567',
    minDigits: 8,
    maxDigits: 10,
  },
  {
    name: 'Poland',
    code: 'PL',
    dialCode: '+48',
    flag: '🇵🇱',
    example: '512 345 678',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Portugal',
    code: 'PT',
    dialCode: '+351',
    flag: '🇵🇹',
    example: '912 345 678',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Israel',
    code: 'IL',
    dialCode: '+972',
    flag: '🇮🇱',
    example: '50 123 4567',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Hong Kong',
    code: 'HK',
    dialCode: '+852',
    flag: '🇭🇰',
    example: '9123 4567',
    minDigits: 8,
    maxDigits: 8,
  },
  {
    name: 'Indonesia',
    code: 'ID',
    dialCode: '+62',
    flag: '🇮🇩',
    example: '812 3456 7890',
    minDigits: 9,
    maxDigits: 12,
  },
  {
    name: 'Malaysia',
    code: 'MY',
    dialCode: '+60',
    flag: '🇲🇾',
    example: '12 345 6789',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'Thailand',
    code: 'TH',
    dialCode: '+66',
    flag: '🇹🇭',
    example: '81 234 5678',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Vietnam',
    code: 'VN',
    dialCode: '+84',
    flag: '🇻🇳',
    example: '91 234 5678',
    minDigits: 9,
    maxDigits: 10,
  },
  {
    name: 'Philippines',
    code: 'PH',
    dialCode: '+63',
    flag: '🇵🇭',
    example: '917 123 4567',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Egypt',
    code: 'EG',
    dialCode: '+20',
    flag: '🇪🇬',
    example: '100 123 4567',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Nigeria',
    code: 'NG',
    dialCode: '+234',
    flag: '🇳🇬',
    example: '802 123 4567',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Kenya',
    code: 'KE',
    dialCode: '+254',
    flag: '🇰🇪',
    example: '712 345678',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Argentina',
    code: 'AR',
    dialCode: '+54',
    flag: '🇦🇷',
    example: '9 11 1234-5678',
    minDigits: 10,
    maxDigits: 11,
  },
  {
    name: 'Chile',
    code: 'CL',
    dialCode: '+56',
    flag: '🇨🇱',
    example: '9 1234 5678',
    minDigits: 9,
    maxDigits: 9,
  },
  {
    name: 'Colombia',
    code: 'CO',
    dialCode: '+57',
    flag: '🇨🇴',
    example: '300 123 4567',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Turkey',
    code: 'TR',
    dialCode: '+90',
    flag: '🇹🇷',
    example: '532 123 4567',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Greece',
    code: 'GR',
    dialCode: '+30',
    flag: '🇬🇷',
    example: '691 234 5678',
    minDigits: 10,
    maxDigits: 10,
  },
  {
    name: 'Austria',
    code: 'AT',
    dialCode: '+43',
    flag: '🇦🇹',
    example: '664 1234567',
    minDigits: 9,
    maxDigits: 11,
  },
  {
    name: 'Belgium',
    code: 'BE',
    dialCode: '+32',
    flag: '🇧🇪',
    example: '470 12 34 56',
    minDigits: 9,
    maxDigits: 9,
  },
];

/**
 * Finds CountryInfo by exact ISO Code, Country Name, or Dial Code
 */
export function getCountryByNameOrCode(query?: string | null): CountryInfo {
  if (!query || !query.trim()) {
    return COUNTRIES[0]; // Default India
  }

  const q = query.trim().toLowerCase();

  // 1. Match code (e.g. "IN", "US")
  const byCode = COUNTRIES.find((c) => c.code.toLowerCase() === q);
  if (byCode) return byCode;

  // 2. Match name (e.g. "India", "United States", "UK")
  if (q === 'uk') return COUNTRIES.find((c) => c.code === 'GB') || COUNTRIES[0];
  if (q === 'usa' || q === 'united states of america') return COUNTRIES.find((c) => c.code === 'US') || COUNTRIES[0];
  if (q === 'uae') return COUNTRIES.find((c) => c.code === 'AE') || COUNTRIES[0];

  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === q);
  if (byName) return byName;

  // 3. Match dial code (e.g. "+91")
  const byDial = COUNTRIES.find((c) => c.dialCode === query.trim());
  if (byDial) return byDial;

  // Fallback to default India if not found
  return COUNTRIES[0];
}

/**
 * Returns the dial code for a given country name or code (defaults to "+91")
 */
export function getDialCodeForCountry(country?: string | null): string {
  return getCountryByNameOrCode(country).dialCode;
}

/**
 * Extracts national digits from a raw phone string by stripping known dial codes
 * and special characters, preventing duplicated prefixes (e.g. "+91+91", "+91+1").
 */
export function extractNationalDigits(phone: string, currentCountry?: string): { dialCode: string; nationalDigits: string } {
  if (!phone || !phone.trim()) {
    const defaultInfo = getCountryByNameOrCode(currentCountry);
    return { dialCode: defaultInfo.dialCode, nationalDigits: '' };
  }

  let cleaned = phone.trim();

  // Strip repeated leading plus signs and prefixes if any
  cleaned = cleaned.replace(/^\++/, '+');

  // Check if phone starts with any known country dial code
  // Sort by length desc so longer dial codes like +353, +971 match before +1 or +9
  const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

  for (const c of sortedCountries) {
    if (cleaned.startsWith(c.dialCode)) {
      let nationalPart = cleaned.slice(c.dialCode.length).trim();
      // Remove any secondary dial code if accidentally concatenated (e.g., "+91+1555...")
      for (const sub of sortedCountries) {
        if (nationalPart.startsWith(sub.dialCode)) {
          nationalPart = nationalPart.slice(sub.dialCode.length).trim();
          break;
        }
      }
      const digits = nationalPart.replace(/\D/g, '');
      return { dialCode: c.dialCode, nationalDigits: digits };
    }
  }

  // If no prefix was detected, resolve country dialCode
  const targetCountry = getCountryByNameOrCode(currentCountry);
  const digits = cleaned.replace(/\D/g, '');
  return { dialCode: targetCountry.dialCode, nationalDigits: digits };
}

/**
 * Switches the phone number prefix when the user changes country selection.
 * Guarantees that prefix is replaced cleanly without duplicating prefixes.
 *
 * Example:
 * switchCountryPrefix('+91 9876543210', 'India', 'United States') -> '+1 9876543210'
 * switchCountryPrefix('+1 (555) 000-0000', 'US', 'India') -> '+91 5550000000'
 */
export function switchCountryPrefix(currentPhone: string, _oldCountry: string, newCountry: string): string {
  const newCountryInfo = getCountryByNameOrCode(newCountry);
  const { nationalDigits } = extractNationalDigits(currentPhone, _oldCountry);

  if (!nationalDigits) {
    return `${newCountryInfo.dialCode} `;
  }

  return `${newCountryInfo.dialCode} ${nationalDigits}`;
}

/**
 * Validates whether a phone number matches international standards or
 * country-specific requirements.
 */
export function validateInternationalPhone(
  phone: string,
  country?: string
): { isValid: boolean; error?: string } {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  const countryInfo = getCountryByNameOrCode(country);
  const { nationalDigits } = extractNationalDigits(phone, country);

  if (!nationalDigits) {
    return { isValid: false, error: 'Please enter phone number digits.' };
  }

  if (nationalDigits.length < (countryInfo.minDigits || 7)) {
    return {
      isValid: false,
      error: `Phone number is too short for ${countryInfo.name} (minimum ${countryInfo.minDigits} digits required).`,
    };
  }

  if (nationalDigits.length > (countryInfo.maxDigits || 15)) {
    return {
      isValid: false,
      error: `Phone number exceeds maximum allowed length (${countryInfo.maxDigits} digits).`,
    };
  }

  if (countryInfo.regex && !countryInfo.regex.test(nationalDigits)) {
    return {
      isValid: false,
      error: `Invalid phone format for ${countryInfo.name}. Example: ${countryInfo.dialCode} ${countryInfo.example}`,
    };
  }

  return { isValid: true };
}

/**
 * Normalizes phone number into consistent canonical international format:
 * `+<DialCode> <Digits>`
 */
export function formatCanonicalPhone(phone: string, country?: string): string {
  const countryInfo = getCountryByNameOrCode(country);
  const { dialCode, nationalDigits } = extractNationalDigits(phone, country);

  if (!nationalDigits) {
    return '';
  }

  const resolvedDial = dialCode || countryInfo.dialCode;
  return `${resolvedDial} ${nationalDigits}`;
}
