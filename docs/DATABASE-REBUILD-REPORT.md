# FlowDesk Database, RLS, Storage & Integration — Rebuild Report

**Date:** 2026-10-14
**Scope:** Version-controlled database schema, migrations, RLS, storage
configuration, TypeScript database types, and verification.
**Authorization mode:** Local-first. **Nothing was applied to any remote
Supabase project during this work.**

## Status legend

Every statement below carries one of these statuses:

- **Implemented (local)** — code/migration committed in the repository.
- **Tested locally** — executed and observed on the local Supabase stack (Docker).
- **Applied to remote** — executed against a remote project. *(None in this report.)*
- **Verified against remote** — result observed on a remote project. *(None.)*
- **Deployed to preview / Verified in production** — *(None.)*

---

## 1. Repository audit report

### Finding A1 — Schema was absent from the repository (Severity: High)

- **Root cause:** Commit `86f76b9` deleted `database/migrations/*` and
  `database/schema/schema.sql`. A later "master rebuild" commit `2ee1458` added
  `supabase/*` + `database.types.ts`, but it was reverted by `498bac0`, which
  `main` fast-forwarded to.
- **Affected feature:** Every DB-backed feature (the app queries ~30 tables).
- **State found:** Application source queried tables that no committed migration
  created; only `.env.local` pointed at a (possibly-populated) remote project.
- **Fix applied (Implemented local):** Reintroduced the rebuild as a **draft**
  (`supabase/schema.sql`, 5 migrations, `database.types.ts`, `apply-migrations.ts`)
  and then re-derived the schema from application source.
- **Verification (Tested locally):** `supabase db reset` recreates all objects
  from migrations on a fresh database.

### Finding A2 — Rebuild was incomplete vs. the application contract (Severity: High)

The reintroduced rebuild shipped 28 tables but the app also reads/writes:

| Missing object | Evidence (source) |
|---|---|
| `email_events` table | `src/backend/email/email-service.ts`, `app/api/email/route.ts`, Brevo/Resend webhooks |
| `razorpay_orders` table | `src/backend/payments/payment-service.ts` |
| `profiles.status`, `profiles.deleted_at` | `app/api/account/{delete,restore}/route.ts` |
| `workspaces.status`, `workspaces.deleted_at` | account lifecycle routes, `freelancer/index.ts` |
| `documents.size`, `documents.download_url` | `client-document-service.ts` |
| `deliverables.{client_name, internal_notes, approved_at, submitted_at, user_id}` | `deliverables` routes, `freelancer/index.ts` |
| `deliverable_versions.{file_name, file_size, uploaded_by}` | `deliverables/[id]/versions` route |
| `deliverable_files.{folder, is_pinned}` | deliverables services |
| `deliverable_comments.{author_id, attachments, reply_to_id}` | `freelancer/index.ts` |
| `workspace_comments.{user_id, reply_to_author, reply_to_text, mentions, attachments, is_pinned, read_by_client}` | comments services |
| `invoices.project_name` | `freelancer/index.ts`, `client-invoice-service.ts` |
| `invoice_payments.{gateway, gateway_status, failure_reason, captured_at}` | payment services |

- **Fix applied (Implemented local):** `20261015000006_reconciliation.sql`.
- **Verification (Tested locally):** `tests/schema-conformance-local.test.ts` —
  **30/30 tables, 0 column errors.**

### Finding A3 — `storage.objects` RLS policies were missing (Severity: High)

- **Root cause:** The rebuild's storage migration provisioned buckets but no
  `storage.objects` policies. Client document uploads go through the
  **authenticated browser client** directly to the private `documents` bucket,
  which requires storage RLS.
- **Fix applied (Implemented local):** `20261015000007_rls_storage_reconciliation.sql`
  adds five policies (public read, owner all, client read, client insert,
  client update), wrapped in an exception-safe block.
- **Verification (Tested locally):** 5 policies present after `supabase db reset`;
  cross-tenant storage access denied (see §11).

### Finding A4 — `Database` type drifted from the schema (Severity: Medium)

- **Fix applied:** Regenerated `src/shared/types/database.types.ts` from the live
  local schema (`npx supabase gen types typescript --local`).
