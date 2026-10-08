/**
 * Feature Flags for Progressive Server-Boundary Migration (Phase 5)
 *
 * Defaults to TRUE (server route handlers active).
 * Can be explicitly toggled to false via NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_<N>=false
 * for instant client-side fallback during rollout.
 */

export type ServerMutationBatch = 1 | 2 | 3 | 4;

export function isServerMutationBatchEnabled(batch: ServerMutationBatch): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return true;
  }
  const flag = process.env[`NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_${batch}`];
  if (flag === 'false' || flag === '0') {
    return false;
  }
  return true;
}
