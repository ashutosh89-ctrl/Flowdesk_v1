import { InvoiceWorkflowStatus, InvoicePaymentStatus } from '../types';

export interface DueIndicatorInfo {
  label: string;
  badgeVariant: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  daysDiff: number;
  isOverdue: boolean;
}

export function calculateDueIndicator(
  dueDateStr: string,
  paymentStatus: InvoicePaymentStatus,
  workflowStatus: InvoiceWorkflowStatus
): DueIndicatorInfo {
  if (paymentStatus === 'paid') {
    return {
      label: 'Settled',
      badgeVariant: 'success',
      daysDiff: 0,
      isOverdue: false,
    };
  }

  if (workflowStatus === 'cancelled') {
    return {
      label: 'Cancelled',
      badgeVariant: 'neutral',
      daysDiff: 0,
      isOverdue: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`,
      badgeVariant: 'danger',
      daysDiff: diffDays,
      isOverdue: true,
    };
  }

  if (diffDays === 0) {
    return {
      label: 'Due Today',
      badgeVariant: 'warning',
      daysDiff: 0,
      isOverdue: false,
    };
  }

  if (diffDays === 1) {
    return {
      label: 'Due Tomorrow',
      badgeVariant: 'warning',
      daysDiff: 1,
      isOverdue: false,
    };
  }

  if (diffDays <= 7) {
    return {
      label: `${diffDays} Days Left`,
      badgeVariant: 'info',
      daysDiff: diffDays,
      isOverdue: false,
    };
  }

  return {
    label: `Due ${dueDateStr}`,
    badgeVariant: 'neutral',
    daysDiff: diffDays,
    isOverdue: false,
  };
}
