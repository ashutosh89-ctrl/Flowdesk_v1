# Phase 5A Remediation Report: Server-Boundary Migration

**Timestamp:** 2026-10-08  
**Repository:** FlowDesk (Next.js 15 App Router, React 19, TypeScript, Supabase, Razorpay, Brevo/Resend)  
**Author:** Staff-Level Full-Stack & Application Security Reviewer  
**Scope:** Phase 5A (Tasks 1 to 3: Server-Boundary Migration)  
**Status:** **5A Complete** (Run 5B in a fresh session)

---

## 1. Executive Summary

In Phase 5A, all high-risk client-side database write operations across money/invoices, deliverables/approvals, client provisioning/invitations, and account/settings were systematically migrated across the network boundary to authenticated, server-enforced Next.js App Router route handlers under `/api/`.

Every migrated mutation adheres strictly to the hardened Phase 4 reference architecture:
1. **Cookie-Aware Session Authentication:** Caller identity is resolved strictly from verified Supabase session cookies via `requireApiCaller()`, never trusting user IDs or tenant IDs passed in HTTP request bodies or query parameters.
2. **Schema Validation:** Strict runtime payload parsing via Zod (`parseJsonBody` and `validateRouteParam`) rejecting unexpected fields (`.strict()`).
3. **Pure Business Rules Engine:** Zero-I/O domain rules in `src/shared/rules/` shared across server routes and frontend UI elements (status machine validation, totals recalculation, invoice numbering).
4. **Idempotency & Atomic State Transitions:** Optimistic locking via SQL conditions (`WHERE status = expected_previous_status`) and header/natural key deduplication.
5. **Non-Blocking Server Side Effects:** Asynchronous event logging, activity recording, and transactional email triggers (Brevo/Resend) handled server-side without blocking API responses.
6. **Zero-Breaking Rollout Gating:** Each batch is controlled by a dedicated runtime feature flag (`NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1..4`, defaulting ON in code with fallback to previous direct repository path).
7. **Demo Mode Preserved:** 100% offline functionality retained in demo mode (`isDemoModeActive()`), bypassing network calls and mutating local storage stores seamlessly.
8. **Tightened RLS Migrations:** 4 unapplied SQL migrations (`phase36` through `phase39`) generated to revoke client-side INSERT/UPDATE/DELETE policies while maintaining read-only SELECT access.

---

## 2. Baseline vs Final Verification Summary

| Check | Baseline (Pre-5A) | Final (Post-5A) | Status |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | PASS (0 errors) | PASS (0 errors) | ✅ CONFIRMED |
| `npm run lint` | PASS (0 errors, 4 warnings) | PASS (0 errors, 4 warnings) | ✅ CONFIRMED |
| `npm run check:secrets` | PASS (0 secrets in 345 files) | PASS (0 secrets in 364 files) | ✅ CONFIRMED |
| `npm run test:all` | 18/18 suites PASS | 23/23 suites PASS | ✅ CONFIRMED |
| `npm run build` | Next.js build clean | All 38 routes prerendered / dynamic | ✅ CONFIRMED |

---

## 3. Per-Task Implementation Details

### Task 1: Migration Design & Pure Business Rules

#### 1.1 Architecture & Roadmap Update
- Re-verified top-priority mutation rows in [`docs/audits/ARCHITECTURE-BOUNDARY-PLAN.md`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/docs/audits/ARCHITECTURE-BOUNDARY-PLAN.md).
- Formulated the comprehensive migration design document [`docs/audits/SERVER-BOUNDARY-MIGRATION.md`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/docs/audits/SERVER-BOUNDARY-MIGRATION.md), partitioning operations into 4 risk-ordered batches of $\le 4$ mutations each.

