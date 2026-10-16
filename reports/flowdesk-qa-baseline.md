# FlowDesk — Database & Application QA Baseline Report

**Date:** 2026-10-16
**Scope:** End-to-end audit of database-backed FlowDesk features: schema, RLS,
storage, financial workflows, background jobs, and portal invitations.
**Report type:** Baseline (pre-fix). See `reports/flowdesk-qa-final.md` for the
post-fix results.

---

## 1. Environment tested

| Item | Value |
|---|---|
| Application | Next.js 15 (App Router), TypeScript, React 19 |
| Database | **Local** Supabase stack (Docker), PostgreSQL 17 |
| Supabase CLI | 2.121.0 |
| Project id | `Flowdesk_v1` (local) |
| API / DB endpoints | `http://127.0.0.1:54321` / `127.0.0.1:54322` |
| Auth mode under test | `NEXT_PUBLIC_AUTH_MODE=production` |
| Migrations applied | 8 files, fresh DB via `npx supabase db reset` |
| Remote project | **Not touched.** No remote migration, reset, or data change. |
| Test identities | Synthetic only (`@example.test`), created and deleted by the suite |
| Secrets | No values read, logged, or printed. All findings are secret-free. |

Local development credentials used by the suites are the fixed, publicly
documented `supabase start` fixtures (issuer `supabase-demo`); they are not
secrets and are unusable against any hosted project.

---

## 2. Method

1. Traced every UI/API operation to its service function, database query, and
   policy.
2. Derived the *actual* dependency surface **from source**: every
   `.from('table')`, every embedded join inside `.select('...')`, and every
   `.rpc('function')` call.
3. Confronted that derived surface with the live database (PostgREST OpenAPI
   spec + direct PostgreSQL catalog reads).
4. Exercised the real service layer with real authenticated sessions against the
   real database, verifying each mutation with an independent service-role read.

The pre-existing `tests/data-workflow-e2e.test.ts` was **not** used as evidence:
it runs against the in-memory demo store with `NEXT_PUBLIC_AUTH_MODE=demo`, so it
cannot detect database defects.

---

## 3. Baseline results

| Check | Command | Pre-fix result |
|---|---|---|
| Offline/unit/security suite | `npm run test:all` | **30/31 steps** — 1 FAILED (secret scanner) |
| Payments security suite | `npm test` | 48/48 (see QA-001 — 17 were vacuous) |
| Column contract | `npm run test:schema:local` | 30/30 tables, 0 errors |
| RLS isolation | `npm run test:rls:local` | 17/17 assertions |
| App↔schema contract (derived) | *new* | **Not previously covered — defects found** |
| DB workflow integration (derived) | *new* | **Not previously covered — defects found** |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| ESLint | `npx eslint .` | 0 errors |
| Production build | `npm run build` | success |
| Fresh-DB reproducibility | `npx supabase db reset` | 8 migrations applied |

---

## 4. Findings

Severity levels: **CRITICAL** (unauthorized data access / cross-tenant leak /
auth compromise / destructive data loss), **HIGH** (broken core CRUD, failed
private uploads, incorrect financial calculations, major authorization
failures), **MEDIUM** (incomplete workflows, invalid state handling, reliability),
**LOW** (minor UI/validation).

### DB-001 — Application RPC layer did not exist in the schema — **HIGH** — *Verified defect*

- **Expected:** Every `supabase.rpc('...')` the application calls resolves to a
  function defined by a version-controlled migration.
- **Actual:** Seven called functions were defined in **no** `.sql` file in the
  repository and did not exist in the live database:

  | RPC | Called from | Impact when missing |
  |---|---|---|
  | `record_manual_payment` | `src/backend/freelancer/index.ts`, `app/api/invoices/[invoiceId]/payments/offline/route.ts` | Offline/partial invoice settlement fails outright — **no fallback path** |
  | `settle_razorpay_payment` | `src/backend/payments/payment-service.ts` | Online payment settlement fails; `success:false` returned to the client |
  | `claim_jobs` | `src/backend/jobs/runner.ts` | Background job queue cannot lease work — **no fallback path** |
  | `complete_job` | `src/backend/jobs/runner.ts` | Successful jobs never leave `running` |
  | `fail_job` | `src/backend/jobs/runner.ts` | Failed jobs never retry or die |
  | `get_invitation_public_details` | `src/backend/invitations/invitation-service.ts` | Portal invitation preview lost (fell back to a non-atomic read) |
  | `claim_client_invitation` | `src/backend/invitations/invitation-service.ts` | Invitation claim lost its single-use atomic guarantee |

- **Reproduction:** `select proname from pg_proc where pronamespace='public'::regnamespace;`
  → only `get_auth_client_ids`, `handle_new_user`, `is_client_user`, `is_workspace_owner`.
