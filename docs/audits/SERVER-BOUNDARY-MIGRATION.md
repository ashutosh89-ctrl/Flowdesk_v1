# FlowDesk Server-Boundary Migration Plan (Phase 5A)

**Document Version**: 1.0.0  
**Status**: Executing Phase 5A  
**Target Architecture**: Next.js 15 App Router + Cookie-Aware Supabase Route Handlers + Pure Business Rules Module  

---

## 1. Migration Overview & Ground Rules

This document specifies the server-boundary migration for FlowDesk mutations formerly executed directly from client components or client-scoped database adapters.

### Core Architectural Invariants
1. **Zero Client-Side Write Access**: No React Client Component (`'use client'`) may perform direct database `INSERT`, `UPDATE`, `UPSERT`, or `DELETE` via `supabase.from(...)`.
2. **Session-Derived Authorization**: Authorization rules are derived strictly from the authenticated Supabase session (`requireApiCaller()`), never trusting IDs passed in request bodies or query parameters.
3. **Pure Business Logic Layer**: All state machines, calculation invariants, and numbering algorithms live in `src/shared/rules/` with zero I/O, shared identically by server route handlers and UI components.
4. **Resilient Side Effects**: Outbound emails, notifications, and activity logs are initiated server-side; non-critical side effect failures do not fail the primary state transition.
5. **Feature Flag Rollout**: Each batch is gated behind an environment variable `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_<N>` (default `true` in code), allowing instant rollback without re-deploying previous builds.
6. **Demo Mode Integrity**: If `isDemoModeActive()` or demo data provider is enabled, operations safely route to local storage (`FlowDeskStore`), preserving demo functionality without network requests.

---

## 2. Batch Breakdown (Max 4 Mutations per Batch)

---

### Batch 1: Money & Invoices (Highest Financial Risk)

#### Mutation 1.1: Invoice Status Transition (`sent`, `cancelled`, `viewed`)
- **Current Call Site(s)**:
  - `FreelancerInvoiceService.recordInvoiceView()` (`src/backend/freelancer/index.ts`)
  - `InvoicesListView` status action menus (`src/frontend/freelancer/invoices/invoices-list-view.tsx`)
- **New Route**: `POST /api/invoices/[invoiceId]/status`
- **Input Schema**:
  ```typescript
  z.object({
    status: z.enum(['sent', 'viewed', 'cancelled']),
    notes: z.string().max(500).optional(),
  })
  ```
- **Authorization Rule**: Derived from session. Workspace owner (`workspaces.owner_id = user.id`) can trigger `sent`, `cancelled`. Client assigned to invoice can trigger `viewed`.
- **Business Rules Enforced Server-Side**:
  - Transition validity table from `src/shared/rules/invoice-rules.ts`.
  - Cannot cancel an invoice that is already `paid`.
  - Cannot transition from `cancelled` back to `draft`.
- **Rate-Limit Preset**: `invoice_status`: 30 requests / minute per IP.
- **Idempotency Need**: Natural key / status check: `WHERE id = invoiceId AND status = currentStatus`. If already in target status, return 200 OK with existing data.
- **Side Effects**:
  - If status becomes `sent`: dispatches `EmailService.sendInvoiceIssued` (idempotent via `email_events`), inserts activity log `sent_invoice`.
  - If status becomes `cancelled`: inserts activity log `cancelled_invoice`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1=false` to restore legacy service execution.

#### Mutation 1.2: Record Offline Payment (Manual Settlement)
- **Current Call Site(s)**:
  - `FreelancerInvoiceService.markInvoicePaidOffline()` (`src/backend/freelancer/index.ts`)
  - `handleConfirmPaidOffline` in `invoices-list-view.tsx`
- **New Route**: `POST /api/invoices/[invoiceId]/payments/offline`
- **Input Schema**:
  ```typescript
  z.object({
    paymentMethod: z.enum(['bank_transfer', 'cash', 'cheque', 'other']).default('bank_transfer'),
    amount: z.number().positive().max(100_000_000).optional(),
    notes: z.string().max(500).optional(),
  })
  ```
- **Authorization Rule**: Strictly workspace owner (`workspaces.owner_id = user.id`). Clients cannot record offline payments for themselves.
- **Business Rules Enforced Server-Side**:
  - Overpayment protection: payment amount cannot exceed remaining balance (`total - paid_amount`).
  - Remaining balance calculation using `calculateRemainingBalance()`.
  - Status updates to `paid` if remaining balance is 0, or `partially_paid` if balance remains.
- **Rate-Limit Preset**: `invoice_payment_offline`: 20 requests / minute per IP.
- **Idempotency Need**: Supported via optional `Idempotency-Key` header; database settlement handled atomically via `record_manual_payment` RPC or atomic transaction lock.
- **Side Effects**:
  - Dispatches `EmailService.sendPaymentReceived` to `client_email`.
  - Inserts activity feed record `invoice_payment_recorded`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1=false`.

