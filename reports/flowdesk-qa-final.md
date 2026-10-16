# FlowDesk — Database & Application QA Final Report

**Date:** 2026-10-16
**Baseline:** `reports/flowdesk-qa-baseline.md`
**Environment:** local Supabase stack (Docker, PostgreSQL 17), auth mode
`production`. **No remote project was read from or written to.**
**Companion documents:** `docs/DATABASE-REBUILD-REPORT.md` (schema rebuild),
`supabase/README.md` (migration + remote application procedure).

---

## 1. Executive summary

| Metric | Value |
|---|---|
| Test assertions executed (this session) | **391** |
| Passed | **391** |
| Failed | **0** |
| Blocked | **0** |
| Skipped / not executed | **1 area** — live-browser (Playwright) E2E (no harness in repo) |
| Verified defects found | **8** (5 HIGH, 3 MEDIUM) |
| Defects fixed | **8 of 8** |
| Unresolved defects | **0** |
| Observations recorded (no change made) | 3 |
| Security status | **No cross-tenant leak found.** All isolation probes pass; the fixes *strengthened* the authorization model (financial RPCs now re-derive the caller). |
| Database migration status | 9 migrations apply cleanly to a fresh DB (`npx supabase db reset`). Migration 9 is new and purely additive. **Not yet applied to any remote project.** |

Counting detail: `npm run test:all` = 31/31 steps; `npm run test:db:local` = 211
assertions (31 column-contract + 47 app↔schema contract + 17 RLS isolation + 116
workflow); `npm test` (payments/security) = 48; `npx tsc --noEmit` = 0 errors;
`npx eslint .` = 0 errors; `npm run build` = success.

**Overall status:** all verified defects are fixed and independently re-verified.
Two items require a decision/credential from you before the work is complete:
applying migrations to the remote project, and the scope of demo-data removal
(§ 7).

---

## 2. Feature-by-feature report

Legend: **Initial** = baseline result, **Final** = result after fixes.

| # | Feature | Operations tested | Initial | Root cause | Fix applied | Final |
|---|---|---|---|---|---|---|
| A | **Clients** | create, read, reload, update (name/company/phone), archive, required-field rejection, invalid status rejection, duplicate-email behaviour, delete-with-invoices block, cross-tenant list | Pass (no defect) | — | — | **Pass** |
| B | **Projects** | create, FK to workspace/client, invalid client FK, invalid status, completion range, status/budget update, reload, milestones round-trip, milestone persistence, unauthorized read | **Fail** — milestones unusable | `JSON.stringify()` into a JSONB column stored a double-encoded string; milestone toggles then dropped every milestone | `createProject`/`updateProject`/`toggleMilestone`/`addMilestone` now pass the array itself | **Pass** |
| C | **Invoices** | create, line items, subtotal/tax/total, NUMERIC precision, reload incl. `receipts(*)` join, duplicate-number rejection per workspace, cross-workspace reuse, partial & full offline settlement, overpayment rejection, non-positive rejection, durable receipt per settlement, gateway settlement, gateway idempotency, gateway overpayment, order ledger state, delete-client block | **Fail** — read (`receipts(*)`) and all settlement paths failed | `receipts` table missing; `record_manual_payment` + `settle_razorpay_payment` RPCs missing; non-positive amount coerced to full settlement | Migration 9: `receipts` table + both RPCs; call sites no longer coerce `<= 0` to `NULL`; added `receipts(*)` to the freelancer invoice select | **Pass** |
| C2 | **Invoice items** | persist, count, FK cascade on invoice delete | Pass | — | — | **Pass** |
| D | **Documents** | request/create, metadata persist, upload metadata, canonical private path, owner upload to private bucket, object existence, authorized download URL, cross-tenant signed URL denial, cross-tenant download denial, delete + metadata cleanup | Pass (no defect) | — | — | **Pass** |
| E | **Deliverables** | create, workspace/client/project linkage, reload, version upload, current-version update, comment + counter, client review → approval, approval timestamp, revision request, unauthorized read, **no-session behaviour** | **Fail** — fabricated demo data on failure paths | 27 unguarded `FlowDeskStore` fallbacks in production code | All fallbacks gated behind `demoFallbackAllowed()`; production now returns empty / throws instead of fabricating | **Pass** |
| F | **Settings & branding** | profile update persist, user-settings persist, workspace branding persist, branding storage path | Pass (no defect) | — | — | **Pass** |
| F2 | **Branding uploads** | logos/signatures bucket path + policy model | Pass | — | — | **Pass** |
| G | **Authentication preservation** | sign-out clears session, sign-in, session identity, workspace resolution, client-role binding, protected reads, expired/anonymous access | Pass | — | No auth code modified | **Pass** |
| H | **Notifications & activity** | notification persist + unread state, feed read, mark-all-as-read, activity trail on mutations, cross-tenant visibility | Pass (no defect) | — | — | **Pass** |
| I | **Background jobs** | `claim_jobs` lease, lease exclusivity, attempt increment, `complete_job` + run ledger, `fail_job` requeue with backoff, `fail_job` dead-park, run ledger statuses, service-role-only execution | **Fail** — queue could not lease or retire work | `claim_jobs`/`complete_job`/`fail_job` RPCs missing | Migration 9 defines all three with `FOR UPDATE SKIP LOCKED` leasing and a durable `job_runs` ledger | **Pass** |
| I2 | **Portal invitations** | link generation, token-hash-only storage, public preview RPC, email masking, no internal id leakage, atomic claim, identity binding, single-use enforcement | **Fail** — atomic claim unavailable | `get_invitation_public_details` + `claim_client_invitation` RPCs missing | Migration 9 defines both; grant boundary limited to `service_role` | **Pass** |
| J | **Access control / isolation** | cross-workspace reads & writes, ownership tampering, anonymous access, cross-tenant storage, client-role scoping, new receipts/jobs isolation, financial-RPC caller authorization, queue-RPC privilege | Pass | — | New RPCs ship with in-function authorization + a `service_role`-only grant boundary | **Pass** |

