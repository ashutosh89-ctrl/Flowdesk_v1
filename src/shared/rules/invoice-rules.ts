/**
 * Pure Business Rules: Invoices
 *
 * ZERO I/O: Pure deterministic calculations, state transitions, and formatting.
 * Shared directly across server route handlers, backend services, and React UI.
 */

import { InvoiceWorkflowStatus, InvoicePaymentStatus } from '@/shared/types';

export type ActorRole = 'freelancer' | 'client' | 'system';

export interface TransitionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Allowed transitions for invoice workflow lifecycle
 */
export const INVOICE_WORKFLOW_TRANSITION_MAP: Record<
  InvoiceWorkflowStatus,
  { allowedTargets: InvoiceWorkflowStatus[]; allowedRoles: Record<InvoiceWorkflowStatus, ActorRole[]> }
> = {
  draft: {
    allowedTargets: ['sent', 'cancelled'],
    allowedRoles: {
      sent: ['freelancer'],
      cancelled: ['freelancer'],
      draft: ['freelancer'],
      viewed: [],
    },
  },
  sent: {
    allowedTargets: ['viewed', 'cancelled'],
    allowedRoles: {
      viewed: ['client', 'freelancer', 'system'],
      cancelled: ['freelancer'],
      sent: ['freelancer', 'client', 'system'],
      draft: [],
    },
  },
  viewed: {
    allowedTargets: ['cancelled'],
    allowedRoles: {
      cancelled: ['freelancer'],
      viewed: ['client', 'freelancer', 'system'],
      sent: [],
      draft: [],
    },
  },
  cancelled: {
    allowedTargets: [],
    allowedRoles: {
      cancelled: ['freelancer', 'system'],
      draft: [],
      sent: [],
      viewed: [],
    },
  },
};

/**
 * Validates whether an invoice workflow status transition is permissible.
 */
export function canTransitionInvoiceWorkflow(
  current: InvoiceWorkflowStatus | string,
  target: InvoiceWorkflowStatus | string,
  role: ActorRole = 'freelancer'
): TransitionCheckResult {
  // Self-transition (idempotent / no-op)
  if (current === target) {
    return { allowed: true };
  }

  const validStatuses: InvoiceWorkflowStatus[] = ['draft', 'sent', 'viewed', 'cancelled'];
  if (!validStatuses.includes(current as InvoiceWorkflowStatus)) {
    return { allowed: false, reason: `Unknown current status: '${current}'` };
  }
  if (!validStatuses.includes(target as InvoiceWorkflowStatus)) {
    return { allowed: false, reason: `Unknown target status: '${target}'` };
  }

  const rule = INVOICE_WORKFLOW_TRANSITION_MAP[current as InvoiceWorkflowStatus];
  if (!rule.allowedTargets.includes(target as InvoiceWorkflowStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition invoice from '${current}' to '${target}'. Allowed transitions: ${rule.allowedTargets.length ? rule.allowedTargets.join(', ') : 'none (terminal state)'}.`,
    };
  }

  const authorizedRoles = rule.allowedRoles[target as InvoiceWorkflowStatus] || [];
  if (!authorizedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' is not authorized to transition invoice status from '${current}' to '${target}'. Required role(s): ${authorizedRoles.join(', ')}.`,
    };
  }

  return { allowed: true };
}

/**
 * Validates whether an invoice payment status transition is permissible.
 */
