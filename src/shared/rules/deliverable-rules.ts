/**
 * Pure Business Rules: Deliverables & Approvals
 *
 * ZERO I/O: Deterministic state machine, transition invariants, and role assertions.
 * Shared directly across server route handlers, backend services, and React UI.
 */

import { ActorRole, TransitionCheckResult } from './invoice-rules';

export type DeliverableStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'revision_requested'
  | 'completed'
  | 'archived';

export const DELIVERABLE_STATUS_TRANSITIONS: Record<
  DeliverableStatus,
  { allowedTargets: DeliverableStatus[]; allowedRoles: Record<DeliverableStatus, ActorRole[]> }
> = {
  draft: {
    allowedTargets: ['submitted', 'archived'],
    allowedRoles: {
      submitted: ['freelancer'],
      archived: ['freelancer'],
      draft: ['freelancer'],
      in_review: [],
      approved: [],
      revision_requested: [],
      completed: [],
    },
  },
  submitted: {
    allowedTargets: ['in_review', 'approved', 'revision_requested', 'archived'],
    allowedRoles: {
      in_review: ['client', 'freelancer', 'system'],
      approved: ['client', 'freelancer'],
      revision_requested: ['client', 'freelancer'],
      archived: ['freelancer'],
      submitted: ['freelancer', 'client'],
      draft: [],
      completed: [],
    },
  },
  in_review: {
    allowedTargets: ['approved', 'revision_requested', 'archived'],
    allowedRoles: {
      approved: ['client', 'freelancer'],
      revision_requested: ['client', 'freelancer'],
      archived: ['freelancer'],
      in_review: ['client', 'freelancer'],
      submitted: [],
      draft: [],
      completed: [],
    },
  },
  revision_requested: {
    allowedTargets: ['submitted', 'archived'],
    allowedRoles: {
      submitted: ['freelancer'],
      archived: ['freelancer'],
      revision_requested: ['client', 'freelancer'],
      draft: [],
      in_review: [],
      approved: [],
      completed: [],
    },
  },
  approved: {
    allowedTargets: ['completed', 'archived'],
    allowedRoles: {
      completed: ['freelancer', 'client'],
      archived: ['freelancer'],
      approved: ['freelancer', 'client'],
      draft: [],
      submitted: [],
      in_review: [],
      revision_requested: [],
    },
  },
  completed: {
    allowedTargets: ['archived'],
    allowedRoles: {
      archived: ['freelancer'],
      completed: ['freelancer', 'client'],
      draft: [],
      submitted: [],
      in_review: [],
      approved: [],
      revision_requested: [],
    },
  },
  archived: {
    allowedTargets: ['draft'],
    allowedRoles: {
      draft: ['freelancer'],
      archived: ['freelancer'],
      submitted: [],
      in_review: [],
      approved: [],
      revision_requested: [],
      completed: [],
    },
  },
};

/**
 * Validates whether a deliverable status transition is permissible.
 */
export function canTransitionDeliverableStatus(
  current: DeliverableStatus | string,
  target: DeliverableStatus | string,
  role: ActorRole = 'freelancer'
): TransitionCheckResult {
  if (current === target) {
    return { allowed: true };
  }

  const validStatuses: DeliverableStatus[] = [
    'draft',
    'submitted',
    'in_review',
    'approved',
    'revision_requested',
    'completed',
    'archived',
  ];

  if (!validStatuses.includes(current as DeliverableStatus)) {
    return { allowed: false, reason: `Unknown current deliverable status: '${current}'` };
  }
  if (!validStatuses.includes(target as DeliverableStatus)) {
    return { allowed: false, reason: `Unknown target deliverable status: '${target}'` };
  }

  const rule = DELIVERABLE_STATUS_TRANSITIONS[current as DeliverableStatus];
  if (!rule.allowedTargets.includes(target as DeliverableStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition deliverable from '${current}' to '${target}'. Allowed transitions: ${rule.allowedTargets.length ? rule.allowedTargets.join(', ') : 'none'}.`,
    };
  }

  const authorizedRoles = rule.allowedRoles[target as DeliverableStatus] || [];
  if (!authorizedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' is not authorized to transition deliverable status from '${current}' to '${target}'. Required role(s): ${authorizedRoles.join(', ')}.`,
    };
  }

  return { allowed: true };
}

/**
 * Helper to determine if an actor can approve a deliverable in the current state.
 */
export function canApproveDeliverable(currentStatus: string, role: ActorRole): boolean {
  return canTransitionDeliverableStatus(currentStatus, 'approved', role).allowed;
}

/**
 * Helper to determine if an actor can request revision on a deliverable.
 */
export function canRequestDeliverableRevision(currentStatus: string, role: ActorRole): boolean {
  return canTransitionDeliverableStatus(currentStatus, 'revision_requested', role).allowed;
}

/**
 * Helper to determine if an actor can submit a deliverable for review.
 */
export function canSubmitDeliverable(currentStatus: string, role: ActorRole): boolean {
  return canTransitionDeliverableStatus(currentStatus, 'submitted', role).allowed;
}
