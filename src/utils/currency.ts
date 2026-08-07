export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
};

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'INR', label: 'INR (₹)', symbol: '₹' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
  { code: 'GBP', label: 'GBP (£)', symbol: '£' },
  { code: 'AED', label: 'AED (AED)', symbol: 'AED ' },
  { code: 'CAD', label: 'CAD (CA$)', symbol: 'CA$' },
  { code: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
  { code: 'JPY', label: 'JPY (¥)', symbol: '¥' },
];

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || '$';
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formattedNumber = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formattedNumber}`;
}
