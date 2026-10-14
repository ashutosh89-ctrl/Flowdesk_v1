import { SupabaseClient } from '@supabase/supabase-js';
import { ApprovalStatus } from '@/shared/types';

/**
 * Extended columns on public.deliverables that were added in later migrations
 * (e.g. Phase 19) and may not exist in live database environments that have not
 * run those migrations yet.
 */
export const EXTENDED_DELIVERABLE_COLUMNS = [
  'priority',
  'review_deadline',
  'submission_message',
  'approval_status',
  'submitted_at',
  'files_count',
  'comments_count',
  'is_archived',
] as const;

/**
 * Derives the approvalStatus from deliverable status when the dedicated
 * approval_status column is absent or null.
 */
export function deriveApprovalStatus(status?: string, approvalStatus?: string): ApprovalStatus {
  if (approvalStatus && approvalStatus !== 'pending') {
    return approvalStatus as ApprovalStatus;
  }
  if (status === 'approved') return 'approved';
  if (status === 'revision_requested') return 'revision_requested';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

/**
 * Inserts a deliverable record adaptively.
 * If the database schema is missing extended columns (returning PGRST204),
 * it strips those columns and retries against the base schema.
 */
export async function safeDeliverableInsert(
  client: SupabaseClient,
  payload: Record<string, any>
) {
  const firstAttempt = await client
    .from('deliverables')
    .insert(payload)
    .select()
    .single();

  if (!firstAttempt.error) {
    return firstAttempt;
  }

  // Check if error is due to missing columns in schema cache
  const isColumnError =
    firstAttempt.error.code === 'PGRST204' ||
    firstAttempt.error.message?.includes('schema cache') ||
    firstAttempt.error.message?.includes('does not exist');

  if (isColumnError) {
    const strippedPayload = { ...payload };
    for (const col of EXTENDED_DELIVERABLE_COLUMNS) {
      delete strippedPayload[col];
    }
    return client
      .from('deliverables')
      .insert(strippedPayload)
      .select()
      .single();
  }

  return firstAttempt;
}

/**
 * Updates a deliverable record adaptively.
 * If the database schema is missing extended columns (returning PGRST204),
 * it strips those columns and retries against the base schema.
 */
export async function safeDeliverableUpdate(
  client: SupabaseClient,
  id: string,
  payload: Record<string, any>,
  extraEq?: { key: string; value: string }
) {
  let query = client.from('deliverables').update(payload).eq('id', id);
  if (extraEq) {
    query = query.eq(extraEq.key, extraEq.value);
  }

  const firstAttempt = await query.select().single();
  if (!firstAttempt.error) {
    return firstAttempt;
  }

  const isColumnError =
    firstAttempt.error.code === 'PGRST204' ||
    firstAttempt.error.message?.includes('schema cache') ||
    firstAttempt.error.message?.includes('does not exist');

  if (isColumnError) {
    const strippedPayload = { ...payload };
    for (const col of EXTENDED_DELIVERABLE_COLUMNS) {
      delete strippedPayload[col];
    }
    let fallbackQuery = client.from('deliverables').update(strippedPayload).eq('id', id);
    if (extraEq) {
      fallbackQuery = fallbackQuery.eq(extraEq.key, extraEq.value);
    }
    return fallbackQuery.select().single();
  }

  return firstAttempt;
}

/**
 * Inserts a deliverable file record adaptively.
 * Strips uploaded_by / uploaded_at if absent in the schema.
 */
export async function safeDeliverableFileInsert(
  client: SupabaseClient,
  payload: Record<string, any>
) {
  const firstAttempt = await client
    .from('deliverable_files')
    .insert(payload)
    .select()
    .single();

  if (!firstAttempt.error) {
    return firstAttempt;
  }

  const isColumnError =
    firstAttempt.error.code === 'PGRST204' ||
    firstAttempt.error.message?.includes('schema cache') ||
    firstAttempt.error.message?.includes('does not exist');

  if (isColumnError) {
    const stripped = { ...payload };
    delete stripped.uploaded_by;
    delete stripped.uploaded_at;
    return client
      .from('deliverable_files')
      .insert(stripped)
      .select()
      .single();
  }

  return firstAttempt;
}
