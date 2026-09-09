/**
 * High-accuracy Number to Words converter supporting both Indian numbering format
 * (Crores, Lakhs, Thousands, Hundreds) for INR, and International numbering format
 * (Billions, Millions, Thousands) for USD, EUR, GBP, etc.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

/**
 * Converts a 2-digit number (0-99) into words.
 */
function convertTwoDigits(num: number): string {
  if (num < 20) {
    return ONES[num];
  }
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return TENS[ten] + (one > 0 ? ' ' + ONES[one] : '');
}

/**
 * Converts a 3-digit number (0-999) into words.
 */
function convertThreeDigits(num: number): string {
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  let result = '';

  if (hundred > 0) {
    result += ONES[hundred] + ' Hundred';
    if (remainder > 0) {
      result += ' and ';
    }
  }

  if (remainder > 0) {
    result += convertTwoDigits(remainder);
  }

  return result.trim();
}

/**
 * Converts an integer using the Indian numbering system (Lakhs, Crores).
 */
function convertIndianNumber(num: number): string {
  if (num === 0) return 'Zero';

  const parts: string[] = [];

  const crores = Math.floor(num / 10000000);
  num %= 10000000;

  const lakhs = Math.floor(num / 100000);
  num %= 100000;

  const thousands = Math.floor(num / 1000);
  num %= 1000;

  const hundredsAndUnits = num;

  if (crores > 0) {
    parts.push(`${convertIndianNumber(crores)} Crore`);
  }
  if (lakhs > 0) {
    parts.push(`${convertTwoDigits(lakhs)} Lakh`);
  }
  if (thousands > 0) {
    parts.push(`${convertTwoDigits(thousands)} Thousand`);
  }
  if (hundredsAndUnits > 0) {
    parts.push(convertThreeDigits(hundredsAndUnits));
  }

  return parts.join(' ').trim();
}

/**
 * Converts an integer using the International numbering system (Billions, Millions, Thousands).
 */
function convertInternationalNumber(num: number): string {
  if (num === 0) return 'Zero';

  const parts: string[] = [];

  const billions = Math.floor(num / 1000000000);
  num %= 1000000000;

  const millions = Math.floor(num / 1000000);
  num %= 1000000;

  const thousands = Math.floor(num / 1000);
  num %= 1000;

  const hundreds = num;

  if (billions > 0) {
    parts.push(`${convertThreeDigits(billions)} Billion`);
  }
  if (millions > 0) {
    parts.push(`${convertThreeDigits(millions)} Million`);
  }
  if (thousands > 0) {
    parts.push(`${convertThreeDigits(thousands)} Thousand`);
  }
  if (hundreds > 0) {
    parts.push(convertThreeDigits(hundreds));
  }

  return parts.join(' ').trim();
}

export interface AmountInWordsOptions {
  currency?: string;
  showPrefix?: boolean;
}

/**
 * Converts a monetary amount to a formal representation in words.
 *
 * Examples:
 * 431, 'INR' => "Rupees Four Hundred and Thirty One Only"
 * 410.50, 'INR' => "Rupees Four Hundred and Ten and Fifty Paise Only"
 * 1250.75, 'USD' => "US Dollars One Thousand Two Hundred and Fifty and Seventy Five Cents Only"
 */
export function convertAmountToWords(
  amount: number,
  currency: string = 'INR',
  _options: { showCurrencyName?: boolean } = {}
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  const upperCurrency = (currency || 'INR').toUpperCase();
  const isINR = upperCurrency === 'INR' || upperCurrency === '₹' || upperCurrency === 'RS';

  let currencyName = 'Rupees';
  let subunitName = 'Paise';

  if (isINR) {
    currencyName = 'Rupees';
    subunitName = 'Paise';
  } else if (upperCurrency === 'USD') {
    currencyName = 'US Dollars';
    subunitName = 'Cents';
  } else if (upperCurrency === 'EUR') {
    currencyName = 'Euros';
    subunitName = 'Cents';
  } else if (upperCurrency === 'GBP') {
    currencyName = 'Pounds';
    subunitName = 'Pence';
  } else if (upperCurrency === 'CAD') {
    currencyName = 'Canadian Dollars';
    subunitName = 'Cents';
  } else if (upperCurrency === 'AUD') {
    currencyName = 'Australian Dollars';
    subunitName = 'Cents';
  } else {
    currencyName = upperCurrency;
    subunitName = 'Cents';
  }

  const integerWords = isINR
    ? convertIndianNumber(integerPart)
    : convertInternationalNumber(integerPart);

  let result = '';

  if (integerPart === 0 && decimalPart === 0) {
    result = `${currencyName} Zero Only`;
    return isNegative ? `Minus ${result}` : result;
  }

  if (integerPart > 0) {
    result = `${currencyName} ${integerWords}`;
  }

  if (decimalPart > 0) {
    const decimalWords = convertTwoDigits(decimalPart);
    if (integerPart > 0) {
      result += ` and ${decimalWords} ${subunitName}`;
    } else {
      result = `${decimalWords} ${subunitName}`;
    }
  }

  result = `${result.trim()} Only`;

  if (isNegative) {
    result = `Minus ${result}`;
  }

  return result;
}
