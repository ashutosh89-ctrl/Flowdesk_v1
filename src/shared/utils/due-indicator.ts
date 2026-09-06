export interface DueIndicator {
  status: 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'no_date';
  label: string;
  color: string;
  badgeVariant: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
}

export function calculateDueIndicator(
  dueDate: string | undefined,
  paymentStatus?: string,
  workflowStatus?: string
): DueIndicator {
  if (!dueDate) {
    return { status: 'no_date', label: 'No due date', color: 'text-zinc-400', badgeVariant: 'neutral' };
  }

  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (paymentStatus === 'paid') {
    return { status: 'on_track', label: 'Paid', color: 'text-emerald-400', badgeVariant: 'success' };
  }

  if (diffDays < 0) {
    return { status: 'overdue', label: `${Math.abs(diffDays)} days overdue`, color: 'text-red-400', badgeVariant: 'danger' };
  } else if (diffDays === 0) {
    return { status: 'due_today', label: 'Due today', color: 'text-amber-400', badgeVariant: 'warning' };
  } else if (diffDays <= 3) {
    return { status: 'due_soon', label: `Due in ${diffDays} days`, color: 'text-amber-400', badgeVariant: 'warning' };
  } else {
    return { status: 'on_track', label: `Due in ${diffDays} days`, color: 'text-emerald-400', badgeVariant: 'info' };
  }
}
