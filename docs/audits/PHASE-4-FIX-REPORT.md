# FlowDesk Phase 4 Security Remediation & Architecture Report

**Document**: Phase 4 Remediation Comprehensive Report  
**Scope**: Phase 4A (Hardening: Tasks 1–5) & Phase 4B (Operations & Architecture: Tasks 6–9)  
**Author**: Antigravity Security Engineering (Staff Full-Stack & AppSec Reviewer)  
**Status**: COMPLETE — All 18 Test Steps Passing, Build Clean, Zero Secrets Detected  

---

## 1. Executive Summary

Phase 4 of the FlowDesk remediation program addressed defensive hardening, operational resilience, and architectural boundary integrity across the application.

### Key Milestones Achieved
1. **Input Validation Matrix & Schemas (Task 1)**: Unified JSON body parser (`parseJsonBody`) and strict Zod schemas applied across all 12 API route handlers and dynamic URL parameters, rejecting unknown properties and capping request payload byte sizes.
2. **XSS & Injection Neutralization (Task 2)**: Added strict URL scheme sanitization (`isSafeHttpUrl`), parameterization of PostgREST dynamic filters in client lookup queries, and absolute elimination of client-side script execution vectors.
3. **File Upload Security & Magic-Byte Sniffing (Task 3)**: Implemented server-side upload validation with binary magic-byte inspection (PNG, JPEG, GIF, WebP, PDF, ZIP), double-extension rejection, null-byte neutralization, per-bucket byte limits, and universal rejection of SVG uploads. Provisioned unapplied database migration `phase34_storage_bucket_hardening.sql`.
4. **Security Headers, CSP & Telemetry (Task 4)**: Enforced HSTS (2-year max-age, includeSubDomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy`, and two-stage Content Security Policy (`CSP_MODE=report-only` default transitioning to `enforce`). Built CSP violation telemetry endpoint at `/api/csp-report`.
5. **PII Masking & Safe Error Generation (Task 5)**: Structured logger enhanced with automated redaction of sensitive credentials, JWT/bearer patterns, circular reference neutralization, email masking (`a***@example.com`), and uniform production error envelopes with correlation `X-Request-Id`.
6. **Account Deletion Purge Cron (Task 6)**: Implemented `/api/cron/purge-deleted-accounts` with timing-safe Bearer `CRON_SECRET` authentication, rate limiting, default dry-run execution safety, storage purging, and financial tax/ledger preservation.
7. **RLS Policy Audit Matrix & Migration (Task 7)**: Audited all 22 public tables and 5 storage buckets in `docs/audits/RLS-MATRIX.md`. Authored unapplied migration `phase35_rls_hardening.sql` closing client workspace/freelancer view barriers.
8. **CI / CD Pipeline & Unified Test Runner (Task 8)**: Built unified test runner `scripts/test-all.ts` running 18 verification steps, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, and `.github/CODEOWNERS`.
9. **Architecture Boundary Decoupling (Task 9)**: Created `docs/audits/ARCHITECTURE-BOUNDARY-PLAN.md` defining strict 4-tier separation, and migrated the Deliverable Approval workflow to a secured Route Handler (`/api/deliverables/[deliverableId]/approve`).

---

## 2. Detailed Task Breakdown & Code Excerpts

### Task 1: Strict Input Validation & Byte Size Limits
- **Vulnerability**: Route handlers previously parsed unbounded raw JSON (`await request.json()`), echoing raw database errors or accepting unknown malicious parameters.
- **Remediation**:
  - Created `parseJsonBody<T>()` in `src/shared/validation/parse-json-body.ts` which reads text streams, enforces hard byte-size limits, parses JSON safely, and runs strict Zod validation with `.strict()`.
  - Created `validateRouteParam()` validating dynamic route parameters (`deliverableId`, `paymentId`, `token`).
  - Documented matrix in `docs/audits/API-VALIDATION-MATRIX.md`.
- **Before / After**:
  ```typescript
  // BEFORE (app/api/payments/razorpay/order/route.ts)
  const body = await request.json();
  const { invoiceId, amount, currency } = body;
  // Unbounded, no type validation, vulnerable to prototype pollution or unknown payload injection
  ```
  ```typescript
  // AFTER
  const bodyValidation = await parseJsonBody(request, CreatePaymentOrderSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { invoiceId, amount, currency } = bodyValidation.data;
  ```

---

### Task 2: Cross-Site Scripting (XSS) & Injection Defense
- **Vulnerability**: PostgREST filter injection in `src/backend/client/index.ts` where unvalidated identifier strings were concatenated directly into `.or(...)` filter clauses:
  ```typescript
  // BEFORE (Vulnerable PostgREST filter injection)
  .or(`id.eq.${cleanId},portal_token.eq.${cleanId},legacy_portal_token.eq.${cleanId}`)
  ```
  If `cleanId` contained commas or parentheses, it could modify the PostgREST AST filter clauses.
- **Remediation**:
  - Refactored `getClientByFlexibleId` into discrete, typed query branches based on UUID vs token format.
  - Implemented `isSafeHttpUrl` and `getSafeHttpUrl` in `src/shared/utils/safe-url.ts`, neutralizing `javascript:`, `data:`, `vbscript:`, and protocol-relative `//` URLs across invoice document templates, client portal shell, and deliverable workspace modals.

---

### Task 3: File Upload Validation & Storage Hardening
- **Decision on SVG Uploads**: SVG uploads are **strictly rejected** across all storage buckets (`avatars`, `logos`, `signatures`, `documents`, `deliverables`). SVG is an XML dialect capable of embedding `<script>` tags, event handlers (`onload`), and external entity resolution (XXE). By disallowing SVG, stored XSS via image rendering is eliminated.
- **Implementation**:
  - `src/backend/storage/upload-validator.ts`: Inspects the first 16 bytes of every file stream to determine canonical MIME types (PNG, JPEG, GIF, WebP, PDF, ZIP).
  - Double extension detection: Rejects files with executable suffixes (`.pdf.exe`, `.png.php`).
  - Created migration `database/migrations/phase34_storage_bucket_hardening.sql`: Updates `storage.buckets` configuration to enforce `file_size_limit` and strip `image/svg+xml`.

---

### Task 4: Security Headers, CSP & CORS Hardening
- **Implementation**:
  - Configured `src/shared/config/security-headers.ts` and wired into `next.config.ts`.
  - Added headers:
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (Preload omitted pending production domain verification).
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), payment=()`
    - `Content-Security-Policy-Report-Only` (default) with report telemetry sending to `/api/csp-report`.
    - Added `Cache-Control: no-store` on all authenticated and payment endpoints.
    - Set `poweredByHeader: false` in `next.config.ts`.

---

### Task 5: Sensitive Data in Logs & Errors
- **Implementation**:
  - Created `FlowdeskLogger` in `src/backend/utilities/logger.ts` with recursive data sanitization:
    - Masks emails: `alex@example.com` -> `a***@example.com`
    - Masks phones: `+1234567890` -> `+1***90`
    - Redacts keys matching: `password`, `secret`, `token`, `authorization`, `bearer`, `cookie`, `apiKey`, `card`, `cvv`, `pan`, `account_number`.
    - Detects JWT (`eyJ...`), Bearer headers, and webhook secrets in values.
    - Neutralizes circular references with `WeakSet` tracking.
    - Caps depth to 6 levels and truncates strings > 2000 characters.
  - Implemented `createApiErrorResponse`: Attaches correlation `X-Request-Id` and logs server-side details while returning safe generic error codes to clients.

---

### Task 6: Account Deletion Purge Cron Route
- **Implementation**:
  - Route created at `app/api/cron/purge-deleted-accounts/route.ts`.
  - Authentication: Requires `Authorization: Bearer <CRON_SECRET>` verified using `crypto.timingSafeEqual`.
  - Fails closed with HTTP 500 if `CRON_SECRET` is unset.
  - Safe Default: `dry_run=true` unless query parameter explicitly specifies `?dry_run=false`.
  - Rate limited to 20 requests/minute.
  - Queries `account_deletions` where `status = 'pending_deletion'` and `restore_until <= NOW()`.
  - Preservation of Financial Ledger: For paid invoices (`paid_amount > 0`), the client reference is anonymized (`client_id = null, client_name = 'Archived Client'`), preserving transaction history for tax and audit compliance.
  - Cleans up storage objects across buckets.
  - Supports both `GET` (for scheduled platforms like Vercel Cron) and `POST`.

---

### Task 7: RLS Policy Matrix & Phase 35 Migration
- **Artifacts**:
  - `docs/audits/RLS-MATRIX.md`: Exhaustive evaluation of all tables and storage buckets.
  - `database/migrations/phase35_rls_hardening.sql`: Unapplied migration resolving:
    1. Client `SELECT` on `public.workspaces` for assigned workspaces.
    2. Client `SELECT` on `public.profiles` for workspace owners.
    3. Canonical storage path matching for `logos` and `signatures`.

---

### Task 8: Unified CI Test Runner & Workflow Automation
- **Artifacts**:
  - `scripts/test-all.ts`: Unified test runner running all 18 verification steps. Added to `package.json` as `npm run test:all`.
  - `.github/workflows/ci.yml`: GitHub Actions workflow running on PR and push to `main`.
  - `.github/pull_request_template.md`: Enforcing PR author security checklist.
  - `.github/CODEOWNERS`: Enforcing mandatory security owner review on critical paths.

---

### Task 9: Architecture Boundary Plan & Deliverable Approval Pilot
- **Artifacts**:
  - `docs/audits/ARCHITECTURE-BOUNDARY-PLAN.md`: Strategic blueprint for 4-tier separation and elimination of direct client database mutations.
  - Route created at `app/api/deliverables/[deliverableId]/approve/route.ts`.
  - Enforces session authentication, UUID format, payload schema, rate limit (30 req/min), workspace/client affiliation, state machine transition (`submitted` / `in_review` -> `approved`), and durable activity/security logging.
  - Updated `ClientDeliverableService.approveDeliverable` to delegate browser-side approvals to the new Route Handler.

---

## 3. Database Migration Runbook

All new SQL migrations created during Phase 4 are **UNAPPLIED** per instructions.

### Migration Sequence Order
| Sequence | Migration File | Description | Status |
| :---: | :--- | :--- | :---: |
| 1 | `database/migrations/phase34_storage_bucket_hardening.sql` | Updates storage buckets config, removes SVG, caps file limits | **UNAPPLIED** |
| 2 | `database/migrations/phase35_rls_hardening.sql` | Adds client workspace & profile read policies, hardens logos/signatures | **UNAPPLIED** |

### Staging Deployment Procedure
1. **Pre-Migration Backup**: Take a full PostgreSQL snapshot via Supabase Dashboard or CLI:
   ```bash
   supabase db dump -f backup_pre_phase4.sql
   ```
2. **Apply Phase 34**:
   ```bash
   supabase db push --file database/migrations/phase34_storage_bucket_hardening.sql
   ```
3. **Verify Bucket MIME Restrictions**:
   ```sql
   SELECT id, allowed_mime_types, file_size_limit FROM storage.buckets;
   -- Confirm 'image/svg+xml' is absent from all rows.
   ```
4. **Apply Phase 35**:
   ```bash
   supabase db push --file database/migrations/phase35_rls_hardening.sql
   ```
5. **Verify Dual-Role Policies**:
   ```sql
   SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('workspaces', 'profiles');
   ```

---

## 4. Operational Runbook & Environment Configuration

### Required Environment Variables

| Variable Name | Environment | Description | Recommended Setting |
| :--- | :--- | :--- | :--- |
| `CRON_SECRET` | Production & Staging | High-entropy secret for authenticating automated cron sweep | 32+ character hex or base64 token |
| `CSP_MODE` | Production & Staging | Controls Content Security Policy enforcement | Start with `report-only`, switch to `enforce` after 14-day soak |
| `NEXT_PUBLIC_APP_URL` | Production & Staging | Base URL of deployed application for CORS and redirect validation | `https://app.flowdesk.io` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | Service role key for backend cron and webhook processing | Loaded via secure secret manager |
| `UPSTASH_REDIS_REST_URL` | Production & Staging | Distributed rate limiter Upstash REST endpoint | Loaded via environment secret |
| `UPSTASH_REDIS_REST_TOKEN` | Server-Only | Distributed rate limiter token | Loaded via environment secret |

### CSP Soak Period Recommendation
1. **Initial Deployment (Days 1–14)**:
   - Deploy with `CSP_MODE=report-only`.
   - Monitor reports logged by `/api/csp-report`.
   - Inspect any third-party scripts (Razorpay checkout, analytics, font CDNs) that trigger violations.
2. **Transition to Enforce (Day 15+)**:
   - Update environment configuration to `CSP_MODE=enforce`.
   - Monitor application error rates.

### Automated Account Purge Setup
- **Vercel Cron Configuration** (`vercel.json`):
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/purge-deleted-accounts?dry_run=false",
        "schedule": "0 3 * * *"
      }
    ]
  }
  ```
- **Manual Verification (Dry-Run)**:
  ```bash
  curl -X GET "https://app.flowdesk.io/api/cron/purge-deleted-accounts?dry_run=true" \
       -H "Authorization: Bearer <CRON_SECRET>"
  ```
- **Manual Production Execution**:
  ```bash
  curl -X POST "https://app.flowdesk.io/api/cron/purge-deleted-accounts?dry_run=false" \
       -H "Authorization: Bearer <CRON_SECRET>"
  ```

---

## 5. User-Visible Behavior Changes

1. **SVG Upload Rejection**: Users attempting to upload `.svg` images for avatars, workspace logos, or invoice signatures will now receive a friendly error: `"Unsupported file type. Only PNG, JPEG, GIF, and WebP images are allowed."`
2. **File Size Limits**:
   - Avatars, Logos, Signatures: Max 2MB.
   - Documents and Deliverables: Max 25MB.
3. **Structured Error Codes & Request IDs**: Users encountering server-side errors will see clean error notifications accompanied by a support correlation code: `"An unexpected error occurred (Ref: req_xxxxxxxx)"`.
4. **Deliverable Approval Speed & Safety**: Approving deliverables in the client portal now executes through the secure server Route Handler, guaranteeing immutable activity logging and sign-off recording.

---

## 6. Residual Risk & Future Recommendations

| Area | Current Risk Level | Observation / Next Steps |
| :--- | :---: | :--- |
| **Upstash Redis Outage** | **LOW (Mitigated)** | Financial endpoints fail-closed; general routes fail-open to in-memory fallback. Multi-region Redis recommended for enterprise scale. |
| **Remaining Client Mutations** | **LOW (Contained by RLS)** | Deliverable approvals migrated as pilot. Follow Phase 5–7 roadmap in `ARCHITECTURE-BOUNDARY-PLAN.md` to migrate invoices and comments. |
| **HSTS Preload** | **LOW** | `preload` directive intentionally omitted until all subdomains are verified HTTPS-ready. Enable in DNS/HSTS submission portal after verification. |