- **Root cause:** The database rebuild reconciled **tables and columns** but never
  reconciled the **function layer**. Because the functions were absent from every
  migration, they were equally absent from the live (and any remote) database.
- **Affected features:** invoice payment (offline **and** online), financial
  receipt history, recurring invoices, automated reminders, transactional email
  retries, client portal invitations.
- **Data integrity / security:** Both. Payments could not be recorded at all
  (integrity); the queue and invitation atomicity guarantees were void.

### DB-002 — `receipts` table missing while being read and written — **HIGH** — *Verified defect*

- **Expected:** The `receipts` ledger referenced by the application exists.
- **Actual:** `receipts(*)` embedded joins and receipt inserts are used in 8
  places, but no migration creates the table.
- **Reproduction:** `.select('*, invoice_items(*), invoice_payments(*), receipts(*)')`
  → PostgREST error: no relationship between `invoices` and `receipts`.
- **Affected code:** `src/backend/client/client-invoice-service.ts:22`,
  `src/backend/payments/payment-service.ts:455,790,797`,
  `app/api/payments/[paymentId]/route.ts:53,62`,
  `src/backend/freelancer/index.ts` (receipt mapping).
- **Impact:** The client-portal invoice list and the payment-status endpoint
  failed to load; durable receipts could never be persisted.
- **Note:** `docs/DATABASE-REBUILD-REPORT.md` §16 asserted `receipts` "appeared
  in the historical schema but is referenced by **0** current source files".
  That claim is **incorrect** — it is referenced in 5 current source files.
- **Data integrity / security:** Integrity (financial audit trail lost).

### DB-003 — Project milestones stored double-encoded, then silently dropped — **HIGH** — *Verified defect*

- **Expected:** `projects.milestones` (JSONB) holds a JSON array.
- **Actual:** The service serialised the array before handing it to PostgREST:
  `milestones: JSON.stringify(project.milestones || [])`, so the JSONB column
  stored a JSON **string** (e.g. `"[{\"id\":\"ms-1\",…}]"`) instead of an array.
- **Reproduction:** create a project with two milestones and read the row back.
  Measured: `Array.isArray(row.milestones) === false`; the value is a string.
- **Progressive data loss:** `toggleMilestone` and `addMilestone` read with
  `Array.isArray(proj.milestones) ? proj.milestones : []`, so the next milestone
  toggle **replaces all existing milestones with an empty array**, permanently
  destroying them.
- **Affected code:** `src/backend/freelancer/index.ts` — `createProject`,
  `updateProject`, `toggleMilestone`, `addMilestone`.
- **Data integrity / security:** Integrity (irrecoverable milestone loss).

### DB-004 — Non-positive settlement amount silently upgraded to a full settlement — **HIGH** — *Verified defect*

- **Expected:** An explicit amount `<= 0` is rejected as invalid.
- **Actual:** Both call sites coerced any non-positive amount to `NULL`, and the
  RPC defines `NULL` as "settle the entire outstanding balance":
  `const settleAmount = amount !== undefined && amount > 0 ? amount : null;`
- **Reproduction (measured):** calling offline settlement with `amountSettled: -5`
  on an invoice with a 6,000 balance did not throw — it **settled the full
  6,000** and marked the invoice `paid`.
- **Affected code:** `src/backend/freelancer/index.ts` (`markInvoicePaidOffline`),
  `app/api/invoices/[invoiceId]/payments/offline/route.ts`.
- **Data integrity / security:** Integrity (incorrect financial state from an
  invalid input).

### DB-005 — Production code paths fell back to fabricated demo data — **HIGH** — *Verified defect*

- **Expected:** In production auth mode a database failure surfaces as a failure.
- **Actual:** 27 deliverable-related code paths returned `FlowDeskStore`
  (in-memory mock/local data) without a demo-mode guard when
  `window === undefined`, when no workspace resolved, or when a query errored:
  `getDeliverables` (3 sites), `getDeliverableById` (3), `addDeliverable` (2),
  `uploadNewVersion` (2), `addDeliverableComment` (2), `approveDeliverable` (2),
  `requestDeliverableRevision`, `submitDeliverableClientReview`,
  `addDeliverableFile` (2), `renameDeliverableFile`, `deleteDeliverableFile`,
  `togglePinDeliverableFile`, `toggleResolveDeliverableComment`,
  `restoreDeliverableVersion`, `updateDeliverableInternalNotes` (2),
  `bulkUpdateDeliverables` helpers.
- **Reproduction (measured):** with no authenticated session in production mode,
  `FreelancerDeliverableService.getDeliverables()` returned the demo fixture set
  instead of an empty result; `addDeliverable` returned a fabricated deliverable
  while persisting nothing.
- **Impact:** A user could be shown another product's sample data in place of
  their own, and receive "success" for a write that never happened. This is
  exactly the failure mode the client-side services already guard against.