- **Verification (Tested locally):** `tsc --noEmit` → 0 errors.

### Authentication preservation (no change required)

Supabase Auth code was **not modified**: `auth-service.ts`, `supabase-server.ts`,
`middleware.ts`, client auth, OAuth callback, password reset all untouched.
Migration 5 only *adds* a `handle_new_user` trigger + one-time backfill using
`ON CONFLICT DO NOTHING`; it never deletes users, identities, or sessions.

---

## 2. Final schema & entity-relationship overview

**30 tables** in `public`. Key relationships (FK → PK):

```
auth.users 1──1 profiles
auth.users 1──1 user_settings
auth.users 1──* workspaces (owner_id)
workspaces 1──* clients ──1 auth.users (bound client portal identity)
workspaces 1──* projects 1──* project_milestones
workspaces 1──* documents (── client, project)
workspaces 1──* deliverables (── client, project)
deliverables 1──* deliverable_versions | deliverable_files | deliverable_comments
workspaces 1──* invoices (── client [ON DELETE RESTRICT], project)
invoices 1──* invoice_items
invoices 1──* invoice_payments | razorpay_orders
workspaces 1──* recurring_invoice_schedules | reminder_settings | reminder_log
workspaces 1──* subscriptions | billing_events | entitlement_overrides | usage_counters
workspaces 1──* jobs 1──* job_runs
workspaces 1──* workspace_comments | activities | notifications | account_deletions
workspaces 1──* email_events | client_invitations
```

**Financial-history protection:** `invoices.client_id` uses `ON DELETE RESTRICT`
(not CASCADE), so deleting a client cannot silently delete invoices. Payments,
receipts and billing events are append-only (no authenticated UPDATE/DELETE
policy on `email_events`, `billing_events`).

**Integrity metrics (measured on the local DB):**

| Object | Count |
|---|---:|
| Tables | 30 |
| Primary keys | 30 |
| Foreign keys | 69 |
| Unique constraints | 8 |
| Named CHECK constraints | 14 |
| Indexes (public) | 98 |
| RLS policies (public) | 54 |
| Storage policies | 5 |
| Functions | 4 |

---

## 3. Ordered migration files (Implemented local)

`supabase/migrations/`
1. `20261015000001_core_schema.sql`
2. `20261015000002_indexes_and_constraints.sql`
3. `20261015000003_rls_policies.sql`
4. `20261015000004_storage_buckets.sql`
5. `20261015000005_auth_triggers.sql`
6. `20261015000006_reconciliation.sql`
7. `20261015000007_rls_storage_reconciliation.sql`

`schema.sql` is a **generated** concatenation of the above (for SQL-editor use).

---

## 4. Table & column documentation

Authoritative column contract is encoded in
`tests/schema-conformance-local.test.ts` (30 tables × app-required columns) and
generated in `src/shared/types/database.types.ts`. Highlights:

- **Money** uses `NUMERIC(12,2)` (`invoices`, `invoice_items`, `invoice_payments`,
  `razorpay_orders`, `clients.total_billed`, `projects.budget/spent`). No floats.
- **Invoices** enforce `UNIQUE (workspace_id, invoice_number)` and an idempotency
  partial unique index on `(recurring_schedule_id, recurrence_period_key)`.
- **`email_events`** has a partial unique index `(event_type, reference_id,
  recipient)` — the email service relies on the `23505` violation to dedupe
  concurrent outbox claims.
- **`reminder_log`** has `UNIQUE (workspace_id, invoice_id, rule_key)` for
  at-most-once reminder delivery.

---

## 5. Foreign-key, constraint & index inventory

- **Deletion behavior choices:** `ON DELETE CASCADE` for owned children
  (workspace → clients/projects/…), `ON DELETE RESTRICT` for `invoices.client_id`
  (preserve financial history), `ON DELETE SET NULL` for optional attribution
  (`invoices.user_id`, `documents.client_id`, `deliverables.project_id`).
- **Check constraints:** status domains for clients, invitations, projects,
  deliverables, documents, invoices, email_events, razorpay_orders; non-negative
  money; `quantity > 0`; `completion_percentage` 0–100.
