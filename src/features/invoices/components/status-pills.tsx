import React from 'react';
import { InvoiceWorkflowStatus, InvoicePaymentStatus } from '../../../types';
import { calculateDueIndicator } from '../../../utils/due-indicator';

export function WorkflowStatusPill({ status }: { status: InvoiceWorkflowStatus }) {
  const styles: Record<InvoiceWorkflowStatus, string> = {
    draft: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50',
    viewed: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/50',
    cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800',
  };

  const labels: Record<InvoiceWorkflowStatus, string> = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    cancelled: 'Cancelled',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${
        styles[status] || styles.draft
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {labels[status] || status}
    </span>
  );
}

export function PaymentStatusPill({ status }: { status: InvoicePaymentStatus }) {
  const styles: Record<InvoicePaymentStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50',
    partially_paid: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/50',
    refunded: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    failed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50',
  };

  const labels: Record<InvoicePaymentStatus, string> = {
    pending: 'Pending',
    paid: 'Paid',
    partially_paid: 'Partially Paid',
    refunded: 'Refunded',
    failed: 'Payment Failed',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${
        styles[status] || styles.pending
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {labels[status] || status}
    </span>
  );
}

export function DueIndicatorBadge({
  dueDate,
  paymentStatus,
  workflowStatus,
}: {
  dueDate: string;
  paymentStatus: InvoicePaymentStatus;
  workflowStatus: InvoiceWorkflowStatus;
}) {
  const info = calculateDueIndicator(dueDate, paymentStatus, workflowStatus);

  const badgeStyles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40',
    neutral: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${
        badgeStyles[info.badgeVariant] || badgeStyles.neutral
      }`}
    >
      {info.label}
    </span>
  );
}