- **Data integrity / security:** Integrity + trust (fabricated data, masked
  failures). No cross-tenant data was exposed — the fallback is local, not remote.

### DB-006 — Freelancer invoice list ignored the durable receipt ledger — **MEDIUM** — *Verified defect*

- **Expected:** The receipt mapping added for the freelancer invoice list should
  read the persisted `receipts` rows.
- **Actual:** `FreelancerInvoiceService.getInvoices` selected
  `... , invoice_payments(*)` **without** `receipts(*)`, so the mapping's
  `i.receipts` branch was dead code and receipt numbers were always synthesised
  from payment rows (`RCP-<invoice>-<first4>`), diverging from the durable
  receipt numbers.
- **Affected code:** `src/backend/freelancer/index.ts` (`getInvoices`).
- **Data integrity:** Presentation/consistency.

### QA-001 — 17 vacuous assertions claimed a migration that does not exist — **MEDIUM** — *Verified defect*

- **Expected:** A test that asserts database behaviour should fail when the
  behaviour is missing.
- **Actual:** `tests/razorpay-payment.test.ts` contained 17 assertions of the
  form `assert(true, '<claim>', 'Phase27: …')`, each citing a "phase27 migration"
  that exists in no commit. They reported `✅ PASS` for `record_manual_payment`,
  `settle_razorpay_payment` idempotency/`FOR UPDATE`/authorization, and the
  `receipts` insert — **all of which were absent from the database**.
- **Impact:** The defect class in DB-001/DB-002 was invisible to CI. The suite
  actively certified a non-existent control.
- **Data integrity / security:** Process — false assurance on financial controls.

### CI-001 — The repository's own CI command failed on a clean checkout — **MEDIUM** — *Verified defect*

- **Expected:** `npm run test:all` passes on a clean checkout.
- **Actual:** Step 3 (`Hardcoded Secrets Detection`) failed with 3 violations
  raised against `tests/rls-isolation-local.test.ts:21,24` and
  `tests/schema-conformance-local.test.ts:19` — the fixed, publicly documented
  **local development** JWT fixtures that the Supabase CLI itself prints.
- **Impact:** The project's own quality gate was red; a genuine secret in a test
  file would have been lost in the noise.
- **Data integrity / security:** Process, not a real credential exposure.

### OBS-001 — Duplicate client emails are permitted — **LOW** — *Suspected / product decision*

- `clients.email` has no unique constraint, so the same address may appear many
  times in a workspace. Deduplication is application-level only (matching an
  existing `profiles.email`). Recorded as an observation, not a defect: the
  product may intentionally allow the same human across multiple client records.
  **No change made** — adding a constraint is a product decision and could
  reject existing production rows.

### OBS-002 — No live-browser (Playwright) end-to-end run — **Not executed**

- No Playwright/browser harness exists in the repository. UI behaviour is
  verified through the service/API layer plus the production build. Real-browser
  crawl (loading/empty/error states, upload progress) remains untested.
  Recorded as **test not executed**, not as passed.

### OBS-003 — Demo/mock data remains embedded in the application — **Observation**

- `src/backend/store/mockData.ts` and the `NEXT_PUBLIC_AUTH_MODE=demo` code path
  are a deliberate, documented feature (a dedicated demo deployment) and are also
  relied upon by 10+ offline test suites. Production exposure has been closed by
  the DB-005 fix; wholesale removal is a product decision (see final report §
  Outstanding issues).

---

## 5. What already passed (not regressions)

- Schema column contract: 30/30 tables × app-required columns.
- RLS isolation: 17/17 (cross-workspace reads/writes, ownership tampering,
  anonymous access, cross-tenant storage, client-role isolation).
- Financial-history protection: `invoices.client_id` is `ON DELETE RESTRICT`;
  measured — deleting a client that has invoices is rejected.
- Constraint enforcement: NOT NULL, status domains, non-negative money,
  `quantity > 0`, completion 0–100 — all measured as enforced.
- Authentication: sign-in/sign-out/session restoration/middleware all functioned;
  nothing in this work modified Supabase Auth.
- Build, typecheck, lint: clean.

---

## 6. Cross-tenant / authorization probes (baseline)

All probes below **passed** at baseline (no leak found):
freelancer B cannot read A's clients, projects, invoices, deliverables,
notifications, receipts or job rows; a bound client portal user reads only their
own records; anonymous callers read nothing; ownership-field tampering is
rejected on both `USING` and `WITH CHECK`; private storage objects are not
retrievable across tenants.

---

## 7. Release recommendation at baseline

**NOT READY: HIGH-PRIORITY ISSUES REMAIN.** Payment settlement (offline and
online), the background job queue, portal invitation atomicity, project
milestones, and the durable receipt ledger were all non-functional in
production auth mode. Proceed to Phase H fixes (`reports/flowdesk-qa-final.md`).