- **Indexes:** every FK column is indexed; hot filters (`status`, `due_date`,
  `created_at DESC`, `read`, `approval_status`) are indexed. Partial indexes
  avoid low-selectivity bloat (`jobs.dedupe_key`, `email_events.next_attempt_at`,
  recurring-invoice idempotency).

---

## 6. RLS permission matrix (Implemented local + Tested locally)

Roles: **anon**, **authenticated freelancer (workspace owner)**, **authenticated
client portal user**, **service role** (server-only, bypasses RLS).

| Table | anon | Freelancer (owner) | Client | Notes |
|---|:--:|:--:|:--:|---|
| profiles | – | R/W own | R owner of own workspace | `id = auth.uid()` OR client→workspace owner |
| user_settings | – | ALL own | – | `id = auth.uid()` |
| workspaces | – | ALL own | R assigned | client sees only their workspace |
| clients | – | ALL in workspace | R own row | client cannot see sibling clients |
| client_invitations | – | ALL own | – | owner-managed |
| projects | – | ALL in workspace | R assigned | |
| project_milestones | – | ALL in workspace | R via project | |
| deliverables | – | ALL in workspace | R/W assigned, non-archived | client write restricted |
| deliverable_versions | – | ALL | R assigned | |
| deliverable_files | – | ALL | R/INSERT assigned | |
| deliverable_comments | – | ALL | R/INSERT `is_internal=false` | internal notes hidden |
| documents | – | ALL | R/INSERT `is_internal=false` | internal docs hidden |
| invoices | – | ALL in workspace | R assigned | |
| invoice_items | – | ALL | R via invoice | |
| invoice_payments | – | R/W | R via invoice | append-only for clients |
| workspace_comments | – | ALL | R/INSERT `is_internal=false` | |
| activities | – | R/INSERT in workspace | R own client_id | |
| notifications | – | R/U own | – | `user_id = auth.uid()` |
| email_events | – | R own workspace | – | writes service-role only |
| razorpay_orders | – | ALL own | R assigned | |
| subscriptions / billing_events / entitlement_overrides / usage_counters | – | R own | – | billing read-only to users |
| jobs / job_runs / reminder_settings / reminder_log | – | owner-scoped | – | |
| account_deletions | – | R own (`deleted_by`) | – | |

**Authorization helpers** (SECURITY DEFINER, `SET search_path = public`, STABLE):
`is_workspace_owner(uuid)`, `get_auth_client_ids()`, `is_client_user(uuid)`.
Authorization is validated on **both** `USING` (existing rows) and `WITH CHECK`
(new rows), preventing ownership-field tampering to gain access.

---

## 7. Storage bucket configuration & access matrix

| Bucket | Visibility | Size limit | MIME | Client | Freelancer |
|---|---|---:|---|---|---|
| `avatars` | Public | 5 MB | jpeg/png/webp/gif | read | write in own workspace |
| `logos` | Public | 5 MB | jpeg/png/webp/gif | read | write in own workspace |
| `signatures` | Public | 5 MB | jpeg/png/webp | read | write in own workspace |
| `documents` | **Private** | 25 MB | pdf/office/zip/text/images | read + upload own client scope | full in workspace |
| `deliverables` | **Private** | 50 MB | pdf/zip/images | read-only own scope | full in workspace |

Canonical path (enforced by `storage-helper.ts`):
`workspaces/<wsId>/clients/<clientId>/<uuid>_<file>`,
`workspaces/<wsId>/shared/<uuid>_<file>`,
`workspaces/<wsId>/branding/<uuid>_<file>`.

Storage policies assert the path's workspace segment resolves to an owned
workspace, and the client segment resolves to a bound client identity — so
guessing a path cannot grant access.

---

## 8. Updated database types

`src/shared/types/database.types.ts` regenerated from the live schema; re-exported
by `src/shared/types/index.ts`. Regenerate with `npm run db:types`.

---

## 9. Backend service layer

No application service code required changes — the reconciliation migration
conformed the database **to** the existing services. Services rely on RLS +
server-side identity resolution (`resolveApiCaller()`); elevated access is
server-only (`SUPABASE_SERVICE_ROLE_KEY`). **Status: Implemented (pre-existing) +
Tested locally at the schema-contract level (§11).** Full per-feature runtime E2E
against a browser session was **not** executed — see §16.

