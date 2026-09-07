/**
 * FlowDesk Country & Phone Validation Test Suite
 * Validates India default, prefix auto-selection, deduplication, and country-aware international validation.
 *
 * Run: npx tsx tests/country-phone-validation.test.ts
 */

import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_DIAL_CODE,
  getCountryByNameOrCode,
  getDialCodeForCountry,
  extractNationalDigits,
  switchCountryPrefix,
  validateInternationalPhone,
  formatCanonicalPhone,
} from '../src/shared/utils/countries';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🌐 FLOWDESK COUNTRY & PHONE REGION MASTER TEST SUITE');
  console.log('================================================================\n');

  console.log('--- SECTION 1: Country Registry & Defaults ---');
  // 1. Default country must be India (IN, +91)
  assert(DEFAULT_COUNTRY === 'India', 'Default country constant is India');
  assert(DEFAULT_COUNTRY_CODE === 'IN', 'Default country code is IN');
  assert(DEFAULT_DIAL_CODE === '+91', 'Default dial code is +91');

  // 2. Empty or null lookup defaults to India
  const emptyLookup = getCountryByNameOrCode(null);
  assert(emptyLookup.name === 'India' && emptyLookup.dialCode === '+91', 'getCountryByNameOrCode(null) defaults to India (+91)');

  const undefinedLookup = getCountryByNameOrCode(undefined);
  assert(undefinedLookup.name === 'India' && undefinedLookup.dialCode === '+91', 'getCountryByNameOrCode(undefined) defaults to India (+91)');

  const blankLookup = getCountryByNameOrCode('   ');
  assert(blankLookup.name === 'India' && blankLookup.dialCode === '+91', 'getCountryByNameOrCode("") defaults to India (+91)');

  // 3. Lookup by code or name
  assert(getCountryByNameOrCode('IN').dialCode === '+91', 'Lookup by ISO code "IN" returns +91');
  assert(getCountryByNameOrCode('US').dialCode === '+1', 'Lookup by ISO code "US" returns +1');
  assert(getCountryByNameOrCode('GB').dialCode === '+44', 'Lookup by ISO code "GB" returns +44');
  assert(getCountryByNameOrCode('AE').dialCode === '+971', 'Lookup by ISO code "AE" returns +971');
  assert(getCountryByNameOrCode('United States').dialCode === '+1', 'Lookup by name "United States" returns +1');
  assert(getCountryByNameOrCode('United Kingdom').dialCode === '+44', 'Lookup by name "United Kingdom" returns +44');
  assert(getCountryByNameOrCode('Germany').dialCode === '+49', 'Lookup by name "Germany" returns +49');

  console.log('\n--- SECTION 2: Dial Code Extraction & Prefix Deduplication ---');
  // 4. Extract digits without prefix doubling
  const extractIndia = extractNationalDigits('+91 9876543210', 'India');
  assert(extractIndia.dialCode === '+91' && extractIndia.nationalDigits === '9876543210', 'extractNationalDigits extracts India number cleanly');

  const extractUS = extractNationalDigits('+1 (555) 234-5678', 'United States');
  assert(extractUS.dialCode === '+1' && extractUS.nationalDigits === '5552345678', 'extractNationalDigits extracts US number cleanly');

  // 5. Detect and clean concatenated prefixes e.g. "+91+919876543210" or "+91+15551234567"
  const extractDouble = extractNationalDigits('+91+919876543210', 'India');
  assert(extractDouble.nationalDigits === '9876543210', 'extractNationalDigits strips duplicated +91+91 prefix');

  const extractCross = extractNationalDigits('+91+15551234567', 'India');
  assert(extractCross.nationalDigits === '5551234567', 'extractNationalDigits strips concatenated cross-dial prefix');

  console.log('\n--- SECTION 3: Dynamic Country Switching & Prefix Replacement ---');
  // 6. Switch from India to US
  const switchedToUS = switchCountryPrefix('+91 9876543210', 'India', 'United States');
  assert(switchedToUS === '+1 9876543210', 'switchCountryPrefix from India to US produces +1 9876543210');

  // 7. Switch from US to India
  const switchedToIndia = switchCountryPrefix('+1 (555) 234-5678', 'United States', 'India');
  assert(switchedToIndia === '+91 5552345678', 'switchCountryPrefix from US to India produces +91 5552345678');

  // 8. Switch from empty string produces only new dialCode with space
  const switchedEmpty = switchCountryPrefix('', 'India', 'United Kingdom');
  assert(switchedEmpty === '+44 ', 'switchCountryPrefix on empty string sets new prefix "+44 "');

  console.log('\n--- SECTION 4: International Phone Number Validation ---');
  // 9. Valid Indian mobile numbers (10 digits starting with 6-9)
  assert(validateInternationalPhone('+91 9876543210', 'India').isValid === true, 'Valid 10-digit Indian mobile is accepted');
  assert(validateInternationalPhone('+91 8123456789', 'India').isValid === true, 'Valid 10-digit Indian mobile (8xxx) is accepted');
  assert(validateInternationalPhone('+91 7000000000', 'India').isValid === true, 'Valid 10-digit Indian mobile (7xxx) is accepted');
  assert(validateInternationalPhone('+91 6000000000', 'India').isValid === true, 'Valid 10-digit Indian mobile (6xxx) is accepted');

  // 10. Invalid Indian numbers (short, long, invalid starting digit)
  assert(validateInternationalPhone('+91 1234567890', 'India').isValid === false, 'Indian number starting with 1 is rejected');
  assert(validateInternationalPhone('+91 98765', 'India').isValid === false, 'Indian number with only 5 digits is rejected');

  // 11. Valid US numbers (10 digits starting with 2-9)
  assert(validateInternationalPhone('+1 5552345678', 'United States').isValid === true, 'Valid 10-digit US number is accepted');
  assert(validateInternationalPhone('+1 1552345678', 'United States').isValid === false, 'US number with invalid area code (1xx) is rejected');

  // 12. Valid UK numbers (10-11 digits)
  assert(validateInternationalPhone('+44 7911123456', 'United Kingdom').isValid === true, 'Valid UK mobile is accepted');

  // 13. Valid UAE numbers
  assert(validateInternationalPhone('+971 501234567', 'United Arab Emirates').isValid === true, 'Valid UAE number is accepted');

  console.log('\n--- SECTION 5: Canonical Formatting ---');
  assert(formatCanonicalPhone('9876543210', 'India') === '+91 9876543210', 'formatCanonicalPhone creates canonical +91 format');
  assert(formatCanonicalPhone('+1 555 234 5678', 'United States') === '+1 5552345678', 'formatCanonicalPhone standardizes US format');

  console.log('\n================================================================');
  console.log(`📊 RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
