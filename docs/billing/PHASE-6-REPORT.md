# Phase 6: Billing & Entitlements Layer — Deliverable Report

**Project:** FlowDesk  
**Phase:** 6 (Platform SaaS Billing & Entitlements Layer)  
**Scope:** Freelancers paying FlowDesk for workspace tier access (distinct from client invoice checkout)  
**Status:** Implementation Complete & Validated  

---

## 1. Executive Summary

Phase 6 implements the SaaS billing, recurring subscription management, and entitlement enforcement layer for FlowDesk. This architecture enables FlowDesk to monetize workspace features through recurring Razorpay Subscriptions (Free Starter, Pro Freelancer, and Studio Agency tiers) while guaranteeing zero interference with the existing client invoice payment flow.

All 7 Part B implementation tasks have been completed and validated:
1. **Schema & Database Layer:** Created unapplied migration `database/migrations/phase40_billing_and_entitlements.sql` with tables, RLS policies, trigger-based quota defense-in-depth, and an idempotent backfill for Free tier workspaces.
2. **Entitlements Core:** Pure, zero-I/O rule engine in `src/shared/billing/` and server-side request-cached evaluation helper in `src/backend/billing/`.
3. **Provider Layer & Billing API Routes:** `BillingProvider` interface and Razorpay subscription integration with timing-safe HMAC webhook verification (`/api/webhooks/razorpay-billing`) and server-authoritative checkout, cancel, resume, and change-plan endpoints.
4. **Enforcement Points:** Wired runtime limits across client creation, invoice issuance, notification settings, and Postgres trigger enforcement for project creation.
5. **UI Layer:** Dynamic landing page pricing preview, interactive Freelancer Settings Billing tab, and subscription Upgrade Modal with monthly/yearly billing toggle.
6. **Email & In-App Notifications:** 6 transactional billing email templates with Brevo dispatch and persistent in-app notifications for lifecycle events.
7. **Comprehensive Test Suite:** 3 new test suites (64 assertions) covering pure rules, webhook security, and route protection, with 100% CI pass rate.

---

## 2. Tasks Implemented & Deliverables

### Task 1: Schema & Migrations (`phase40_billing_and_entitlements.sql`)
- Created `plans`, `subscriptions`, `billing_events`, `usage_counters`, and `entitlement_overrides` tables.
- **Row-Level Security (RLS):** Read-only for authenticated workspace owners (`owner_id = auth.uid()`). Direct browser/client-side writes are strictly denied via RLS.
- **Helper Functions:** `get_workspace_plan(ws_id UUID)` evaluates subscription status, grace periods, and overrides.
- **Trigger-based Defense-in-Depth:** `trg_check_project_quota` and `trg_check_client_quota` enforce quotas even if an unmigrated client-side Supabase write path is attempted.
- **Idempotent Backfill:** Automatically attaches an active Free tier subscription to all pre-existing workspaces.

### Task 2: Entitlements Core Engine
- Created [`src/shared/billing/plans.config.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/billing/plans.config.ts) containing tier definitions (`free`, `pro`, `studio`), limits, pricing structures, and clear `TODO [OWNER]` annotations.
- Created [`src/shared/billing/plan-rules.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/billing/plan-rules.ts) with pure functions:
  - `PlanLimitError` custom error class.
  - `isWriteAllowedInStatus`: hard write-lock during `grace`, `canceled`, and `expired` statuses; reads always preserved.
  - `canTransitionSubscription`: validates 7-state subscription lifecycle.
  - `resolveEffectiveLimits`: incorporates support overrides over base plan limits.
  - `resolveFeaturePermission`: evaluates boolean feature access with fallback to Free tier upon expiration.
  - `resolveMetricLimitCheck`: evaluates quota limits and enforces downgrade grandfathering (existing records never hidden or deleted).
- Created [`src/backend/billing/entitlements.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/billing/entitlements.ts):
  - Request-scoped cached `getWorkspaceEntitlements()` using React `cache()`.
  - `can()`, `checkLimit()`, `assertCan()`, and `assertWithinLimit()` helpers.

### Task 3: Provider Layer & Billing API Routes
- Created [`src/backend/billing/provider.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/billing/provider.ts): vendor-neutral `BillingProvider` interface.
- Created [`src/backend/billing/razorpay-subscription-provider.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/billing/razorpay-subscription-provider.ts): Razorpay Subscriptions implementation with demo mode mock fallback.
- Validation Schemas in [`src/shared/validation/schemas.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/validation/schemas.ts): `BillingCheckoutSchema`, `BillingCancelSchema`, `BillingResumeSchema`, `BillingChangePlanSchema`.
- Route Endpoints:
  - `POST /api/billing/checkout`: rate-limited, owner-only, server-authoritative plan selection. Client-supplied prices are strictly rejected or ignored.
  - `POST /api/billing/cancel`: schedules cancellation at period end.
  - `POST /api/billing/resume`: resumes pending cancellation.
  - `POST /api/billing/change-plan`: updates plan tier and billing interval.
  - `GET /api/billing/status`: returns current workspace entitlements and plan catalogue (`Cache-Control: no-store`).