---

## 10. Frontend integration

Unchanged. Build succeeds with all routes (`npm run build`). UI is served from the
same services verified against the schema. **Status: Implemented (pre-existing),
verified to compile/build; not exercised in a live browser in this session.**

---

## 11. Automated tests & actual results (all Tested locally)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | **0 errors** |
| ESLint | `npm run lint` | **0 errors** (4 pre-existing warnings) |
| Unit/security suite | `npm run test:all` | **31/31 steps passed** |
| Fresh-DB reproducibility | `npx supabase db reset` | **all 7 migrations applied** |
| Schema conformance | `npm run test:schema:local` | **30/30 tables, 0 column errors** |
| RLS isolation (live) | `npm run test:rls:local` | **17/17 assertions passed** |
| Production build | `npm run build` | **success** |

RLS isolation assertions executed against the local database:

1. Auth trigger auto-provisions distinct workspaces.
2. Freelancer A can insert into their own workspace.
3. Freelancer B cannot list/read A's clients (by list or guessed UUID).
4. B cannot INSERT into A's workspace; cannot UPDATE A's client.
5. B cannot reassign A's client to gain access.
6. Anon cannot read clients or workspaces.
7. A can upload to own client path; B cannot sign/download A's private object.
8. A client user cannot read another workspace; can read their own bound record.

**Not weakened to pass:** no policy was relaxed; the tests assert denial.

---

## 12. Environment variable checklist

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Data API + auth |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Privileged server ops |
| `DATABASE_URL` | **Server only** | `apply-migrations.ts` only |
| `NEXT_PUBLIC_AUTH_MODE` | Public | `production` (default) / `demo` |
| `RAZORPAY_*`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Server / Public | Payments |
| `BREVO_API_KEY`, `EMAIL_FROM` (`RESEND_API_KEY`) | Server | Email |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Server | Rate limiting |
| `CRON_SECRET`, `ENABLE_*` | Server | Background jobs |

Values are never read or logged in this report. Local test overrides:
`SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY`.

---

## 13. Local development setup

```bash
npm install
cp .env.example .env.local          # fill in values
npx supabase start                  # Docker required
npx supabase db reset               # apply all migrations + seed
npm run db:types                    # regenerate DB types
npm run test:schema:local && npm run test:rls:local
npm run dev
```

## 14. Migration application instructions

See `supabase/README.md`. Remote application is an **explicit, reviewed** step:
`npx supabase link && npx supabase db push`, or run `supabase/schema.sql` in the
SQL editor. **No remote application was performed here.**

## 15. Deployment & rollback guide

- Migrations are additive and idempotent (`IF NOT EXISTS` / `DROP ... IF EXISTS`);
  re-running is safe. No `DROP TABLE`/`TRUNCATE` exists in any migration.
- **Pre-deploy:** back up production (`pg_dump` / PITR snapshot).
- **Deploy order:** apply migrations → regenerate types → deploy app build.
- **Rollback:** migrations are forward-only and non-destructive; to roll back
  application behavior, redeploy the previous build (schema remains compatible
  because all changes are additive). For accidental object creation, drop the
  specific new object — never reset the instance.
- **Never** run `supabase db reset` against production.

## 16. Known limitations & remaining defects

1. **Remote not touched.** Migrations exist locally and are verified on a fresh
   local DB, but are **not applied to or verified against** the remote project.
   The remote DB may have drifted; treat `supabase/schema.sql` as the target.
2. **No live-browser E2E.** RLS + schema contract are verified via API-level tests;
   a full click-through (upload → approve → invoice → pay) was not run in this
   session and remains to be executed against a preview deployment.
3. **Storage policies depend on role ownership.** On Supabase Cloud the migration
   may skip the `storage.objects` policies (logged as a NOTICE); apply them from
   the Dashboard if so.
4. **`supabase/config.toml` DB major version** (`17`) must match the remote
   project's Postgres version before `db push`.
5. **Legacy tables intentionally not recreated:** `invoice_sequences`, `receipts`,
   `plans` appeared in the historical schema but are referenced by **0** current
   source files, so they were omitted to avoid unused entities.
6. Pre-existing lint warnings (4 × `no-img-element`) are unrelated to this work.