#### Mutation 1.3: Collision-Free Sequential Invoice Number Generation
- **Current Call Site(s)**:
  - `generateNextInvoiceNumber` in `src/backend/freelancer/index.ts` and `invoice-builder-modal.tsx`
- **New Route**: `GET /api/invoices/next-number`
- **Input Schema**: None (query param `year` optional integer).
- **Authorization Rule**: Authenticated workspace owner (`workspaces.owner_id = user.id`).
- **Business Rules Enforced Server-Side**:
  - Queries existing workspace invoice numbers to compute `maxSeq + 1` formatted via `formatInvoiceNumber()`.
  - Protects workspace isolation: cannot view or guess another workspace's sequence.
- **Rate-Limit Preset**: `invoice_next_number`: 60 requests / minute per IP.
- **Idempotency Need**: Read-only sequence suggestion; safe for concurrent calls.
- **Side Effects**: None.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1=false`.

#### Mutation 1.4: Invoice Creation & Line Item Recalculation
- **Current Call Site(s)**:
  - `FreelancerInvoiceService.createInvoice()` (`src/backend/freelancer/index.ts`)
  - `FreelancerInvoiceService.updateInvoice()` (`src/backend/freelancer/index.ts`)
- **New Route**: `POST /api/invoices` and `PATCH /api/invoices/[invoiceId]`
- **Input Schema**:
  ```typescript
  z.object({
    clientId: z.string().uuid(),
    projectId: z.string().uuid().optional().nullable(),
    invoiceNumber: z.string().min(1).max(100).optional(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    items: z.array(z.object({
      description: z.string().min(1).max(255),
      quantity: z.number().positive().max(10000),
      rate: z.number().min(0).max(100_000_000),
    })).min(1),
    taxPercentage: z.number().min(0).max(100).optional().default(0),
    taxName: z.string().max(50).optional().default('Tax'),
    discount: z.number().min(0).optional().default(0),
    currency: z.string().length(3).default('USD'),
    notes: z.string().max(2000).optional(),
    paymentInstructions: z.string().max(2000).optional(),
    internalNotes: z.string().max(2000).optional(),
  })
  ```
- **Authorization Rule**: Workspace owner derived from session. Client ID verified to belong to caller's workspace.
- **Business Rules Enforced Server-Side**:
  - Totals recalculated server-side using pure `calculateInvoiceTotals()`.
  - Discount clamped to subtotal.
  - Due date must not precede issue date.
  - Concurrency collision handling on `invoice_number` unique constraint.
- **Rate-Limit Preset**: `invoice_create_update`: 30 requests / minute per IP.
- **Idempotency Need**: Supported via client-provided `Idempotency-Key` or database unique constraint on `(workspace_id, invoice_number)`.
- **Side Effects**:
  - Inserts/updates `invoice_items` in same transaction.
  - Inserts activity feed record `created_invoice` / `updated_invoice`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_1=false`.

---

### Batch 2: Approvals & Deliverables

#### Mutation 2.1: Deliverable Submission (`submit`)
- **Current Call Site(s)**:
  - `DeliverableService.submitDeliverableClientReview()` (`src/backend/freelancer/index.ts`)
  - `deliverable-workspace-modal.tsx`
- **New Route**: `POST /api/deliverables/[deliverableId]/submit`
- **Input Schema**:
  ```typescript
  z.object({
    submissionMessage: z.string().max(1000).optional(),
    reviewDeadline: z.string().optional(),
  })
  ```
- **Authorization Rule**: Authenticated freelancer owning the deliverable's workspace.
- **Business Rules Enforced Server-Side**:
  - Allowed from status `draft` or `revision_requested`.
  - Transitions status to `submitted`, `approval_status` to `pending`.
- **Rate-Limit Preset**: `deliverable_submit`: 30 requests / minute per IP.
- **Idempotency Need**: State-check in WHERE clause (`status IN ('draft', 'revision_requested')`).
- **Side Effects**:
  - Dispatches email notification to client if email present (`EmailService.sendDeliverableReady`).
  - Activity feed entry `submitted_deliverable`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_2=false`.

#### Mutation 2.2: Deliverable Revision Request (`requestRevision`)
- **Current Call Site(s)**:
  - `ClientDeliverableService.requestRevision()` (`src/backend/client/client-deliverable-service.ts`)
  - `client-portal-view.tsx`
- **New Route**: `POST /api/deliverables/[deliverableId]/revision`
- **Input Schema**:
  ```typescript
  z.object({
    revisionComment: z.string().min(1).max(2000),
  })
  ```
- **Authorization Rule**: Authenticated client assigned to the deliverable (`clients.user_id = user.id` and `deliverables.client_id = client.id`), or workspace owner.
- **Business Rules Enforced Server-Side**:
  - Allowed only from status `submitted` or `in_review`.
  - Transitions status to `revision_requested`.
- **Rate-Limit Preset**: `deliverable_revision`: 30 requests / minute per IP.
- **Idempotency Need**: Atomic status update where `status IN ('submitted', 'in_review')`.
- **Side Effects**:
  - Dispatches `EmailService.sendDeliverableRevisionRequested` to freelancer.
  - Inserts comment record in `deliverable_comments` (marked as non-internal).
  - Activity feed record `requested_revision`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_2=false`.

#### Mutation 2.3: Deliverable Version Creation
- **Current Call Site(s)**:
  - `DeliverableService.uploadNewVersion()` (`src/backend/freelancer/index.ts`)
  - `deliverable-workspace-modal.tsx`
- **New Route**: `POST /api/deliverables/[deliverableId]/versions`
- **Input Schema**:
  ```typescript
  z.object({
    note: z.string().max(500).optional(),
    fileName: z.string().max(255).optional(),
    fileUrl: z.string().max(1024).optional(),
    fileSize: z.string().max(50).optional(),
  })
  ```
- **Authorization Rule**: Authenticated workspace owner.
- **Business Rules Enforced Server-Side**:
  - Generates sequential version string (e.g., `v1.1`, `v2.0`).
  - Sets `current_version` on deliverable record atomically.
- **Rate-Limit Preset**: `deliverable_version`: 20 requests / minute per IP.
- **Idempotency Need**: Version number uniqueness within deliverable.
- **Side Effects**: Inserts `deliverable_versions` record, logs activity.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_2=false`.

#### Mutation 2.4: Deliverable Collaboration Comments
- **Current Call Site(s)**:
  - `DeliverableService.addDeliverableComment()` (`src/backend/freelancer/index.ts`)
  - `client-comment-service.ts`
- **New Route**: `POST /api/deliverables/[deliverableId]/comments`
- **Input Schema**:
  ```typescript
  z.object({
    content: z.string().min(1).max(2000),
    isInternal: z.boolean().optional().default(false),
  })
  ```
- **Authorization Rule**: Authenticated user. If client, `isInternal` is forced to `false`.
- **Business Rules Enforced Server-Side**:
  - Multi-tenant affiliation check: caller belongs to deliverable's workspace or is assigned client.
  - Client cannot view or post internal notes.
- **Rate-Limit Preset**: `deliverable_comment`: 60 requests / minute per IP.
- **Idempotency Need**: Natural timestamp / payload debouncing.
- **Side Effects**: Increments `comments_count` on deliverable; creates notification.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_2=false`.

---

### Batch 3: Client Management & Invitations

#### Mutation 3.1: Generate / Retrieve Connection Invitation
- **Current Call Site(s)**:
  - `FreelancerClientManagementService.getOrCreateConnectionLink()`
  - `InvitationService.createOrGetInvitation()`
- **New Route**: `POST /api/clients/[clientId]/invitation`
- **Input Schema**:
  ```typescript
  z.object({
    recipientEmail: z.string().email().optional(),
    forceNew: z.boolean().optional().default(false),
  })
  ```
- **Authorization Rule**: Authenticated workspace owner. Client ID must belong to caller's workspace.
- **Business Rules Enforced Server-Side**:
  - Generates 256-bit cryptographically secure raw token.
  - Stores only SHA-256 hash in database (`client_invitations`).
  - Sets 7-day expiration window.
- **Rate-Limit Preset**: `client_invitation_generate`: 20 requests / minute per IP.
- **Idempotency Need**: Re-fetching without `forceNew` returns the active pending invitation without generating new hashes.
- **Side Effects**: Audit log in security logger.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_3=false`.

#### Mutation 3.2: Revoke Client Invitation
- **Current Call Site(s)**:
  - `InvitationService.createOrGetInvitation({ forceNew: true })`
- **New Route**: `DELETE /api/clients/[clientId]/invitation`
- **Input Schema**: None.
- **Authorization Rule**: Authenticated workspace owner.
- **Business Rules Enforced Server-Side**:
  - Updates pending invitations for client to `status = 'revoked'`, `revoked_at = NOW()`.
- **Rate-Limit Preset**: `client_invitation_revoke`: 20 requests / minute per IP.
- **Idempotency Need**: Revoking an already revoked invitation returns 200 OK without errors.
- **Side Effects**: Security audit event.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_3=false`.

#### Mutation 3.3: Client Create
- **Current Call Site(s)**:
  - `FreelancerClientManagementService.createClient()`
- **New Route**: `POST /api/clients`
- **Input Schema**:
  ```typescript
  z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(255),
    company: z.string().max(100).optional().default(''),
    phone: z.string().max(50).optional(),
    hourlyRate: z.number().min(0).optional(),
    currency: z.string().length(3).optional().default('USD'),
  })
  ```
- **Authorization Rule**: Authenticated workspace owner.
- **Business Rules Enforced Server-Side**:
  - Inserts client record bound to caller's `workspace_id`.
  - Sets initial `status = 'active'`, `portal_access_enabled = true`.
  - Automatically provisions connection invitation link.
- **Rate-Limit Preset**: `client_create`: 30 requests / minute per IP.
- **Idempotency Need**: Optional `Idempotency-Key` or email uniqueness within workspace.
- **Side Effects**:
  - Activity feed record `created_client`.
  - Sends invitation email if client email is present.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_3=false`.

#### Mutation 3.4: Client Update / Archive
- **Current Call Site(s)**:
  - `FreelancerClientManagementService.updateClient()`
  - `FreelancerClientManagementService.archiveClient()`
- **New Route**: `PATCH /api/clients/[clientId]`
- **Input Schema**:
  ```typescript
  z.object({
    name: z.string().min(1).max(100).optional(),
    company: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    hourlyRate: z.number().min(0).optional(),
    status: z.enum(['active', 'archived']).optional(),
    portalAccessEnabled: z.boolean().optional(),
  })
  ```
- **Authorization Rule**: Authenticated workspace owner. Client ID must belong to caller's workspace.
- **Business Rules Enforced Server-Side**:
  - Cannot modify `workspace_id` or `user_id` via this endpoint.
- **Rate-Limit Preset**: `client_update`: 30 requests / minute per IP.
- **Idempotency Need**: Standard update idempotency.
- **Side Effects**: Logs activity `updated_client` / `archived_client`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_3=false`.

---

### Batch 4: Account, Branding & Settings

#### Mutation 4.1: Workspace Settings Update (Branding & Numbering)
- **Current Call Site(s)**:
  - `UserSettingsService.saveUserSettings()` (`src/backend/auth/user-settings-service.ts`)
  - `settings-view.tsx`
- **New Route**: `PATCH /api/account/settings`
- **Input Schema**:
  ```typescript
  z.object({
    currency: z.string().length(3).optional(),
    timezone: z.string().max(50).optional(),
    dateFormat: z.string().max(20).optional(),
    invoicePrefix: z.string().max(10).optional(),
    invoiceNumberFormat: z.string().max(50).optional(),
    invoiceSeparator: z.string().max(5).optional(),
    invoiceIncludeYear: z.boolean().optional(),
    invoicePadding: z.number().min(1).max(10).optional(),
    invoiceNextSequence: z.number().min(1).optional(),
    defaultTaxRate: z.number().min(0).max(100).optional(),
    taxName: z.string().max(50).optional(),
    defaultPaymentTerms: z.number().min(0).max(365).optional(),
  })
  ```
- **Authorization Rule**: Authenticated user. Updates only the settings matching `user.id`.
- **Business Rules Enforced Server-Side**:
  - Sequence and numbering settings validated against pure rules in `src/shared/rules/`.
- **Rate-Limit Preset**: `settings_update`: 30 requests / minute per IP.
- **Idempotency Need**: Natural PUT/PATCH semantics.
- **Side Effects**: None.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_4=false`.

#### Mutation 4.2: Email Notification Preferences Update
- **Current Call Site(s)**:
  - `UserSettingsService.saveUserSettings()`
- **New Route**: `PATCH /api/account/notifications`
- **Input Schema**:
  ```typescript
  z.object({
    emailNotifications: z.boolean().optional(),
    emailDeliverables: z.boolean().optional(),
    emailDocuments: z.boolean().optional(),
    emailInvoices: z.boolean().optional(),
    invoiceReminders: z.boolean().optional(),
    commentAlerts: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
  })
  ```
- **Authorization Rule**: Authenticated user (`user_settings.id = user.id`).
- **Business Rules Enforced Server-Side**:
  - Validates boolean values.
- **Rate-Limit Preset**: `settings_notifications`: 30 requests / minute per IP.
- **Idempotency Need**: Safe update.
- **Side Effects**: None.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_4=false`.

#### Mutation 4.3: Account Deletion Request
- **Current Call Site(s)**:
  - `AccountDeletionService.deleteClientAccount()`
  - `AccountDeletionService.requestFreelancerAccountDeletion()`
- **New Route**: `POST /api/account/delete`
- **Input Schema**:
  ```typescript
  z.object({
    confirmText: z.literal('DELETE MY ACCOUNT'),
    reason: z.string().max(500).optional(),
  })
  ```
- **Authorization Rule**: Authenticated user. Resolves whether caller is a client or freelancer.
- **Business Rules Enforced Server-Side**:
  - Client deletion: sets 30-day recovery window in `account_deletions`, status `pending_deletion`.
  - Freelancer deletion: sets 5-day recovery window.
- **Rate-Limit Preset**: `account_delete`: 5 requests / minute per IP.
- **Idempotency Need**: If already pending deletion, returns 200 with existing deadline.
- **Side Effects**:
  - Creates activity record.
  - Revokes sessions.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_4=false`.

#### Mutation 4.4: Account Deletion Restore
- **Current Call Site(s)**:
  - `AccountDeletionService.restoreClientAccount()`
- **New Route**: `POST /api/account/restore`
- **Input Schema**:
  ```typescript
  z.object({
    clientId: z.string().uuid(),
  })
  ```
- **Authorization Rule**: Authenticated workspace owner. Caller must own the workspace of the client.
- **Business Rules Enforced Server-Side**:
  - Verifies current timestamp < `restore_until`.
  - Re-activates client (`status = 'active'`).
- **Rate-Limit Preset**: `account_restore`: 10 requests / minute per IP.
- **Idempotency Need**: Restoring an active client returns 200 OK.
- **Side Effects**: Activity log `client_account_restored`.
- **Rollback**: Set `NEXT_PUBLIC_SERVER_MUTATIONS_BATCH_4=false`.

---

## 3. RLS Tightening Migrations Sequence

Post-migration SQL migrations (unapplied):
1. `phase36_tighten_invoice_client_writes.sql`: Replaces `FOR ALL` policy on `public.invoices` and `public.invoice_items` with `FOR SELECT`, ensuring client browsers cannot issue direct `INSERT`/`UPDATE`/`DELETE`.
2. `phase37_tighten_deliverable_client_writes.sql`: Tightens `deliverables`, `deliverable_versions`, and `deliverable_comments` to `FOR SELECT` from browser clients.
3. `phase38_tighten_client_invitation_writes.sql`: Restricts `client_invitations` and `clients` mutations to server service-role only.
4. `phase39_tighten_settings_account_writes.sql`: Enforces server-only updates on `account_deletions` and `user_settings`.
