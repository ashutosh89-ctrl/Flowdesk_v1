export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (CAD)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (AUD)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)' },
];

export function formatCurrency(amount: number = 0, currency: string = 'USD'): string {
  const curr = SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === (currency || 'USD').toUpperCase()) || SUPPORTED_CURRENCIES[0];
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const isZeroDecimal = curr.code === 'JPY';
  
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  });

  if (curr.code === 'AED') {
    return `AED ${formattedNumber}`;
  }
  return `${curr.symbol}${formattedNumber}`;
}

export function getCurrencySymbol(currency: string = 'USD'): string {
  const curr = SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === (currency || 'USD').toUpperCase());
  return curr?.symbol || '$';
}