- Webhook Handler in [`app/api/webhooks/razorpay-billing/route.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/razorpay-billing/route.ts):
  - 100 KB payload size pre-check.
  - Fails closed if `RAZORPAY_BILLING_WEBHOOK_SECRET` is unset.
  - Timing-safe HMAC-SHA256 signature verification.
  - Event deduplication via `billing_events` table (and in-memory demo cache).
  - Handles subscription state transitions (`subscription.activated`, `charged`, `halted`, `cancelled`, `payment.failed`).
  - Dispatches email and in-app notifications asynchronously.

### Task 4: Enforcement Points
- `app/api/clients/route.ts`: calls `assertWithinLimit(workspace.id, 'activeClients', 1)`.
- `app/api/invoices/route.ts`: calls `assertWithinLimit(workspace.id, 'invoicesPerMonth', 1)`.
- `app/api/account/notifications/route.ts`: calls `assertCan(ws.id, 'emailReminders')` before enabling automated invoice reminders.
- `database/migrations/phase40_billing_and_entitlements.sql`: Postgres trigger `trg_check_project_quota` enforces project creation limits at the database boundary.

### Task 5: UI Layer
- [`src/frontend/landing/pricing-preview.tsx`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/frontend/landing/pricing-preview.tsx): Dynamically displays Free, Pro, and Studio tiers and prices directly from `BILLING_PLANS`.
- [`src/frontend/shared/billing/upgrade-modal.tsx`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/frontend/shared/billing/upgrade-modal.tsx): Monthly/yearly toggle, plan feature comparison, and server-checkout trigger with Razorpay checkout launch.
- [`src/frontend/freelancer/settings/billing-plan-panel.tsx`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/frontend/freelancer/settings/billing-plan-panel.tsx): Mounted in Freelancer Settings tab, showing subscription status banner, quota consumption progress bars, and cancel/resume/upgrade actions.

### Task 6: Emails & In-App Notifications
- Templates in [`src/backend/email/templates/index.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/email/templates/index.ts):
  - `renderBillingTrialEndingEmail`
  - `renderBillingPaymentFailedEmail`
  - `renderBillingGraceEndingSoonEmail`
  - `renderBillingSubscriptionCanceledEmail`
  - `renderBillingSubscriptionActivatedEmail`
  - `renderBillingPlanChangedEmail`
- Dispatchers in [`src/backend/email/email-service.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/email/email-service.ts): configured as mandatory transactional emails (never suppressed by notification toggles).
- In-App Notifications in [`src/backend/utilities/notification-helper.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/utilities/notification-helper.ts): freelancer notifications for billing events with server/webhook context fallback.