---

## 3. Database report

### Objects verified
- **Tables:** 31 in `public` (30 pre-existing + `receipts`). Column contract test
  covers 31 tables × app-required columns — **0 column errors**.
- **Primary keys / foreign keys:** every table has a PK; the new `receipts` table
  adds 4 FKs (`workspaces`, `clients` SET NULL, `invoices` CASCADE,
  `invoice_payments` SET NULL).
- **Constraints added:** `receipts.amount > 0`; `UNIQUE (workspace_id, receipt_number)`;
  partial `UNIQUE (razorpay_payment_id)` on `receipts` and on `invoice_payments`
  (gateway idempotency).
- **Indexes added:** `receipts(invoice_id)`, `receipts(workspace_id)`,
  `receipts(client_id)`, `receipts(invoice_payment_id)`.
- **Functions:** 13 in `public` (4 pre-existing + `can_settle_invoice` + the 7
  previously missing application RPCs + the invitation pair). All are
  `SECURITY DEFINER` with `SET search_path = public`.
- **Triggers:** `handle_new_user` (unchanged) — verified to still auto-provision
  profile + workspace for each new user.
- **RLS:** enabled on all 31 tables. `receipts` policies: owner full control;
  bound client read-only for their own invoices' receipts.
- **Grant boundary (new hardening):** the queue and invitation RPCs are revoked
  from `PUBLIC`/`anon`/`authenticated` and granted to `service_role` only. The two
  financial RPCs are granted to `authenticated` **but** re-derive authorization
  in-function (`can_settle_invoice`), because `SECURITY DEFINER` bypasses RLS.
- **Storage buckets:** `avatars`/`logos`/`signatures` public-read,
  `documents`/`deliverables` private; unchanged and re-verified.

### Migration status
| # | File | Status |
|---|---|---|
| 1–7 | `20261015000001` … `20261015000007` | unchanged, re-applied on fresh DB |
| 8 | `20261015000008_feature_contract.sql` | unchanged, re-applied |
| **9** | **`20261015000009_rpc_layer_and_receipts.sql`** | **new** — additive and idempotent |

