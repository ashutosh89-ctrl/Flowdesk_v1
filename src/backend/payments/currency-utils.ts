/**
 * Decimal-safe currency subunit conversion utilities for Razorpay
 * Prevents floating point issues (e.g. 19.99 * 100 = 1998.9999999999998)
 */

// Zero-decimal currencies where 1 subunit = 1 main unit
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);

// Three-decimal currencies (1 subunit = 1/1000 main unit)
const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'OMR', 'TND'
]);

// Common supported ISO currencies in Razorpay
const SUPPORTED_CURRENCIES = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'NZD', 'CHF', 'HKD', 'MYR', 'THB', 'JPY'
]);

/**
 * Validates if the given currency code is supported for online payment.
 */
export function isCurrencySupported(currency: string): boolean {
  if (!currency || typeof currency !== 'string') return false;
  return SUPPORTED_CURRENCIES.has(currency.toUpperCase().trim());
}

/**
 * Returns the subunit exponent for the currency (default: 2 for 100 subunits per unit)
 */
export function getCurrencyDecimals(currency: string): number {
  const code = (currency || 'INR').toUpperCase().trim();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/**
 * Converts a decimal amount (e.g. 100.50) to integer currency subunits (e.g. 10050 paise)
 * using exact string-based integer arithmetic to eliminate floating-point imprecision.
 */
export function toSubunits(amount: number, currency: string = 'INR'): bigint {
  if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) {
    return BigInt(Math.round(amount));
  }

  // Format with fixed decimals to avoid exponential notation issues
  const fixedStr = amount.toFixed(decimals);
  const parts = fixedStr.split('.');
  const wholePart = parts[0];
  const fractionalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);

  const subunitStr = `${wholePart}${fractionalPart}`.replace(/^0+(?=\d)/, '');
  return BigInt(subunitStr || '0');
}

/**
 * Converts integer currency subunits back to decimal number format (e.g. 10050 -> 100.50).
 */
export function fromSubunits(subunits: bigint | number, currency: string = 'INR'): number {
  const decimals = getCurrencyDecimals(currency);
  const subNum = typeof subunits === 'bigint' ? Number(subunits) : subunits;

  if (decimals === 0) {
    return subNum;
  }

  const divisor = Math.pow(10, decimals);
  return Number((subNum / divisor).toFixed(decimals));
}

/**
 * Formats a currency amount into a clean display string (e.g. ₹1,250.00 or $1,250.00)
 */
export function formatSubunitsForDisplay(subunits: bigint | number, currency: string = 'INR'): string {
  const amount = fromSubunits(subunits, currency);
  const code = currency.toUpperCase();
  const symbol = code === 'INR' ? '₹' : (code === 'USD' ? '$' : (code === 'EUR' ? '€' : (code === 'GBP' ? '£' : `${code} `)));
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