export function canTransitionInvoicePayment(
  current: InvoicePaymentStatus | string,
  target: InvoicePaymentStatus | string,
  role: ActorRole = 'system'
): TransitionCheckResult {
  if (current === target) {
    return { allowed: true };
  }

  const PAYMENT_TRANSITIONS: Record<InvoicePaymentStatus, InvoicePaymentStatus[]> = {
    pending: ['partially_paid', 'paid', 'failed'],
    partially_paid: ['paid', 'refunded'],
    paid: ['refunded'],
    failed: ['pending', 'partially_paid', 'paid'],
    refunded: [],
  };

  const validStatuses: InvoicePaymentStatus[] = ['pending', 'partially_paid', 'paid', 'failed', 'refunded'];
  if (!validStatuses.includes(current as InvoicePaymentStatus)) {
    return { allowed: false, reason: `Unknown current payment status: '${current}'` };
  }
  if (!validStatuses.includes(target as InvoicePaymentStatus)) {
    return { allowed: false, reason: `Unknown target payment status: '${target}'` };
  }

  const allowed = PAYMENT_TRANSITIONS[current as InvoicePaymentStatus] || [];
  if (!allowed.includes(target as InvoicePaymentStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition payment from '${current}' to '${target}'. Allowed: ${allowed.join(', ') || 'none'}.`,
    };
  }

  // Clients cannot manually mark an invoice as paid offline
  if (role === 'client' && target === 'paid') {
    return { allowed: false, reason: 'Clients cannot manually mark invoices as paid.' };
  }

  return { allowed: true };
}

/**
 * Currency rounding helper: Half-up rounding to 2 decimal places.
 */
export function roundCurrency(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export interface InvoiceTotalsCalculationInput {
  items: { quantity: number; rate: number }[];
  taxPercentage?: number | null;
  discount?: number | null;
}

export interface InvoiceTotalsCalculationResult {
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  discount: number;
  total: number;
  lineAmounts: number[];
}

/**
 * Canonical calculation of invoice financials.
 * Guaranteed to be pure with zero side-effects.
 */
export function calculateInvoiceTotals(
  input: InvoiceTotalsCalculationInput
): InvoiceTotalsCalculationResult {
  const { items, taxPercentage, discount } = input;

  const safeTaxPercentage =
    taxPercentage !== undefined && taxPercentage !== null && !isNaN(Number(taxPercentage))
      ? Math.max(0, Number(taxPercentage))
      : 0;

  const lineAmounts = (items || []).map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const rate = Math.max(0, Number(item.rate) || 0);
    return roundCurrency(qty * rate);
  });

  const subtotal = roundCurrency(lineAmounts.reduce((sum, amt) => sum + amt, 0));
  const taxAmount = roundCurrency(subtotal * (safeTaxPercentage / 100));

  // Clamped discount: cannot exceed subtotal and cannot be negative
  const rawDiscount = Number(discount) || 0;
  const safeDiscount = roundCurrency(Math.max(0, Math.min(rawDiscount, subtotal)));

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
 * Computes remaining balance after paid amount.
 */
export function calculateRemainingBalance(total: number, paidAmount: number): number {
  const safeTotal = roundCurrency(Math.max(0, Number(total) || 0));
  const safePaid = roundCurrency(Math.max(0, Number(paidAmount) || 0));
  return roundCurrency(Math.max(0, safeTotal - safePaid));
}

/**
 * Derives payment status from total and paid amount.
 */
export function derivePaymentStatus(
  total: number,
  paidAmount: number
): 'paid' | 'partially_paid' | 'pending' {
  const paid = roundCurrency(Number(paidAmount) || 0);
  const tot = roundCurrency(Number(total) || 0);

  if (tot <= 0) return 'paid';
  if (paid >= tot) return 'paid';
  if (paid > 0) return 'partially_paid';
  return 'pending';
}

/**
 * Formats an invoice number based on user settings configuration.
 */
export function formatInvoiceNumber(
  config: {
    prefix?: string;
    separator?: string;
    includeYear?: boolean;
    padding?: number;
  } = {},
  sequence: number,
  customYear?: number
): string {
  const prefix = (config.prefix ?? 'INV').trim();
  const sep = config.separator ?? '-';
  const includeYear = config.includeYear !== false;
  const padding = Math.max(1, Math.min(10, config.padding || 4));
  const year = customYear || new Date().getFullYear();

  const paddedSeq = String(Math.max(1, sequence)).padStart(padding, '0');
  const parts: string[] = [];

  if (prefix) parts.push(prefix);
  if (includeYear) parts.push(String(year));

  if (parts.length === 0) {
    return paddedSeq;
  }
  return `${parts.join(sep)}${sep}${paddedSeq}`;
}
