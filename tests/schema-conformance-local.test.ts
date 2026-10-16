#!/usr/bin/env npx tsx
/**
 * FlowDesk — Schema Conformance Test (local Supabase)
 *
 * The application talks to PostgREST through an untyped Supabase client, so
 * TypeScript cannot catch a column that the schema is missing. This test
 * selects the exact column set each feature relies on. PostgREST returns a
 * "column ... does not exist" error for any missing column, so a clean select
 * proves the app<->schema contract holds.
 *
 * Usage: npx tsx tests/schema-conformance-local.test.ts
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// table -> columns the application reads/writes (derived from source).
const CONTRACT: Record<string, string[]> = {
  profiles: ['id', 'full_name', 'title', 'avatar_url', 'logo_url', 'signature_url', 'business_name', 'company_name', 'profession', 'email', 'phone', 'country', 'timezone', 'language', 'currency', 'hourly_rate', 'onboarding_completed', 'status', 'deleted_at'],
  user_settings: ['id', 'currency', 'timezone', 'date_format', 'week_start', 'invoice_prefix', 'invoice_number_format', 'invoice_separator', 'invoice_include_year', 'invoice_padding', 'invoice_next_sequence', 'invoice_annual_reset', 'default_tax_rate', 'tax_name', 'default_payment_terms', 'email_notifications', 'email_deliverables', 'email_documents', 'email_invoices', 'invoice_reminders', 'comment_alerts', 'weekly_digest'],
  workspaces: ['id', 'owner_id', 'name', 'logo_url', 'signature_url', 'currency', 'status', 'deleted_at'],
  clients: ['id', 'workspace_id', 'user_id', 'portal_token', 'name', 'company', 'email', 'phone', 'industry', 'avatar_url', 'logo_url', 'status', 'health_badge', 'total_billed', 'active_projects_count', 'country', 'timezone', 'currency', 'notes', 'tags', 'deleted_at', 'hourly_rate', 'portal_access_enabled'],
  client_invitations: ['id', 'workspace_id', 'client_id', 'freelancer_id', 'token_hash', 'status', 'recipient_email', 'expires_at', 'claimed_at', 'claimed_by_user_id', 'revoked_at'],
  projects: ['id', 'workspace_id', 'client_id', 'user_id', 'client_name', 'title', 'description', 'status', 'priority', 'budget', 'spent', 'start_date', 'due_date', 'completion_percentage', 'tags', 'milestones'],
  project_milestones: ['id', 'project_id', 'title', 'due_date', 'completed', 'description'],
  deliverables: ['id', 'workspace_id', 'client_id', 'project_id', 'user_id', 'client_name', 'title', 'description', 'status', 'approval_status', 'priority', 'due_date', 'review_deadline', 'current_version', 'milestone_id', 'submission_message', 'rejection_reason', 'internal_notes', 'files_count', 'comments_count', 'is_archived', 'approved_at', 'submitted_at'],
  deliverable_versions: ['id', 'deliverable_id', 'version_number', 'note', 'file_url', 'file_name', 'file_size', 'uploaded_by', 'archived', 'created_at'],
  deliverable_files: ['id', 'deliverable_id', 'version_id', 'file_name', 'file_size', 'file_type', 'file_url', 'thumbnail_url', 'folder', 'is_pinned', 'uploaded_by', 'uploaded_at'],
  deliverable_comments: ['id', 'deliverable_id', 'author', 'author_avatar', 'author_id', 'author_role', 'is_internal', 'content', 'attachments', 'reply_to_id', 'resolved'],
  documents: ['id', 'workspace_id', 'client_id', 'project_id', 'user_id', 'title', 'description', 'type', 'category', 'status', 'folder', 'is_pinned', 'is_internal', 'is_required', 'due_date', 'file_name', 'size', 'version', 'file_url', 'download_url', 'mime_type', 'tags', 'uploaded_by'],
  recurring_invoice_schedules: ['id', 'workspace_id', 'client_id', 'project_id', 'name', 'frequency', 'interval_days', 'anchor_date', 'day_of_month', 'timezone', 'next_run_at', 'last_run_at', 'ends_on', 'max_occurrences', 'occurrences_count', 'status', 'auto_send', 'due_in_days', 'currency', 'template', 'template_data', 'created_by'],
  invoices: ['id', 'workspace_id', 'client_id', 'user_id', 'client_name', 'client_email', 'project_id', 'project_name', 'invoice_number', 'status', 'workflow_status', 'payment_status', 'issue_date', 'due_date', 'subtotal', 'tax_percentage', 'tax_name', 'tax_amount', 'total_amount', 'discount', 'paid_amount', 'currency', 'notes', 'payment_instructions', 'internal_notes', 'recurring_schedule_id', 'recurrence_period_key', 'viewed_at', 'last_delivered_at'],
  invoice_items: ['id', 'invoice_id', 'description', 'quantity', 'unit_price', 'amount'],
  invoice_payments: ['id', 'invoice_id', 'workspace_id', 'amount', 'currency', 'payment_method', 'payment_date', 'razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature', 'gateway', 'gateway_status', 'failure_reason', 'captured_at', 'notes'],
  razorpay_orders: ['id', 'order_id', 'invoice_id', 'workspace_id', 'client_id', 'amount', 'amount_subunits', 'currency', 'status', 'receipt', 'notes', 'expires_at'],
  receipts: ['id', 'workspace_id', 'client_id', 'invoice_id', 'invoice_payment_id', 'receipt_number', 'amount', 'currency', 'payment_method', 'payment_date', 'razorpay_payment_id', 'razorpay_order_id', 'notes', 'created_at'],
  workspace_comments: ['id', 'workspace_id', 'client_id', 'project_id', 'deliverable_id', 'user_id', 'author', 'avatar', 'author_avatar', 'author_role', 'text', 'is_owner', 'is_internal', 'reply_to_id', 'reply_to_author', 'reply_to_text', 'mentions', 'attachments', 'is_pinned', 'read_by_client'],
  activities: ['id', 'workspace_id', 'client_id', 'project_id', 'user_id', 'user_name', 'user_avatar', 'action', 'title', 'description', 'resource_type', 'resource_id', 'metadata'],
  notifications: ['id', 'workspace_id', 'client_id', 'user_id', 'title', 'message', 'type', 'read', 'link', 'category', 'priority'],
  email_events: ['id', 'workspace_id', 'user_id', 'recipient', 'event_type', 'reference_type', 'reference_id', 'provider', 'provider_message_id', 'status', 'attempt_count', 'max_attempts', 'last_error', 'claimed_at', 'locked_by', 'next_attempt_at', 'sent_at', 'delivered_at', 'opened_at', 'clicked_at'],
  subscriptions: ['id', 'workspace_id', 'plan_key', 'status', 'billing_interval', 'provider', 'provider_customer_id', 'provider_subscription_id', 'razorpay_subscription_id', 'razorpay_customer_id', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'canceled_at'],
  billing_events: ['id', 'workspace_id', 'event_type', 'type', 'provider', 'provider_event_id', 'payload', 'payload_hash', 'processed_at', 'error'],
  entitlement_overrides: ['id', 'workspace_id', 'feature', 'value', 'reason', 'expires_at'],
  usage_counters: ['id', 'workspace_id', 'metric', 'value'],
  jobs: ['id', 'type', 'workspace_id', 'payload', 'status', 'run_at', 'attempts', 'max_attempts', 'locked_by', 'locked_until', 'last_error', 'dedupe_key', 'finished_at'],
  job_runs: ['id', 'job_id', 'workspace_id', 'attempt_number', 'status', 'worker_id', 'duration_ms', 'error_message', 'started_at', 'completed_at'],
  reminder_settings: ['id', 'workspace_id', 'enabled', 'rules'],
  reminder_log: ['id', 'workspace_id', 'invoice_id', 'rule_key', 'recipient_email', 'email_event_id', 'sent_at'],
  account_deletions: ['id', 'account_type', 'user_id', 'workspace_id', 'client_id', 'client_name', 'client_company', 'deleted_by', 'deleted_at', 'created_at', 'updated_at', 'restore_until', 'status', 'metadata'],
};

let passed = 0;
let failed = 0;

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       FLOWDESK SCHEMA CONFORMANCE TEST (local DB)            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const [table, columns] of Object.entries(CONTRACT)) {
    const { error } = await admin.from(table).select(columns.join(',')).limit(1);
    if (error) {
      failed++;
      console.log(`  ❌ ${table.padEnd(28)} ${error.message}`);
    } else {
      passed++;
      console.log(`  ✅ ${table.padEnd(28)} ${columns.length} columns`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
