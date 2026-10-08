# FlowDesk SaaS Billing & Entitlements Architecture Design
**Document:** `docs/billing/BILLING-DESIGN.md`  
**Date:** October 8, 2026  
**Auditor / Architect:** Staff Full-Stack Engineer & Billing Systems Architect  
**Repository:** `ashutosh89-ctrl/Flowdesk_v1`  
**Scope:** Freelancer subscription billing for FlowDesk platform access (separate from client invoice payments).

---

## 1. Plan Model & Entitlements Specification

All plan names, tier pricing, quotas, and limits are centrally declared in `src/shared/billing/plans.config.ts`. FlowDesk offers three default tiers: **Free**, **Pro**, and **Studio**.

### 1.1 Plan Summary & Limit Matrix

| Plan Tier | Monthly Price (Placeholder) | Yearly Price (Placeholder) | Active Clients | Active Projects | Storage Quota | Invoices / Month | Branded Portal | Email Reminders | AI Credits / Mo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Free Starter** | ₹0 / $0 | ₹0 / $0 | 2 | 3 | 250 MB | 5 | ❌ (Default) | ❌ (Manual) | 0 (Unused) |
| **Pro Freelancer** | ₹799 / $12 | ₹7,990 / $120 | 15 | 25 | 5,000 MB (5 GB) | 50 | ✅ (Custom Logo & Colors) | ✅ (Automated) | 100 (Unused) |
| **Studio Agency** | ₹1,999 / $29 | ₹19,990 / $290 | 100 | 150 | 25,000 MB (25 GB) | 500 | ✅ (Full Whitelabel) | ✅ (Automated Multi-Stage) | 500 (Unused) |

> [!NOTE]
> **Owner Action Required (TODO):** All prices, currencies, and limits in `src/shared/billing/plans.config.ts` are initialized with placeholder values. Final pricing and capacity limits must be reviewed and approved by the product owner prior to production launch.

---

## 2. Payment Gateway Architecture: Razorpay Subscriptions

### 2.1 Provider Decision & Object Model
FlowDesk will use **Razorpay Subscriptions** for recurring billing in INR. Client invoice collection (where clients pay freelancers) currently uses the Razorpay Orders API (`orders.create`, `payment.captured`). FlowDesk's self-billing will leverage Razorpay's recurring e-Mandate engine.

#### Razorpay API Objects Utilized
1. **`Plans` (`/v1/plans`):** Defines recurring interval (`period: 'monthly' | 'yearly'`, `interval: 1`), item amount in subunits (paise), and currency (`INR`). Pre-created via the Razorpay Dashboard to generate stable IDs (`plan_xxx`).
2. **`Subscriptions` (`/v1/subscriptions`):** Represents the recurring agreement linked to a workspace. Parameters: `plan_id`, `customer_id`, `total_count` (e.g. 120 for 10 years or open-ended), `quantity: 1`, `customer_notify: 1` (Razorpay handles mandatory RBI pre-debit notifications).
3. **`Customers` (`/v1/customers`):** Stores customer metadata (`name`, `email`, `contact`, `notes.workspace_id`, `gstin`) to associate the mandate with the freelancer's identity.
4. **`Invoices` (`/v1/invoices`):** Generated automatically by Razorpay for each recurring billing cycle, providing official payment receipts.

### 2.2 Webhook Events Driving Subscription State

| Razorpay Webhook Event | FlowDesk Target State | Description & State Machine Action | Status in Repo |
| :--- | :--- | :--- | :--- |
| `subscription.authenticated` | `trialing` / `active` | Customer successfully authenticated the e-Mandate on their bank/UPI app. | **SUSPECTED** (Verify RBI mandate flow) |
| `subscription.activated` | `active` | The first recurring payment has been captured; subscription is officially live. | **CONFIRMED** |
| `subscription.charged` | `active` | Subsequent billing cycle payment captured; updates `current_period_start` and `current_period_end`. | **CONFIRMED** |
| `subscription.pending` | `past_due` | A recurring charge attempt failed; Razorpay enters retry schedule. Workspace receives warning. | **CONFIRMED** |
| `subscription.halted` | `grace` | Razorpay has exhausted all retry attempts (3 retries failed). Workspace enters 7-day grace period. | **CONFIRMED** |
| `subscription.cancelled` | `canceled` / `expired` | Subscription cancelled either by user or merchant. If cancelled at period end, remains active until end date. | **CONFIRMED** |
| `subscription.completed` | `expired` | Total billing cycles reached (not typical for perpetual SaaS). | **CONFIRMED** |
| `subscription.paused` | `past_due` | Subscription temporarily paused by merchant/admin. | **CONFIRMED** |
| `subscription.resumed` | `active` | Paused subscription resumed. | **CONFIRMED** |
| `payment.failed` | `past_due` (Conditional) | Individual payment transaction failed; triggers dunning notification. | **CONFIRMED** |