### Task 7: Comprehensive Test Suites
- [`tests/billing-plan-rules.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/billing-plan-rules.test.ts): 31 assertions covering plan resolution, support overrides, feature gates, quota limit evaluations, grandfathering on downgrade, status write-locking, and state machine transitions.
- [`tests/billing-webhook.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/billing-webhook.test.ts): 13 assertions verifying missing secret fail-closed, missing header rejection, payload size limit, forged signature rejection, tampered payload rejection, authentic signature processing, and replay deduplication.
- [`tests/billing-routes.test.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/billing-routes.test.ts): 20 assertions testing 401 unauthenticated rejection, 403 non-owner client rejection, 400 invalid plan/interval rejection, strict schema extra-field rejection, server-authoritative checkout in demo mode, and `Cache-Control: no-store` header validation.

---

## 3. Files Created & Modified

### Created Files:
- `docs/billing/BILLING-DESIGN.md` (Design architecture document)
- `database/migrations/phase40_billing_and_entitlements.sql` (Unapplied SQL migration)
- `src/shared/billing/plans.config.ts` (Plan definitions & quotas config)
- `src/shared/billing/plan-rules.ts` (Pure business rules & state machine)
- `src/shared/billing/index.ts` (Shared billing barrel export)
- `src/backend/billing/provider.ts` (BillingProvider interface)
- `src/backend/billing/razorpay-subscription-provider.ts` (Razorpay implementation)
- `src/backend/billing/entitlements.ts` (Server entitlements evaluation & assertions)
- `src/backend/billing/index.ts` (Backend billing barrel export)
- `app/api/billing/checkout/route.ts` (Checkout endpoint)
- `app/api/billing/cancel/route.ts` (Cancel subscription endpoint)
- `app/api/billing/resume/route.ts` (Resume subscription endpoint)
- `app/api/billing/change-plan/route.ts` (Change plan endpoint)
- `app/api/billing/status/route.ts` (Status & entitlements endpoint)
- `app/api/webhooks/razorpay-billing/route.ts` (Dedicated billing webhook handler)
- `src/frontend/shared/billing/upgrade-modal.tsx` (Upgrade subscription modal)
- `src/frontend/freelancer/settings/billing-plan-panel.tsx` (Settings billing panel)
- `tests/billing-plan-rules.test.ts` (Plan rules test suite)
- `tests/billing-webhook.test.ts` (Webhook security test suite)
- `tests/billing-routes.test.ts` (API routes security test suite)
- `docs/billing/PHASE-6-REPORT.md` (This document)

### Modified Files:
- `.env.example` (Added `RAZORPAY_BILLING_WEBHOOK_SECRET`)
- `src/shared/validation/schemas.ts` (Added billing Zod schemas)
- `app/api/clients/route.ts` (Enforced active client quota)
- `app/api/invoices/route.ts` (Enforced monthly invoice quota)
- `app/api/account/notifications/route.ts` (Enforced emailReminders feature flag)
- `src/frontend/freelancer/settings/settings-view.tsx` (Mounted BillingPlanPanel in Tab 2)
- `src/frontend/landing/pricing-preview.tsx` (Dynamic pricing from BILLING_PLANS)
- `src/backend/email/templates/index.ts` (Added 6 billing email templates)
- `src/backend/email/email-service.ts` (Added 6 billing email dispatchers)
- `src/backend/utilities/notification-helper.ts` (Added 6 billing notification helpers)
- `scripts/test-all.ts` (Registered new billing test suites)

---

## 4. Verification Gate Results

| Check / Suite | Baseline (Phase 5B) | Final (Phase 6) | Status |
|---|---|---|---|
| **TypeScript Typecheck** | 0 errors | 0 errors | ✅ PASS |
| **ESLint Analysis** | 0 errors, 4 img warnings | 0 errors, 4 img warnings | ✅ PASS |
| **Secret Detection (`check:secrets`)** | 367 files scanned, 0 secrets | 387 files scanned, 0 secrets | ✅ PASS |
| **CI Test Suites (`test:all`)** | 23/23 suites pass | 26/26 suites pass (100%) | ✅ PASS |
| **Production Build (`next build`)** | 38 pages generated | 44 pages generated | ✅ PASS |

---

## 5. Database Migration Apply Order

When deploying to staging or production Supabase, apply migrations in sequence:

1. Prior migrations (`phase01_...` through `phase33_...`)
2. `database/migrations/phase40_billing_and_entitlements.sql`
   - *Contents:* Creates billing tables, functions, RLS policies, trigger-based quota guards, and runs the Free tier backfill.
   - *Rollback:* Section 7 contains the inverse SQL rollback script.

---

## 6. Manual Runbook: Razorpay Dashboard Setup

To activate live subscription billing, the FlowDesk account owner must complete the following steps in the Razorpay Dashboard:

1. **Enable Subscriptions:**
   - Log into [Razorpay Dashboard](https://dashboard.razorpay.com).
   - Navigate to **Subscriptions** in the left navigation.
   - Ensure recurring mandate / subscription billing is activated for your merchant account.

2. **Create Recurring Plans:**
   - Create Plan 1: **Pro Freelancer (Monthly)**
     - Name: `FlowDesk Pro - Monthly`
     - Period: `Monthly`, Interval: `1`
     - Amount: Configure actual price (placeholder: ₹799)
     - Note down the generated Plan ID (e.g. `plan_Mxxxxxxxxxxxx`).
   - Create Plan 2: **Pro Freelancer (Yearly)**
     - Name: `FlowDesk Pro - Yearly`
     - Period: `Yearly`, Interval: `1`
     - Amount: Configure actual price (placeholder: ₹7,990)
     - Note down the Plan ID.
   - Create Plan 3 & 4: **Studio Agency (Monthly & Yearly)**
     - Create corresponding Studio plans and note down their Plan IDs.

3. **Update Configuration File:**
   - Open [`src/shared/billing/plans.config.ts`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/shared/billing/plans.config.ts).
   - Paste the Plan IDs into `providerPlanIds.razorpay` for `pro` and `studio`.
   - Update `pricing` values with real business numbers.

4. **Configure Webhook:**
   - In Razorpay Dashboard, navigate to **Settings > Webhooks**.
   - Click **Add New Webhook**.
   - **Webhook URL:** `https://your-domain.com/api/webhooks/razorpay-billing`
   - **Secret:** Generate a strong random secret (32+ chars) and set it as `RAZORPAY_BILLING_WEBHOOK_SECRET` in your server environment variables.
   - **Active Events to Select:**
     - `subscription.authenticated`
     - `subscription.activated`
     - `subscription.charged`
     - `subscription.pending`
     - `subscription.halted`
     - `subscription.cancelled`
     - `subscription.paused`
     - `subscription.resumed`
     - `payment.failed`

---

## 7. Rollback Plan

If unexpected issues occur upon deploying Phase 6:

1. **Environment Variables:**
   - Unset `RAZORPAY_BILLING_WEBHOOK_SECRET`. The webhook endpoint immediately fails closed (500) without modifying database state.

2. **Database Rollback:**
   Execute the following SQL statements in the Supabase SQL editor:
   ```sql
   -- Drop trigger guards
   DROP TRIGGER IF EXISTS trg_check_project_quota ON projects;
   DROP FUNCTION IF EXISTS check_project_quota_trigger();
   DROP TRIGGER IF EXISTS trg_check_client_quota ON clients;
   DROP FUNCTION IF EXISTS check_client_quota_trigger();

   -- Drop helper functions
   DROP FUNCTION IF EXISTS get_workspace_plan(UUID);

   -- Drop billing tables (in reverse dependency order)
   DROP TABLE IF EXISTS entitlement_overrides CASCADE;
   DROP TABLE IF EXISTS usage_counters CASCADE;
   DROP TABLE IF EXISTS billing_events CASCADE;
   DROP TABLE IF EXISTS subscriptions CASCADE;
   DROP TABLE IF EXISTS plans CASCADE;
   ```

3. **Application Rollback:**
   - If rolling back git commits, revert the Phase 6 commit branch.
   - The application will fall back to default behavior without quota enforcement.

---

## 8. User-Visible Changes

1. **Landing Page (`/`):**
   - The pricing table on the landing page displays current plans, limits, and pricing dynamically sourced from `BILLING_PLANS`.
2. **Freelancer Settings (`/dashboard/settings` or `/freelancer/settings`):**
   - A new **Plan & Billing** tab displays current plan badge (`Free`, `Pro`, or `Studio`), billing status (`Active`, `Past Due`, `Grace Period`), and visual usage meters comparing actual counts against tier quotas.
   - Includes **Upgrade Plan**, **Cancel Subscription**, and **Resume Subscription** controls.
3. **Upgrade Modal:**
   - Clicking "Upgrade" opens a modal allowing monthly/yearly selection, highlighting savings, and launching the payment checkout flow.
4. **Quota Warnings:**
   - When a Free tier user attempts to create a 3rd client or 4th project, a clear error dialog surfaces informing them of the plan limit and providing an upgrade link. Existing items are never locked or hidden.

---

## 9. Decisions the Account Owner Still Owes

The codebase uses safe placeholders and is ready for production as soon as the owner finalizes these business decisions:

| Decision Item | Location in Code | Current Placeholder | Owner Action |
|---|---|---|---|
| **Real Subscription Pricing** | `src/shared/billing/plans.config.ts` | Free: ₹0, Pro: ₹799/mo (₹7990/yr), Studio: ₹1999/mo (₹19990/yr) | Finalize pricing in INR and USD. |
| **Real Quota Limits** | `src/shared/billing/plans.config.ts` | Free: 2 clients / 3 projects; Pro: 15 clients / 25 projects; Studio: 100 clients / 150 projects | Set final quota caps per tier. |
| **Razorpay Plan IDs** | `src/shared/billing/plans.config.ts` | `'plan_placeholder_pro_monthly'`, etc. | Create plans in Razorpay dashboard and paste IDs. |
| **Grace Period Duration** | `src/shared/billing/plans.config.ts` | 7 days | Confirm if 7 days of grace before hard write-locking is desired. |
| **Free Pro Trial Duration** | `src/shared/billing/plans.config.ts` | 14 days | Confirm trial duration for new signups. |
| **GST / Tax Handling** | `src/shared/billing/plans.config.ts` | Inclusive | Confirm GST invoicing requirements with accountant. |
| **Billing Webhook Secret** | Production server env | Not configured | Add `RAZORPAY_BILLING_WEBHOOK_SECRET` to production environment. |

---

## 10. Verification of Ground Rules

- **Zero commits or pushes made:** Git working tree remains uncommitted per instructions.
- **No secrets logged or committed:** Verified via `check:secrets` (0 secrets across 387 files).
- **No modification to `.env`:** Only `.env.example` was updated with the new environment variable name.
- **No real external API calls:** Razorpay and Supabase external networks were not contacted; verified via offline unit and mock integration test suites.
- **Migration is unapplied:** `phase40_billing_and_entitlements.sql` exists as a new unapplied SQL file.