`supabase/schema.sql` regenerated as the concatenation of all 9 migrations
(2,537 lines) for SQL-editor application.

### Measured integrity properties
- Deleting a client that has invoices is **rejected** (`ON DELETE RESTRICT`) —
  financial history preserved.
- Duplicate invoice number within a workspace is **rejected**; the same number in
  a different workspace is **allowed**.
- Every settlement produces **exactly one** receipt; a replayed gateway event
  produces **none**.
- Monetary columns are exact `NUMERIC` (no float drift observed on 10,000 /
  1,000 / 11,000).

### Known schema risks (unchanged, informational)
1. `invoices.status` doubles as workflow **and** payment status
   (`draft`/`sent`/`partially_paid`/`paid`/`cancelled`) and has no check
   constraint, so an invalid value would be accepted.
2. `clients.email` has no unique constraint (see OBS-001).
3. Migration 7's `storage.objects` policies are wrapped in an
   exception-safe block; on a role that does not own `storage.objects` they are
   skipped with a NOTICE and must be applied from the dashboard.

---

## 4. Security report

| Probe | Result |
|---|---|
| Freelancer A reads own workspace records | Allowed (expected) |
| Freelancer A reads Workspace B records (list + guessed UUID) | **Denied** |
| Freelancer B inserts/updates/reassigns A's client | **Denied**, row unchanged |
| Anonymous read of clients / workspaces | **Denied** |
| Client A reads Client B's records (same workspace / other workspace) | **Denied** |
| Client A reads own bound client + invoices + receipts | Allowed (expected) |
| Cross-tenant signed URL for a private object | **Denied** |
| Cross-tenant download of a private object | **Denied** |
| Anonymous upload to the private `documents` bucket | **Denied** |
| B reads A's deliverables / invoices / projects / notifications / receipts / jobs | **Denied** |
| Authenticated non-owner calls `record_manual_payment` on A's invoice | **Denied** (`UNAUTHORIZED`) |
| Authenticated caller invokes `claim_jobs` | **Denied** (privilege revoked) |
| `anon` can execute any financial/queue/invitation RPC | **No** — asserted in the contract suite |
| Service-role access confined to server-side code | Yes — `supabaseAdmin` is server-only; RPCs are service-role-gated |

**Remaining security concerns:** none identified. No policy was relaxed and no
test was weakened to pass. The only grant widening relative to the (non-existent)
prior state is `EXECUTE` for `record_manual_payment`/`settle_razorpay_payment` to
`authenticated`, which is compensated by an in-function owner/client check that
is verified by an explicit negative test.

---

## 5. Fix inventory

### FIX-1 — Recreate the missing RPC layer and receipts ledger (DB-001, DB-002, DB-006)
- **Severity:** HIGH
- **Root cause:** the rebuild reconciled tables/columns but not the function
  layer or the `receipts` table.
- **Files changed:** `supabase/migrations/20261015000009_rpc_layer_and_receipts.sql` (new),
  `supabase/schema.sql` (regenerated), `src/backend/freelancer/index.ts` (invoice
  select now requests `receipts(*)`).
- **Migrations:** `20261015000009_rpc_layer_and_receipts.sql`.
- **Regression tests:** `tests/schema-contract-local.test.ts` (derives required
  tables/joins/RPCs from source; asserts grant boundary),
  `tests/db-workflows-local.test.ts` (settlement, idempotency, receipts, jobs,
  invitations), `tests/schema-conformance-local.test.ts` (+`receipts` columns),
  `tests/razorpay-payment.test.ts` (assertions now read the real SQL).
- **Evidence:** 116/116 workflow assertions, 47/47 contract assertions, 31/31
  column-contract assertions.

### FIX-2 — Stop double-encoding project milestones (DB-003)
- **Severity:** HIGH
- **Root cause:** `JSON.stringify()` applied to a JSONB column.
- **Files changed:** `src/backend/freelancer/index.ts` (4 sites).
- **Regression tests:** `db-workflows-local` — "milestones round-trip as a JSON
  array" + "survives a reload with milestones readable by the UI".