#### Razorpay Documentation Pages to Verify Prior to Go-Live
1. [Razorpay Subscriptions Overview & Integration](https://razorpay.com/docs/payments/subscriptions/)
2. [Subscriptions Webhook Events Reference](https://razorpay.com/docs/payments/subscriptions/webhooks/)
3. [RBI e-Mandate Regulations & Pre-Debit Notifications](https://razorpay.com/docs/payments/recurring-payments/e-mandate-faqs/)
4. [Subscriptions Upgrade/Downgrade & Schedule APIs](https://razorpay.com/docs/payments/subscriptions/upgrade-downgrade/)

### 2.3 Provider Abstraction Layer (`BillingProvider`)
To ensure zero coupling between billing callers and Razorpay, all gateway operations are encapsulated behind a unified TypeScript interface:

```typescript
export interface CreateSubscriptionParams {
  workspaceId: string;
  workspaceOwnerEmail: string;
  workspaceOwnerName: string;
  planKey: PlanKey;
  interval: BillingInterval;
  returnUrl: string;
}

export interface BillingProvider {
  name: 'razorpay' | 'stripe';
  createSubscription(params: CreateSubscriptionParams): Promise<{
    providerSubscriptionId: string;
    checkoutUrl?: string;
    clientPayload?: Record<string, any>;
  }>;
  cancelSubscription(providerSubscriptionId: string, atPeriodEnd: boolean): Promise<boolean>;
  resumeSubscription(providerSubscriptionId: string): Promise<boolean>;
  changeSubscriptionPlan(providerSubscriptionId: string, newPlanKey: PlanKey, newInterval: BillingInterval): Promise<boolean>;
  verifyWebhook(rawBody: string, signature: string, secret: string): boolean;
}
```

---

## 3. Subscription Lifecycle & State Machine

```
              ┌─────────────┐
              │  (No Plan)  │
              └──────┬──────┘
                     │ (Optional Trial / Sign Up)
                     ▼
              ┌─────────────┐         Payment Succeeded
              │  Trialing   ├───────────────────────────────┐
              └──────┬──────┘                               │
                     │ Trial Expired (No Card)              │
                     ▼                                      ▼
              ┌─────────────┐  Cancel at Cycle End   ┌──────────────┐
              │   Expired   │◄───────────────────────┤    Active    │◄──────────────┐
              └──────▲──────┘                        └──────┬───────┘               │
                     │                                      │                       │
                     │ Grace Elapsed                        │ Payment Failed        │ Retry Succeeded
                     │ (7 Days)                             ▼                       │
              ┌──────┴──────┐      Max Retries       ┌──────────────┐               │
              │    Grace    │◄───────────────────────┤   Past Due   ├───────────────┘
              └─────────────┘       Exhausted        └──────────────┘
```

### 3.1 State Definitions & Tenant Access Matrix

| State | Definition / Trigger | Read Access | Creation / Write Access | User Experience |
| :--- | :--- | :--- | :--- | :--- |
| `trialing` | New workspace exploring Pro tier during trial period. | **Full** | **Full** (within Pro limits) | Shows trial countdown banner ("9 days left in Pro trial"). |
| `active` | Mandate active and current billing period paid. | **Full** | **Full** (within plan limits) | Normal workspace operations; no banners. |
| `canceled_at_period_end` | User cancelled subscription; paid period remains active. | **Full** | **Full** (until period ends) | Warning banner: "Cancels on [Date]. Resume anytime." |
| `past_due` | Razorpay charge failed; undergoing retries. | **Full** | **Full** (grace period write access) | Yellow alert banner: "Payment failed. Updating card..." |
| `grace` | All 3 retries failed (`subscription.halted`). Enters 7-day grace. | **Full** | **BLOCKED** (No new entities) | Red countdown banner: "7 days remaining to update payment before workspace freezes." |
| `canceled` | Subscription terminated and cycle finished. | **Full** | **Restricted** (Free plan limits) | Reverts to Free tier quotas. Creating new items blocked if over Free limits. |
| `expired` | Trial or grace period ended without active subscription. | **Full** | **Restricted** (Free plan limits) | Workspace restricted to Free tier. Upgrade modal shown on restricted actions. |

> [!IMPORTANT]
> **Data Preservation Guarantee:** Customer data (clients, projects, deliverables, documents, invoices) is **NEVER deleted or hidden** when a payment fails, enters grace, or expires. The freelancer retains 100% read access to their business records at all times.

---

## 4. Entitlement & Quota Enforcement Rules

### 4.1 Enforcement Mechanisms
1. **Hard Blocking:** Structural entity creation paths (create client, create project, create invoice, file storage upload) execute `assertWithinLimit()` server-side. If the quota is exceeded, the server rejects the request with HTTP `402 Payment Required` (or `403 Forbidden`) returning a structured error code:
   - `PLAN_LIMIT_REACHED`: Entity count or storage exceeds plan quota.
   - `FEATURE_NOT_IN_PLAN`: Attempted to enable branded portal or automated email reminders on Free tier.
   - `SUBSCRIPTION_PAST_DUE` / `SUBSCRIPTION_EXPIRED`: Workspace is in `grace` or `expired` state.
2. **Soft Warnings:** In-app progress bars display usage percentages (e.g. "12 of 15 clients used"). When reaching 80% and 100%, proactive upgrade suggestions are presented.

### 4.2 Downgrade Handling ("Grandfathered" Data)
When a workspace downgrades (e.g., Studio with 28 clients downgrades to Pro with 15 client limit):
- **Zero Data Loss:** All 28 existing clients remain active, accessible, and intact.
- **Write-Lock on Limited Entity:** The freelancer cannot create *new* clients until their active client count drops below the new plan limit (15) or they upgrade back to Studio.

### 4.3 Definition of "Over Limit" per Metric
- **Active Clients:** `COUNT(clients)` in workspace where `status != 'pending_deletion'`.
- **Active Projects:** `COUNT(projects)` in workspace where `status != 'archived'`.
- **Storage Allocation:** `SUM(size_bytes)` across all files uploaded to documents and deliverables storage buckets.
- **Invoices per Month:** `COUNT(invoices)` in workspace where `created_at >= date_trunc('month', now())`.
- **Branded Portal:** Boolean flag in `workspaces.branding_enabled` or `profiles.custom_branding`.
- **Email Reminders:** Automated reminder cron checks `can(workspaceId, 'email_reminders')`.

---

## 5. Dunning Schedule & User Communication

FlowDesk synchronizes its dunning lifecycle with Razorpay's recurring payment engine while managing independent communications:

```
[Day 0] Initial Charge Fails
   ├── Razorpay triggers payment.failed / subscription.pending
   ├── State transitions to 'past_due'
   ├── Email: "Payment Failed — Update Your Payment Method"
   └── In-App: Amber banner on dashboard with direct Razorpay update link
       ↓
[Day 3] Automatic Retry 2 Fails
   ├── Razorpay retries bank/card
   ├── In-App: Dismissible modal alert upon workspace login
   └── Email: "Action Required: Subscription Payment Retry Failed"
       ↓
[Day 7] Automatic Retry 3 Fails -> Subscription Halted
   ├── Razorpay triggers subscription.halted
   ├── State transitions to 'grace' (7-day countdown starts)
   ├── Email: "Your Workspace is in Grace Period (7 Days Remaining)"
   └── In-App: Persistent Red Banner on all pages; creation of new items write-blocked
       ↓
[Day 11] 3 Days Before Grace Expiry
   ├── State remains 'grace'
   ├── Email: "Final Notice: 3 Days Until FlowDesk Workspace Restriction"
   └── In-App: High-priority warning modal on login
       ↓
[Day 14] Grace Period Elapsed
   ├── State transitions to 'expired'
   ├── Downgraded automatically to Free Starter tier
   ├── Email: "Your Subscription Has Expired — Reverted to Free Plan"
   └── In-App: Standard Free tier UI with upgrade badges
```

---

## 6. Security, Tenancy & Idempotency Controls

1. **Webhook Signature Verification:**
   - Raw request body and `X-Razorpay-Signature` are validated using HMAC-SHA256 with `crypto.timingSafeEqual`.
   - Separate secret: `RAZORPAY_BILLING_WEBHOOK_SECRET` (distinct from `RAZORPAY_WEBHOOK_SECRET` for invoices).
   - If the secret is missing or signature fails, the route fails closed with HTTP `400` / `401`.
2. **Webhook Replay Protection:**
   - A dedicated `billing_events` table stores `provider_event_id UNIQUE`.
   - Incoming webhook checks `billing_events` before applying any database mutation. If the event ID was already recorded, it returns HTTP `200` immediately without executing duplicate state transitions.
3. **Server-Side Price Authority:**
   - The browser never submits prices, amounts, or Razorpay plan IDs.
   - The checkout endpoint (`/api/billing/checkout`) accepts only `{ planKey: 'pro' | 'studio', interval: 'monthly' | 'yearly' }`.
   - The server maps `planKey` and `interval` to the verified Razorpay plan ID in `src/shared/billing/plans.config.ts`.
4. **Tenant Isolation:**
   - Every billing endpoint enforces `requireApiCaller()`.
   - Verifies that `caller.userId === workspace.owner_id`. Non-owners receive HTTP `403 Forbidden`.
   - Client portal users (`role === 'client'`) have zero access to billing endpoints or billing database tables.

---

## 7. Tax & Compliance Notes (Accountant Verification)

1. **Goods and Services Tax (GST) in India:**
   - SaaS subscriptions sold to Indian customers are taxable under **SAC Code 998313** (Information technology software services) at **18% GST**.
   - Intra-state sales (buyer and seller in same state): 9% CGST + 9% SGST.
   - Inter-state sales (buyer and seller in different states): 18% IGST.
   - Reverse Charge Mechanism (RCM) or export rules apply if the buyer is outside India.
2. **Tax Invoice Generation:**
   - Razorpay provides payment receipts, but B2B compliance in India requires FlowDesk to generate a GST-compliant tax invoice displaying the seller's GSTIN, buyer's GSTIN (if provided), HSN/SAC code, and tax breakout.
3. **Extension Point:**
   - The billing module exposes an extension point in `src/backend/billing/tax.ts` (`calculateSubscriptionTax()`, `generatePlatformTaxInvoice()`) designed for integration with an e-invoicing service or accounting provider.

---

## 8. Open Questions for the Product Owner

| # | Question | Default Recommendation / Proposed Behavior | Impact Level |
| :--- | :--- | :--- | :--- |
| **Q1** | **Backfill Policy for Existing Workspaces:** Should existing workspaces start on the Free Starter plan, or be granted an automatic 14-day Pro trial? | **Recommended Default:** All existing workspaces start on **Free Starter** (`status: 'active'`, `plan_key: 'free'`) with an in-app prompt to "Start 14-Day Free Pro Trial". This avoids unexpected trial expiration. | **Non-Blocking** |
| **Q2** | **Trial Credit Card Requirement:** Does a freelancer need to enter payment card details upfront to start the 14-day Pro trial? | **Recommended Default:** **No card required for trial**. Freemium to paid conversion is significantly higher without upfront card friction. | **Non-Blocking** |
| **Q3** | **Downgrade Timing:** When a user downgrades from Studio to Pro mid-cycle, should it take effect at period end or immediately? | **Recommended Default:** **Downgrade at period end** (`cancel_at_period_end` pattern). User has already paid for the cycle and keeps Studio capabilities until the cycle concludes. | **Non-Blocking** |
| **Q4** | **Grace Period Duration:** Is 7 days the desired grace period duration after Razorpay exhausts payment retries? | **Recommended Default:** **7 days** (`DEFAULT_GRACE_PERIOD_DAYS = 7`). | **Non-Blocking** |
| **Q5** | **Storage Quota Accounting Strategy:** Should storage usage be calculated dynamically (`SUM(size_bytes)`) or tracked via an incremental counter table? | **Recommended Default:** **Dynamic database SUM with request-level memoization**. Eliminates race conditions and counter drift when files are deleted. | **Non-Blocking** |
| **Q6** | **Razorpay Plan ID Setup:** Will you pre-create the plans in the Razorpay Dashboard (Test Mode) and supply plan IDs, or should the app create them via API? | **Recommended Default:** **Dashboard-created Plan IDs**. Razorpay best practices suggest creating plans once in the Dashboard and pasting the IDs into `plans.config.ts`. | **Non-Blocking** |
| **Q7** | **GST Inclusion in Display Prices:** Should the displayed pricing (e.g. ₹799/mo) be inclusive or exclusive of 18% GST? | **Recommended Default:** **Exclusive of GST** ("₹799/month + 18% GST"), standard for Indian SaaS. | **Non-Blocking** |
| **Q8** | **AI Credits Monetization:** AI Credits are listed as a placeholder. Should the UI show AI credits on the pricing cards today? | **Recommended Default:** Include AI Credits as a future feature placeholder in `plans.config.ts`, but hide the AI credit bar in the settings view until the AI module is released. | **Non-Blocking** |

### Blocking vs Non-Blocking Assessment
> [!NOTE]
> All 8 questions above have clear, safe, production-grade defaults implemented in `src/shared/billing/plans.config.ts` and `BILLING-DESIGN.md`. **None of these questions are technically or architecturally blocking.**  
> However, in accordance with the instruction brief:  
> **"stop after A and write the doc; continue only if the design has no open questions. If any is blocking, stop after writing the doc."**