#### 1.2 Pure Domain Business Rules Engine
Created zero-I/O rules module in `src/shared/rules/`:
- [`src/shared/rules/invoice-rules.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/rules/invoice-rules.ts): Status transition table (`draft` $\rightarrow$ `sent` $\rightarrow$ `paid`/`partially_paid`/`cancelled`), transition authorization guards, authoritative invoice totals calculation (discount, tax rate, tax name), and sequential numbering formatting.
- [`src/shared/rules/deliverable-rules.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/rules/deliverable-rules.ts): Status transition table (`draft` $\rightarrow$ `submitted` $\rightarrow$ `approved`/`revision_requested`), role guards (client vs freelancer), version note constraints.
- [`src/shared/rules/index.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/rules/index.ts): Barrel export for server and client UI consumption.
- Exhaustive unit test suite [`tests/shared-rules.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/shared-rules.test.ts) (30/30 unit tests pass).

#### 1.3 Feature Flag Infrastructure
Implemented [`src/shared/config/feature-flags.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/config/feature-flags.ts) and documented flags in [`.env.example`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/.env.example):
- `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1`: Invoices & Payments (default ON)
- `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_2`: Approvals & Deliverables (default ON)
- `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_3`: Clients & Invitations (default ON)
- `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_4`: Account & Settings (default ON)

---

### Task 2: Implementation of Batches 1 to 4

#### Batch 1: Money & Invoices
- **Server Routes:**
  - `POST /api/invoices`: Server-side invoice creation with auto-calculated totals.
  - `PATCH /api/invoices/[invoiceId]`: Authoritative invoice updates and soft deletion.
  - `DELETE /api/invoices/[invoiceId]`: Hard invoice deletion restricted to workspace owner.
  - `POST /api/invoices/[invoiceId]/status`: Atomic status transition enforcing valid state machine and email dispatch.
  - `POST /api/invoices/[invoiceId]/payments/offline`: Offline manual payment recording with receipt creation and balance tracking.
  - `GET /api/invoices/next-number`: Atomic sequence number generation based on workspace formatting.
- **Client Service Delegation:**
  - Updated `src/backend/freelancer/index.ts` (`createInvoice`, `updateInvoice`, `deleteInvoice`, `markInvoicePaidOffline`, `recordInvoiceView`).
- **Tightened RLS Migration:**
  - Created unapplied [`database/migrations/phase36_tighten_invoice_client_writes.sql`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase36_tighten_invoice_client_writes.sql).
- **Automated Tests:**
  - [`tests/invoice-server-mutations.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/invoice-server-mutations.test.ts) (11/11 tests pass).

#### Batch 2: Approvals & Deliverables
- **Server Routes:**
  - `POST /api/deliverables/[deliverableId]/submit`: Freelancer submission transition (`draft`/`revision_requested` $\rightarrow$ `submitted`) with deadline validation and client notification dispatch.
  - `POST /api/deliverables/[deliverableId]/revision`: Client revision request (`submitted` $\rightarrow$ `revision_requested`) requiring feedback and notifying freelancer.
  - `POST /api/deliverables/[deliverableId]/versions`: Secure deliverable asset version attachment.
  - `POST /api/deliverables/[deliverableId]/comments`: Audit-logged deliverable feedback thread messages.
- **Client Service Delegation:**
  - Updated `ClientDeliverableService` ([`src/backend/client/client-deliverable-service.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/client/client-deliverable-service.ts)) and `FreelancerDeliverableService` ([`src/backend/freelancer/index.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/freelancer/index.ts)).
- **Tightened RLS Migration:**
  - Created unapplied [`database/migrations/phase37_tighten_deliverable_client_writes.sql`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase37_tighten_deliverable_client_writes.sql).
- **Automated Tests:**
  - [`tests/deliverable-server-mutations.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/deliverable-server-mutations.test.ts) (8/8 tests pass).

#### Batch 3: Client Management & Invitations
- **Server Routes:**
  - `POST /api/clients`: Server-side client provisioning with workspace ownership checks and auto-invitation dispatch.
  - `PATCH /api/clients/[clientId]`: Client metadata update and status archiving.
  - `DELETE /api/clients/[clientId]`: Workspace-isolated client deletion.
  - `POST /api/clients/[clientId]/invitation`: Secure 256-bit cryptographic one-time connection token generation, SHA-256 hash storage, and Brevo invitation delivery.
  - `DELETE /api/clients/[clientId]/invitation`: Instant invitation revocation.
- **Client Service Delegation:**
  - Updated `FreelancerClientManagementService` ([`src/backend/freelancer/client-management-service.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/freelancer/client-management-service.ts)).