- **Evidence:** before — column holds `"[{\"id\":\"ms-1\",…}]"` (string);
  after — 2-element JSON array round-trips.

### FIX-3 — Reject non-positive settlement amounts (DB-004)
- **Severity:** HIGH
- **Root cause:** call sites coerced `amount <= 0` to `NULL`, which the RPC
  defines as "settle the full balance".
- **Files changed:** `src/backend/freelancer/index.ts`,
  `app/api/invoices/[invoiceId]/payments/offline/route.ts`.
- **Regression tests:** `db-workflows-local` — "Non-positive payment amount is
  rejected" and "Overpayment is rejected".
- **Evidence:** `amountSettled: -5` now throws
  `Payment amount must be greater than zero.` and leaves the invoice untouched.

### FIX-4 — Fail closed instead of serving demo data in production (DB-005)
- **Severity:** HIGH
- **Root cause:** 27 unguarded `FlowDeskStore` fallbacks in production paths.
- **Files changed:** `src/backend/freelancer/index.ts` (added
  `demoFallbackAllowed()`; all fallbacks gated; writes now throw).
- **Regression tests:** `db-workflows-local` — "No session yields no deliverables
  (never demo/mock data)", "…no deliverable detail".
- **Evidence:** without a session, `getDeliverables()` now returns 0 records
  (previously the demo fixture set).

### FIX-5 — Make the payments test suite assert reality (QA-001)
- **Severity:** MEDIUM
- **Root cause:** 17 `assert(true, …)` claims citing a non-existent migration.
- **Files changed:** `tests/razorpay-payment.test.ts` (added schema/source
  introspection; all 17 assertions replaced with real checks).
- **Evidence:** 48/48 assertions pass, and each now reads
  `supabase/migrations/*.sql` or the calling source file, so deleting the
  migration fails the suite.

### FIX-6 — Unblock the repository's own CI gate (CI-001)
- **Severity:** MEDIUM
- **Root cause:** the secret scanner flagged the fixed local-development JWT
  fixtures.
- **Files changed:** `scripts/check-secrets.ts`.
- **Approach:** detect the fixture by its `iss: "supabase-demo"` claim (decoded
  from the token), not by literal value — so real project tokens still fail.
- **Evidence:** scanner passes on the repo; a synthetic token whose `iss` is a
  project URL is still flagged (negative control executed).

### FIX-7 — Register the new live-DB suites (tooling)
- **Files changed:** `package.json` — added `test:contract:local`,
  `test:workflows:local`, `test:db:local`.

---

## 6. Outstanding issues

| Issue | Why unresolved | Impact | Needs you? | Recommended next action |
|---|---|---|---|---|
| **Remote project not updated** | No credential is available in the repository: `.env.local` has no `DATABASE_URL` (DB password) and no Supabase access token, so neither `supabase db push` nor a direct `pg` migration run is possible. Applying is also a production change, which requires your explicit authorization for this specific action. | The fixes exist and are verified locally only. The live app still runs on the old schema, so invoice settlement, the job queue, invitations, milestones and receipts remain broken **in production**. | **Yes** — provide either the project's DB connection string (`DATABASE_URL`) or a Supabase access token + project ref. | Apply migration 9 (additive, idempotent) — see § 8. |
| **Live-browser E2E not executed** | No Playwright/DOM harness exists in the repository. | UI states (loading/empty/error, upload progress, navigation after mutation) are verified only through the service/API layer and a successful production build. | No | Add a Playwright smoke suite for the client → project → invoice → pay path against a preview deployment. |
| **Demo data scope undecided** (OBS-003) | Full removal would delete a documented feature (`NEXT_PUBLIC_AUTH_MODE=demo`), touch ~20 files and break 10+ offline suites that assert demo behaviour. Production exposure is already closed. | Demo/mock fixtures remain in the repo and in the demo deployment path. | **Yes** — choose scope (see § 8). | Pick one of the three options in § 8. |
| **`clients.email` has no unique constraint** (OBS-001) | Adding one is a product decision and could reject existing production rows. | Duplicate client records are possible. | Optional | Decide whether same-email clients are legitimate; if not, add a partial unique index per workspace after a data audit. |
| **`invoices.status` has no check constraint** | Adding one may reject legacy production values; requires a data audit first. | An invalid status value would be accepted. | Optional | Audit distinct `status` values on the remote DB, then add a matching check constraint. |

