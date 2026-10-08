# FlowDesk Architecture Boundary Plan & Decoupling Strategy

**Document Status**: Staff Review & Approved Blueprint  
**Target Version**: FlowDesk v2.0 Architecture  
**Scope**: Client-Server Separation, Domain Boundaries, and Safe Mutation Pipeline.

---

## 1. Executive Summary

Historically, FlowDesk relied heavily on direct client-side database interactions using the `@supabase/supabase-js` browser client initialized with the anonymous public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). While Row-Level Security (RLS) offers an essential baseline data firewall, using direct database calls from React Client Components introduces severe architectural vulnerabilities:

1. **State Machine Bypass**: The database cannot enforce sophisticated business logic workflows (e.g. state machines, pre-condition validations, inventory checks, audit notifications, side effects) purely through SQL `CHECK` constraints without complex database triggers.
2. **Partial / Incomplete Side Effects**: When a workflow involves multiple mutations (e.g., deliverable status update + activity feed log + email notification dispatch), client-side orchestration risks partial failure if the user navigates away or network drops mid-sequence.
3. **Information Disclosure & Leakage**: Client components calling Supabase directly receive raw database errors, schema names, and constraint violation strings.
4. **Denial-of-Service / Abuse Vectors**: Direct client-to-database mutations cannot be adequately rate-limited or inspected for malicious payloads (e.g., oversized strings, unicode exploits, script injection) at the edge.

This Architecture Boundary Plan defines the target architecture, boundary invariant rules, and presents the **Deliverable Approval Flow** as the reference pilot migration.

---

## 2. Four-Tier Layered Architecture Model

FlowDesk is structured into four distinct, strictly governed architectural tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. PRESENTATION LAYER (React 19 / Next.js 15 App Router)               │
│    - React Client Components ('use client') - Views, Modals, Forms     │
│    - React Server Components (RSC) - Page Shells, SSR Data Hydration   │
│    RULE: ZERO direct database writes. UI components invoke API Routes.  │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ HTTP (JSON / REST)
┌────────────────────────────────────────────────────────────────────────┐
│ 2. APPLICATION & ROUTE LAYER (Next.js Route Handlers: app/api/*)       │
│    - Ingress Rate Limiting (checkRateLimit with trusted proxy IP)      │
│    - Authentication & Identity Assertion (requireApiCaller)            │
│    - Strict Input Validation & Byte-Size Limits (parseJsonBody + Zod)  │
│    - Correlation Tracing (X-Request-Id) & Safe Error Masking           │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ Typed Function Calls
┌────────────────────────────────────────────────────────────────────────┐
│ 3. DOMAIN & SERVICE LAYER (src/backend/*)                              │
│    - Business Logic, Workflows, State Machine Transitions              │
│    - Services: DeliverableService, InvoiceService, PaymentService      │
│    - Durable Audit Logging (logger.security, activities log)           │
│    - Transaction Orchestration & Idempotency Enforcement               │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ Supabase Client / SQL Queries
┌────────────────────────────────────────────────────────────────────────┐
│ 4. INFRASTRUCTURE & DATA PERSISTENCE LAYER                             │
│    - Supabase PostgreSQL (Strict multi-tenant Row Level Security)      │
│    - Supabase Storage (Private & Canonical Bucket Scopes)             │
│    - Upstash Redis (Distributed Rate Limiting)                         │
│    - Payment Gateway (Razorpay) & Email Relays (Resend / Brevo)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Strict Boundary Rules & Invariants

### Rule 1: No Direct Client Database Writes
Client components (`'use client'`) must **never** perform direct database `INSERT`, `UPDATE`, `UPSERT`, or `DELETE` operations using `supabase.from(...)`. All write mutations must be routed through Next.js Route Handlers (`app/api/*`) or Server Actions.

### Rule 2: Server-Enforced State Machine Transitions
All entity status changes (such as deliverable approvals, invoice cancellations, or account status updates) must be validated server-side against allowable state transitions before applying any database mutation.

| Current Status | Allowed Target Status | Validated Actor Role |
| :--- | :--- | :--- |
| `draft` | `submitted`, `deleted` | Freelancer |
| `submitted` | `approved`, `changes_requested` | Client |
| `changes_requested` | `submitted` | Freelancer |
| `approved` | `completed` | Freelancer / Client |

### Rule 3: Atomic Side Effect Orchestration
When a business operation requires secondary effects (audit logs, emails, cache invalidation), the server-side handler is responsible for completing all operations reliably.

### Rule 4: Sanitized Responses & Uniform Contracts
Route Handlers must never echo raw database error objects or internal table schemas to the client. Responses must conform to the unified standard:
- Success: `{ success: true, data: ..., requestId: string }`
- Failure: `{ success: false, error: string, code: string, requestId: string }`

---

## 4. Pilot Migration: Deliverable Approval Flow

As the reference implementation for this architecture, the **Deliverable Approval Flow** has been migrated from browser-side Supabase client calls to a secure, server-side route handler:

### Previous Vulnerable Pattern (Direct Client Mutation)
```typescript
// BROWSER CLIENT (src/frontend/client/portal/client-portal-view.tsx)
await supabase
  .from('deliverables')
  .update({ status: 'approved', approval_status: 'approved' })
  .eq('id', delivId);
```
*Risks*:
- Client could approve deliverables not in `submitted` state (e.g. approving a `draft` or re-approving an `archived` deliverable).
- Client could spoof arbitrary status fields or bypass activity audit logging.
- Any network glitch left the database in a partially updated state.

### New Hardened Pattern (Route Handler Mediation)
```typescript
// 1. Client calls dedicated API endpoint
const res = await fetch(`/api/deliverables/${delivId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notes: notes || '' }),
});

// 2. Server Route Handler (app/api/deliverables/[deliverableId]/approve/route.ts)
// - Verifies authenticated session (requireApiCaller)
// - Rate limits calls to 30 requests/min
// - Validates deliverableId (UUID) and notes (max 500 chars)
// - Verifies client belongs to the deliverable's workspace
// - Enforces state machine: only 'submitted' or 'in_review' can transition to 'approved'
// - Updates database record atomically
// - Logs security audit event and activity feed entry
```

---

## 5. Phased Migration Roadmap & Remediation Status

| Phase / Batch | Domain / Entity | Scope | Target Completion | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 4B (Pilot)** | Deliverables Approval | Migrate `approveDeliverable` to Route Handler (`/api/deliverables/[id]/approve`) | Phase 4B | **COMPLETED & VERIFIED** |
| **Phase 5A - Batch 1** | Money & Invoices | Migrate invoice status transitions (`/status`), offline payments (`/payments/offline`), sequential numbering (`/next-number`), line items & recalculation (`/invoices`) | Phase 5A | **IN PROGRESS** |
| **Phase 5A - Batch 2** | Approvals & Deliverables | Migrate deliverable status transitions (`submit`, `request_revision`), version creation, internal/client notes | Phase 5A | **IN PROGRESS** |
| **Phase 5A - Batch 3** | Client Management & Invitations | Migrate connection invitation generation, revocation, regeneration, and client creation/archive | Phase 5A | **IN PROGRESS** |
| **Phase 5A - Batch 4** | Account, Branding & Settings | Migrate workspace numbering/branding settings, notification preferences, and account deletion/restore | Phase 5A | **IN PROGRESS** |
| **Phase 5B** | Final Re-Audit & Readiness | Full regression exploit re-verification, new vulnerability pass, release runbook | Phase 5B | **PLANNED** |
