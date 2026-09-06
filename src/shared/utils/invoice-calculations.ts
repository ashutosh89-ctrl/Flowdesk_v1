/**
 * Invoice Calculation Utilities — Single Source of Truth
 *
 * All invoice financial calculations MUST go through these functions.
 * No other file should independently calculate invoice totals.
 */

import { InvoiceItem, InvoiceNumberFormatPreset, InvoiceNumberingSettings, UserSettings } from '@/shared/types';

export interface InvoiceCalculationInput {
  items: { quantity: number; rate: number }[];
  taxPercentage?: number | null;
  discount?: number | null;
}

export interface InvoiceCalculationResult {
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  discount: number;
  total: number;
  lineAmounts: number[];
}

/**
 * Round a monetary value to 2 decimal places.
 * Uses the "round half up" strategy for consistent money handling.
 */
export function roundCurrency(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate line item amount: quantity × rate
 */
export function calculateLineAmount(quantity: number, rate: number): number {
  const qty = Number(quantity) || 0;
  const r = Number(rate) || 0;
  return roundCurrency(Math.max(0, qty * r));
}

/**
 * Calculate all invoice totals from line items, tax percentage, and flat discount.
 * This is the SINGLE canonical calculation for all invoice financials across UI, PDF, and services.
 */
export function calculateInvoiceTotals(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const { items, taxPercentage, discount } = input;

  // Safe tax percentage handling — 0% is a valid tax rate and must NEVER be replaced by a fallback default
  const safeTaxPercentage =
    taxPercentage !== undefined && taxPercentage !== null && !isNaN(Number(taxPercentage))
      ? Math.max(0, Number(taxPercentage))
      : 0;

  // Calculate individual line amounts
  const lineAmounts = (items || []).map((item) => calculateLineAmount(item.quantity, item.rate));

  // Subtotal = sum of all line amounts
  const subtotal = roundCurrency(lineAmounts.reduce((sum, amount) => sum + amount, 0));

  // Tax = subtotal × taxPercentage / 100
  const taxAmount = roundCurrency(subtotal * (safeTaxPercentage / 100));

  // Discount = clamped to [0, subtotal]
  const safeDiscount = roundCurrency(
    Math.max(0, Math.min(Number(discount) || 0, subtotal))
  );

  // Total = subtotal + taxAmount - safeDiscount
  const total = roundCurrency(Math.max(0, subtotal + taxAmount - safeDiscount));

  return {
    subtotal,
    taxPercentage: safeTaxPercentage,
    taxAmount,
    discount: safeDiscount,
    total,
    lineAmounts,
  };
}

/**
 * Calculate remaining balance for an invoice.
 */
export function calculateRemainingBalance(total: number, paidAmount: number): number {
  const tot = Number(total) || 0;
  const paid = Number(paidAmount) || 0;
  return roundCurrency(Math.max(0, tot - paid));
}

/**
 * Determine the effective payment status based on paid amount vs total.
 */
export function derivePaymentStatus(
  total: number,
  paidAmount: number
): 'paid' | 'partially_paid' | 'pending' {
  const paid = roundCurrency(Number(paidAmount) || 0);
  const tot = roundCurrency(Number(total) || 0);

  if (paid >= tot && tot > 0) return 'paid';
  if (paid > 0 && paid < tot) return 'partially_paid';
  return 'pending';
}

/**
 * Determine if an invoice is overdue based on due date and payment status.
 * Evaluates date-only comparison so an invoice due today is NOT overdue until tomorrow.
 */
export function isInvoiceOverdue(
  dueDate: string,
  paymentStatus: string,
  workflowStatus: string
): boolean {
  if (paymentStatus === 'paid') return false;
  if (workflowStatus === 'cancelled' || workflowStatus === 'draft') return false;
  if (!dueDate) return false;

  const todayStr = new Date().toISOString().split('T')[0];
  // Strictly overdue only if the due date has already passed
  return dueDate < todayStr;
}

/**
 * Sanitizes invoice prefix: removes spaces, control characters, limits length.
 */
export function sanitizeInvoicePrefix(rawPrefix?: string): string {
  if (!rawPrefix) return 'INV';
  // Allow letters, numbers, hyphens, and underscores, max 12 chars
  const sanitized = rawPrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  return sanitized.slice(0, 12) || 'INV';
}

/**
 * Resolves full numbering settings from preset, UserSettings, or custom configuration.
 */
export function resolveNumberingConfig(
  config?: InvoiceNumberingSettings | UserSettings | string
): Required<InvoiceNumberingSettings> {
  if (typeof config === 'string') {
    // Backward compatibility with raw prefix strings like "INV-" or "BILL-"
    const clean = sanitizeInvoicePrefix(config);
    return {
      format: 'prefix_year_sequence',
      prefix: clean,
      separator: '-',
      includeYear: true,
      padding: 4,
      nextSequence: 1,
      annualReset: false,
    };
  }

  // Handle UserSettings / InvoiceNumberingSettings
  const cfg = config as any;
  const format: InvoiceNumberFormatPreset = cfg?.invoice_number_format || cfg?.format || 'prefix_year_sequence';
  const rawPrefix = cfg?.invoice_prefix !== undefined ? cfg.invoice_prefix : cfg?.prefix;
  const rawSeparator = cfg?.invoice_separator !== undefined ? cfg.invoice_separator : cfg?.separator;
  const rawIncludeYear = cfg?.invoice_include_year !== undefined ? cfg.invoice_include_year : cfg?.includeYear;
  const rawPadding = cfg?.invoice_padding !== undefined ? cfg.invoice_padding : cfg?.padding;
  const rawNextSequence = cfg?.invoice_next_sequence !== undefined ? cfg.invoice_next_sequence : cfg?.nextSequence;
  const rawAnnualReset = cfg?.invoice_annual_reset !== undefined ? cfg.invoice_annual_reset : cfg?.annualReset;

  switch (format) {
    case 'prefix_sequence': // e.g. INV-0001
      return {
        format: 'prefix_sequence',
        prefix: sanitizeInvoicePrefix(rawPrefix || 'INV'),
        separator: rawSeparator !== undefined ? rawSeparator : '-',
        includeYear: false,
        padding: Math.max(1, Math.min(5, Number(rawPadding) || 4)),
        nextSequence: Math.max(1, Number(rawNextSequence) || 1),
        annualReset: false,
      };
    case 'prefix_year_sequence': // e.g. INV-2026-0001
      return {
        format: 'prefix_year_sequence',
        prefix: sanitizeInvoicePrefix(rawPrefix || 'INV'),
        separator: rawSeparator !== undefined ? rawSeparator : '-',
        includeYear: true,
        padding: Math.max(1, Math.min(5, Number(rawPadding) || 4)),
        nextSequence: Math.max(1, Number(rawNextSequence) || 1),
        annualReset: Boolean(rawAnnualReset),
      };
    case 'bill_sequence': // e.g. BILL-0001
      return {
        format: 'bill_sequence',
        prefix: 'BILL',
        separator: rawSeparator !== undefined ? rawSeparator : '-',
        includeYear: false,
        padding: Math.max(1, Math.min(5, Number(rawPadding) || 4)),
        nextSequence: Math.max(1, Number(rawNextSequence) || 1),
        annualReset: false,
      };
    case 'bill_year_sequence': // e.g. BILL-2026-0001
      return {
        format: 'bill_year_sequence',
        prefix: 'BILL',
        separator: rawSeparator !== undefined ? rawSeparator : '-',
        includeYear: true,
        padding: Math.max(1, Math.min(5, Number(rawPadding) || 4)),
        nextSequence: Math.max(1, Number(rawNextSequence) || 1),
        annualReset: Boolean(rawAnnualReset),
      };
    case 'year_sequence': // e.g. 2026-0001
      return {
        format: 'year_sequence',
        prefix: '',
        separator: rawSeparator !== undefined ? rawSeparator : '-',
        includeYear: true,
        padding: Math.max(1, Math.min(5, Number(rawPadding) || 4)),
        nextSequence: Math.max(1, Number(rawNextSequence) || 1),
        annualReset: true,
      };
    case 'custom':
    default:
      return {
        format: 'custom',
        prefix: rawPrefix !== undefined ? sanitizeInvoicePrefix(rawPrefix) : 'INV',
        separator: rawSeparator !== undefined ? rawSeparator : '-',
        includeYear: rawIncludeYear !== undefined ? Boolean(rawIncludeYear) : true,
        padding: Math.max(1, Math.min(5, Number(rawPadding) || 4)),
        nextSequence: Math.max(1, Number(rawNextSequence) || 1),
        annualReset: Boolean(rawAnnualReset),
      };
  }
}

/**
 * Formats an invoice number string given configuration parts and sequence number.
 */
export function formatInvoiceNumber(
  config: InvoiceNumberingSettings | UserSettings | string,
  sequence: number,
  customYear?: number
): string {
  const resolved = resolveNumberingConfig(config);
  const year = customYear || new Date().getFullYear();
  const sep = resolved.separator ?? '-';
  const paddedSeq = String(Math.max(1, sequence)).padStart(resolved.padding, '0');

  const parts: string[] = [];
  if (resolved.prefix && resolved.prefix.length > 0) {
    parts.push(resolved.prefix);
  }
  if (resolved.includeYear) {
    parts.push(String(year));
  }

  if (parts.length === 0) {
    return paddedSeq;
  }

  return `${parts.join(sep)}${sep}${paddedSeq}`;
}

/**
 * Generates the next sequential, workspace-scoped collision-free invoice number.
 * Concurrency & Collision Safe: Inspects all existing invoices to guarantee strict uniqueness.
 */
export function generateNextInvoiceNumber(
  config?: InvoiceNumberingSettings | UserSettings | string,
  existingNumbers: string[] = [],
  customYear?: number
): string {
  const resolved = resolveNumberingConfig(config);
  const year = customYear || new Date().getFullYear();
  const sep = resolved.separator ?? '-';

  // Build prefix matcher (e.g. "INV-2026-" or "BILL-" or "2026-")
  const parts: string[] = [];
  if (resolved.prefix && resolved.prefix.length > 0) {
    parts.push(resolved.prefix);
  }
  if (resolved.includeYear) {
    parts.push(String(year));
  }

  const matchPrefix = parts.length > 0 ? `${parts.join(sep)}${sep}` : '';

  let maxFoundSeq = 0;
  for (const num of existingNumbers) {
    if (!num) continue;
    if (matchPrefix && num.startsWith(matchPrefix)) {
      const remainder = num.slice(matchPrefix.length);
      const parsed = parseInt(remainder, 10);
      if (!isNaN(parsed) && parsed > maxFoundSeq) {
        maxFoundSeq = parsed;
      }
    } else if (!matchPrefix) {
      // Pure numbers like 0001
      const parsed = parseInt(num, 10);
      if (!isNaN(parsed) && parsed > maxFoundSeq) {
        maxFoundSeq = parsed;
      }
    }
  }

  // Next sequence is at least the configured starting sequence, or maxFound + 1
  const startingSeq = Math.max(1, resolved.nextSequence || 1);
  const nextSeq = Math.max(startingSeq, maxFoundSeq + 1);

  return formatInvoiceNumber(resolved, nextSeq, year);
}

/**
 * Validate invoice data before persistence.
 * Returns an array of error messages. Empty array = valid.
 */
export function validateInvoice(data: {
  invoiceNumber?: string;
  clientId?: string;
  issueDate?: string;
  dueDate?: string;
  items?: InvoiceItem[];
  taxPercentage?: number;
  discount?: number;
  currency?: string;
}): string[] {
  const errors: string[] = [];

  // Invoice number
  if (!data.invoiceNumber || data.invoiceNumber.trim().length === 0) {
    errors.push('Invoice number is required.');
  } else if (data.invoiceNumber.length > 100) {
    errors.push('Invoice number must be 100 characters or fewer.');
  }

  // Client
  if (!data.clientId || data.clientId.trim().length === 0) {
    errors.push('Client is required.');
  }

  // Issue date
  if (!data.issueDate || data.issueDate.trim().length === 0) {
    errors.push('Issue date is required.');
  } else if (isNaN(Date.parse(data.issueDate))) {
    errors.push('Issue date must be a valid date.');
  }

  // Due date
  if (!data.dueDate || data.dueDate.trim().length === 0) {
    errors.push('Due date is required.');
  } else if (isNaN(Date.parse(data.dueDate))) {
    errors.push('Due date must be a valid date.');
  }

  // Due date vs issue date
  if (data.issueDate && data.dueDate && !isNaN(Date.parse(data.issueDate)) && !isNaN(Date.parse(data.dueDate))) {
    if (new Date(data.dueDate).getTime() < new Date(data.issueDate).getTime()) {
      errors.push('Due date must not be before issue date.');
    }
  }

  // Line items
  if (!data.items || data.items.length === 0) {
    errors.push('At least one line item is required.');
  } else {
    data.items.forEach((item, index) => {
      if (!item.description || item.description.trim().length === 0) {
        errors.push(`Line item ${index + 1}: description is required.`);
      }
      if (Number(item.quantity) <= 0 || !Number.isFinite(Number(item.quantity))) {
        errors.push(`Line item ${index + 1}: quantity must be greater than 0.`);
      }
      if (Number(item.rate) < 0 || !Number.isFinite(Number(item.rate))) {
        errors.push(`Line item ${index + 1}: rate must be 0 or greater.`);
      }
    });
  }

  // Tax percentage
  if (data.taxPercentage !== undefined && data.taxPercentage !== null) {
    if (Number(data.taxPercentage) < 0 || Number(data.taxPercentage) > 100) {
      errors.push('Tax percentage must be between 0 and 100.');
    }
  }

  // Discount
  if (data.discount !== undefined && data.discount !== null) {
    if (Number(data.discount) < 0 || !Number.isFinite(Number(data.discount))) {
      errors.push('Discount must be a non-negative number.');
    }
  }

  return errors;
}