---

## 7. Post-fix verification (Phase I)

| Check | Command | Baseline | Final |
|---|---|---|---|
| Unified offline suite | `npm run test:all` | 30/31 (1 failed) | **31/31** |
| Contract + isolation + workflows | `npm run test:db:local` | not covered | **211/211** |
| Column contract | `npm run test:schema:local` | 30/30 tables | **31/31 tables** |
| App↔schema contract (derived from source) | `npm run test:contract:local` | **not covered** | **47/47** |
| RLS isolation (live) | `npm run test:rls:local` | 17/17 | **17/17** |
| DB workflow integration (live) | `npm run test:workflows:local` | **not covered** | **116/116** |
| Payments & financial integrity | `npm test` | 48/48 (17 vacuous) | **48/48 (all substantive)** |
| TypeScript | `npx tsc --noEmit` | 0 errors | **0 errors** |
| ESLint | `npx eslint .` | 0 errors | **0 errors** |
| Production build | `npm run build` | success | **success** |
| Fresh-DB reproducibility | `npx supabase db reset` | 8 migrations | **9 migrations** |

No failing assertion was converted to a passing one: every new check was added
alongside the fixes, the previously vacuous assertions were replaced with
strictly stronger checks, and no RLS policy was relaxed.

---

## 8. Two decisions needed

### 8a. Apply the fix to the real Supabase project

Migration 9 is **additive and idempotent** — `CREATE TABLE IF NOT EXISTS`,
`CREATE OR REPLACE FUNCTION`, `ADD COLUMN IF NOT EXISTS` only. It contains no
`DROP TABLE`, no `TRUNCATE`, no `DELETE`, and it never touches `auth.users`,
identities or sessions. It cannot delete or reset data.

Choose one:

1. **CLI (recommended).** Provide a Supabase access token + project ref, or run it
   yourself:
   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push        # applies migration 9 only
   ```
2. **SQL editor.** Paste the contents of `supabase/schema.sql` into the SQL
   editor and run it (all statements are idempotent; safe to re-run).
3. **Direct connection.** Set `DATABASE_URL` in `.env.local` (dashboard →
   Settings → Database → Connection string URI) and run:
   ```bash
   npx tsx scripts/apply-migrations.ts
   ```

Then verify against the live project:
```bash
npx supabase gen types typescript --local > src/shared/types/database.types.ts
```
(and re-run the workflow suite with `SUPABASE_TEST_URL`/keys pointed at a test
project — **never** destructive integration tests against production).

⚠️ Before applying to production: confirm `supabase/config.toml` `major_version = 17`
matches the remote PostgreSQL version, and take a snapshot/PITR backup point.

### 8b. Demo data removal

Production exposure is already closed (FIX-4). Remaining scope options:

1. **Recommended:** keep the demo mode as a deliberate, isolated feature
   (it is documented and covered by tests) — no further change.
2. Purge the mock fixtures (`src/backend/store/mockData.ts`) and rewrite the
   10+ demo-mode suites against live test data.
3. Remove demo mode entirely (`NEXT_PUBLIC_AUTH_MODE`, `FlowDeskStore`,
   `DemoDataProvider`, the demo branches in ~20 files) as a single dedicated
   refactor with its own test updates.

---

## 9. Release recommendation

**READY FOR CONTROLLED PREVIEW TESTING.**

All 8 verified defects are fixed and re-verified through the real execution path
(391 assertions, 0 failures), the production build succeeds, authentication is
intact, and no cross-tenant leak was found. A preview deployment is the correct
next step.

**Not** production-ready until: (a) migration 9 is applied to the live project —
without it, payment settlement, the job queue, portal invitations, project
milestones and receipt history remain broken in production; and (b) a
live-browser smoke pass is green against the preview deployment.

*The build passing alone is not treated as evidence of production readiness.*