- **Tightened RLS Migration:**
  - Created unapplied [`database/migrations/phase38_tighten_client_invitation_writes.sql`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase38_tighten_client_invitation_writes.sql).
- **Automated Tests:**
  - [`tests/client-server-mutations.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/client-server-mutations.test.ts) (9/9 tests pass).

#### Batch 4: Account & Settings
- **Server Routes:**
  - `PATCH /api/account/settings`: User localization, billing terms, tax rate, and invoice sequence formatting.
  - `PATCH /api/account/notifications`: Granular notification and digest preference toggles.
  - `POST /api/account/delete`: Multi-tiered account deletion (freelancer 5-day grace period with scheduled email; client 30-day grace period).
  - `POST /api/account/restore`: Grace-period account recovery and workspace un-freezing.
- **Client Service Delegation:**
  - Updated `UserSettingsService` ([`src/backend/auth/user-settings-service.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/auth/user-settings-service.ts)) and `AccountDeletionService` ([`src/backend/auth/account-deletion-service.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/auth/account-deletion-service.ts)).
- **Tightened RLS Migration:**
  - Created unapplied [`database/migrations/phase39_tighten_settings_account_writes.sql`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase39_tighten_settings_account_writes.sql).
- **Automated Tests:**
  - [`tests/account-server-mutations.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/account-server-mutations.test.ts) (8/8 tests pass).

---

### Task 3: Decommission Leftovers & Split Proposals

#### 3.1 Unused Dependencies Audit (Grep Evidence)
- **`firebase-tools` (v15.0.0):**
  - *Grep Evidence:* Only referenced in `package.json:50` and `package-lock.json`. Zero imports or scripts across the entire project.
  - *Recommendation:* Remove via `npm uninstall firebase-tools`. Zero risk.
- **`@google/genai` (v2.4.0):**
  - *Grep Evidence:* Present in `package.json:17`, but never imported in any source file (`src/` or `app/`). Only mentioned as text in PDF generator scripts.
  - *Recommendation:* Safe to remove via `npm uninstall @google/genai`.
- **`html2canvas` (v1.4.1):**
  - *Grep Evidence:* Actively imported and used in `src/shared/utils/invoice-export.ts:2`.
  - *Recommendation:* **KEEP.** Removing this package would break client-side PDF image rasterization.

#### 3.2 Five Largest Files & Modular Split Proposals
1. **`src/backend/freelancer/index.ts` (120,733 bytes):**
   - *Current Content:* Monolithic service aggregation for invoices, projects, deliverables, tasks, and activities.
   - *Split Proposal:* Split into domain-specific sub-services under `src/backend/freelancer/`:
     - `freelancer-invoice-service.ts`
     - `freelancer-project-service.ts`
     - `freelancer-task-service.ts`
     - `freelancer-activity-service.ts`
2. **`src/backend/store/storage-store.ts` (102,666 bytes):**
   - *Current Content:* Large mock database simulating all tables in local storage.
   - *Split Proposal:* Extract entities into separate store modules:
     - `src/backend/store/modules/invoice-store.ts`
     - `src/backend/store/modules/deliverable-store.ts`
     - `src/backend/store/modules/client-store.ts`
3. **`src/frontend/freelancer/deliverables/components/deliverable-workspace-modal.tsx` (78,875 bytes):**
   - *Current Content:* All modal panels (comments, review forms, version history, file preview) in a single component.
   - *Split Proposal:* Extract sub-components into `src/frontend/freelancer/deliverables/components/modal/`:
     - `version-history-panel.tsx`
     - `submission-form-panel.tsx`
     - `deliverable-comments-thread.tsx`
4. **`src/frontend/freelancer/settings/settings-view.tsx` (71,493 bytes):**
   - *Current Content:* Contains profile form, workspace branding, invoice settings, notification preferences, and danger zone in one file.
   - *Split Proposal:* Extract tabs into `src/frontend/freelancer/settings/tabs/`:
     - `general-settings-tab.tsx`
     - `invoice-config-tab.tsx`
     - `notifications-tab.tsx`
     - `danger-zone-tab.tsx`
5. **`src/shared/utils/invoice-pdf.ts` (35,272 bytes):**
   - *Current Content:* jsPDF canvas generation, fonts, tabular formatting, and total computations.
   - *Split Proposal:* Split into:
     - `src/shared/utils/pdf/pdf-layout-engine.ts`
     - `src/shared/utils/pdf/pdf-invoice-theme.ts`

---

## 4. Database Migrations Schedule & Deployment Plan

The new migrations MUST NOT be applied until the code changes are deployed and the feature flags are active in production:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Deploy Phase 5A Application Code to Staging / Production  │
│    (Feature flags default to ON)                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Verify Server Routes Active & Operational                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Apply Tightened RLS Migrations (in numeric order):        │
│    - phase36_tighten_invoice_client_writes.sql              │
│    - phase37_tighten_deliverable_client_writes.sql          │
│    - phase38_tighten_client_invitation_writes.sql           │
│    - phase39_tighten_settings_account_writes.sql            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Summary of Files Changed & Created

### New API Route Handlers
- `app/api/invoices/route.ts`
- `app/api/invoices/[invoiceId]/route.ts`
- `app/api/invoices/[invoiceId]/status/route.ts`
- `app/api/invoices/[invoiceId]/payments/offline/route.ts`
- `app/api/invoices/next-number/route.ts`
- `app/api/deliverables/[deliverableId]/submit/route.ts`
- `app/api/deliverables/[deliverableId]/revision/route.ts`
- `app/api/deliverables/[deliverableId]/versions/route.ts`
- `app/api/deliverables/[deliverableId]/comments/route.ts`
- `app/api/clients/route.ts`
- `app/api/clients/[clientId]/route.ts`
- `app/api/clients/[clientId]/invitation/route.ts`
- `app/api/account/settings/route.ts`
- `app/api/account/notifications/route.ts`
- `app/api/account/delete/route.ts`
- `app/api/account/restore/route.ts`

### New Shared Rules & Config
- `src/shared/rules/invoice-rules.ts`
- `src/shared/rules/deliverable-rules.ts`
- `src/shared/rules/index.ts`
- `src/shared/config/feature-flags.ts`
- `docs/audits/SERVER-BOUNDARY-MIGRATION.md`

### Modified Service & Configuration Files
- `src/shared/validation/schemas.ts`
- `src/backend/freelancer/index.ts`
- `src/backend/client/client-deliverable-service.ts`
- `src/backend/freelancer/client-management-service.ts`
- `src/backend/auth/user-settings-service.ts`
- `src/backend/auth/account-deletion-service.ts`
- `scripts/test-all.ts`
- `.env.example`

### New Unapplied SQL Migrations
- `database/migrations/phase36_tighten_invoice_client_writes.sql`
- `database/migrations/phase37_tighten_deliverable_client_writes.sql`
- `database/migrations/phase38_tighten_client_invitation_writes.sql`
- `database/migrations/phase39_tighten_settings_account_writes.sql`

### New Unit Test Suites
- `tests/shared-rules.test.ts`
- `tests/invoice-server-mutations.test.ts`
- `tests/deliverable-server-mutations.test.ts`
- `tests/client-server-mutations.test.ts`
- `tests/account-server-mutations.test.ts`

---

## 6. Phase 5A Milestone Sign-off

All requirements for **Phase 5A (Tasks 1 to 3)** have been completed and verified with zero regressions against the codebase baseline.
In accordance with the instruction brief:
**"5A complete, run 5B in a fresh session."**
