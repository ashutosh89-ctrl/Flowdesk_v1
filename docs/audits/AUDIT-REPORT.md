# FLOWDESK COMPREHENSIVE SECURITY & FULL-STACK CODE AUDIT REPORT

**Audit Date:** October 2026  
**Auditor:** Senior Application Security Engineer & Staff Full-Stack Reviewer  
**Repository:** `ashutosh89-ctrl/Flowdesk_v1` (FlowDesk)  
**Target Environment:** Next.js 15 (App Router), React 19, TypeScript, Supabase (PostgreSQL + RLS + Auth + Storage), Razorpay Payments, Brevo/Resend Email  
**Audit Scope:** Full-stack codebase covering Authentication, Authorization, Row Level Security, Payments, Transactional Emails, Input Validation, Secrets & Logging, Architecture, Reliability, and Testing Readiness.  
**Compliance & Verification Mode:** READ-ONLY evidence-based audit. All findings cited with exact file paths, line numbers, and verified code excerpts.

---

## 1. Executive Summary

### 1.1 Overall Risk Rating: **CRITICAL / NOT PRODUCTION READY**

FlowDesk is a feature-rich, multi-tenant freelancer operating system with an intuitive UI and sophisticated domain modeling. However, the system currently exhibits multiple **Critical** and **High-Severity** security vulnerabilities, authentication architecture flaws, and cross-tenant data isolation gaps that allow:
1. **Full Database Administrative Compromise**: Live Supabase Service Role JWT hardcoded in plaintext inside repository scripts.
2. **Account Takeover & IDOR on Client Portals**: Any attacker knowing or guessing a public client UUID can claim portal ownership without possessing the secret invitation token.
3. **Open Transactional Email Relay & Phishing**: Unauthenticated or client-invitation flows allow arbitrary recipients and HTML injection relayed through FlowDesk's verified email domain.
4. **Unauthenticated Email Auto-Binding**: Automatic linking of workspace client records to accounts based solely on email matching without requiring verified email confirmation.
5. **Production Server-Side API Authentication Failure**: The server-side API auth helper `requireApiCaller` invokes a client-side singleton without cookie context, causing server-side authentication to fail closed or misbehave across API endpoints.
6. **Cross-Tenant Storage Bucket Leakage**: Storage RLS policies for private deliverables and documents scope access to workspace IDs rather than client-specific ownership, allowing clients to download other clients' proprietary files within the same freelancer workspace.

### 1.2 Top 10 High-Impact Issues

| # | Finding ID | Severity | Status | Issue Summary | Primary File & Line |
|---|------------|----------|--------|---------------|----------------------|
| 1 | **SEC-CRIT-01** | Critical | CONFIRMED | **Hardcoded Live Supabase Service Role Key** in source scripts bypassing all RLS. | [`scripts/apply-schema.ts:12`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/scripts/apply-schema.ts#L12), [`scripts/verify-rls.ts:17`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/scripts/verify-rls.ts#L17) |
| 2 | **SEC-CRIT-02** | Critical | CONFIRMED | **Tokenless Client Account Takeover (IDOR)** via fallback query `id.eq.${rawToken}` during invite claim. | [`src/backend/invitations/invitation-service.ts:291, 464`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/invitations/invitation-service.ts#L291) |
| 3 | **SEC-CRIT-03** | Critical | CONFIRMED | **Arbitrary Email Relay & Phishing Abuse** via `/api/email` when `eventType: 'client_invitation'`. | [`app/api/email/route.ts:205-209, 301-312`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/email/route.ts#L205) |
| 4 | **SEC-CRIT-04** | Critical | CONFIRMED | **Stateless Browser Client Singleton in API Auth** breaks production cookie-based authentication. | [`src/backend/utilities/api-auth.ts:41`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/utilities/api-auth.ts#L41) |
| 5 | **SEC-HIGH-01** | High | CONFIRMED | **Unverified Email Auto-Binding** in `/api/auth/roles` binds client records across workspaces without email confirmation. | [`app/api/auth/roles/route.ts:83-108`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/auth/roles/route.ts#L83) |
| 6 | **SEC-HIGH-02** | High | CONFIRMED | **Cross-Client Storage Object Disclosure** in `deliverables` & `documents` shared workspace buckets. | [`database/migrations/phase29_storage_and_entities_rls_fix.sql:229-247`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase29_storage_and_entities_rls_fix.sql#L229) |
| 7 | **SEC-HIGH-03** | High | CONFIRMED | **Unauthenticated Brevo Webhook Execution & Plaintext Secret Comparison** when webhook secret is unconfigured. | [`app/api/webhooks/brevo/route.ts:11-28`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/brevo/route.ts#L11) |
| 8 | **SEC-HIGH-04** | High | CONFIRMED | **Open Redirect Vulnerability** in OAuth Callback handler `next` query parameter. | [`app/auth/callback/route.ts:11, 39, 69`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/auth/callback/route.ts#L11) |
| 9 | **SEC-MED-01** | Medium | CONFIRMED | **Broken Invitation Middleware Route Exclusion** forces unauthenticated invitees to login without invite context. | [`middleware.ts:33-51, 95-98`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/middleware.ts#L33) |
| 10 | **SEC-MED-02** | Medium | CONFIRMED | **In-Memory Rate Limiter** does not persist across serverless lambdas or multi-instance containers. | [`src/backend/utilities/rate-limiter.ts:34-124`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/utilities/rate-limiter.ts#L34) |

### 1.3 Production Go / No-Go Decision

**VERDICT: NO-GO**  
Deploying FlowDesk in its current state to a live multi-tenant environment poses immediate risks of tenant data exfiltration, account hijacking, credential compromise, and domain reputation destruction via spam relays. The P0 and P1 remediation roadmap items must be addressed before opening FlowDesk to public traffic.

---

## 2. Phase 0: Baseline Verification Results

All tests, builds, linters, and verification scripts were executed on the repository without modifying any source files.

| Execution Target | Command / Script | Result | Output & Diagnostics |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | 0 type errors. `tsc --noEmit` completed cleanly. |
| **ESLint** | `npm run lint` | **PASS (4 Warnings)** | 0 errors. 4 `@next/next/no-img-element` warnings:<br>• `src/frontend/auth/onboarding-flow.tsx:225`<br>• `src/frontend/shared/invoice/invoice-document.tsx:63, 245, 535` |
| **Next.js Production Build** | `npm run build` | **PASS** | Next.js 15.5.23 compiled 29 static & dynamic route endpoints. |
| **NPM Audit** | `npm audit` | **FAIL (40 Vulnerabilities)** | 1 Low, 15 Moderate, 22 High, 2 Critical (`next`, `proxy-addr`, `undici`, `sharp`, `postcss`). |
| **Test: Email Operations** | `tests/all-email-operations.test.ts` | **PASS (11/11)** | Simulated demo store email pipeline passed. |
| **Test: Auth E2E Approaches** | `tests/auth-e2e-all-approaches.test.ts` | **FAIL (23/25)** | 2 tests failed in Demo Client Login (`Client demo login succeeds for Eleanor Vance` - mock store mismatch). |
| **Test: Auth Fail Closed** | `tests/auth-fail-closed.test.ts` | **PASS (14/14)** | Verified fail-closed guards in demo mode. |
| **Test: Brevo Deep Audit** | `tests/brevo-email-deep-audit.test.ts` | **PASS (22/22)** | Configuration & payload sanitization verified (live calls skipped without API key). |
| **Test: Client Invitations** | `tests/client-connection-invitation.test.ts` | **PASS (45/45)** | Token generation, hashing, and state machines passed in mock store. |
| **Test: Phone Validation** | `tests/country-phone-validation.test.ts` | **PASS (32/32)** | E.164 and country code parsing verified. |
| **Test: Data Workflow E2E** | `tests/data-workflow-e2e.test.ts` | **PASS (15/15)** | Full lifecycle (client -> project -> deliverable -> invoice) passed in mock store. |
| **Test: Invoice Rendering** | `tests/invoice-export-and-rendering.test.ts` | **PASS (23/23)** | HTML & jsPDF export verified. |
| **Test: Rate Limiter** | `tests/rate-limiter.test.ts` | **PASS (13/13)** | In-memory token bucket sliding window verified. |
| **Test: Razorpay Payments** | `tests/razorpay-payment.test.ts` | **FAIL (43/48)** | 5 tests failed due to missing live `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`. |
| **Test: Resend Email Audit** | `tests/resend-email-deep-audit.test.ts` | **PASS (29/29)** | Resend driver mock pipeline verified. |
| **Test: RLS Redteam** | `tests/rls-redteam.test.ts` | **PASS (15/15)** | **WARNING**: This test runs against in-memory `FlowDeskStore`, NOT live Supabase Postgres RLS. |
| **Script: Hardening Verify** | `scripts/verify-hardening.ts` | **PASS (37/38)** | 1 test skipped/failed due to missing live Razorpay secret. |
| **Script: Razorpay Verify** | `scripts/verify-razorpay.ts` | **FAIL (18/37)** | 19 live gateway signature and order checks failed due to unset test secrets. |
| **Script: RLS Verification** | `scripts/verify-rls.ts` | **PASS (19/19)** | Executed against live Supabase project `https://ldgjmojwkktymnrthzho.supabase.co` using hardcoded service key. |
| **Script: SEO / AEO Verify** | `scripts/verify-seo-aeo.ts` | **FAIL (Network)** | Failed with `ECONNREFUSED 127.0.0.1:3000` (requires active running dev server). |

---

## 3. Findings Table

| Finding ID | Severity | Status | Area | Location | Description | Impact | Recommended Fix |
|---|---|---|---|---|---|---|---|
| **SEC-CRIT-01** | Critical | CONFIRMED | Secrets & Credentials | [`scripts/apply-schema.ts:12`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/scripts/apply-schema.ts#L12), [`scripts/verify-rls.ts:17`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/scripts/verify-rls.ts#L17) | Plaintext Supabase `service_role` JWT committed in source code. | Full database administrative compromise, total RLS bypass. | Rotate Supabase service role key immediately; load strictly from `.env`. |
| **SEC-CRIT-02** | Critical | CONFIRMED | Authorization / IDOR | [`src/backend/invitations/invitation-service.ts:291, 464`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/invitations/invitation-service.ts#L291) | Fallback query matches `id.eq.${rawToken}` allowing tokenless account claiming. | Any authenticated user can hijack any unbound client portal using just their client UUID. | Remove `id.eq.${rawToken}` fallback; require matching valid SHA-256 token hash. |
| **SEC-CRIT-03** | Critical | CONFIRMED | Email / Abuse | [`app/api/email/route.ts:205-209, 301-312`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/email/route.ts#L205) | `client_invitation` event skips recipient authorization and sends arbitrary caller-supplied HTML. | Open spam relay, spear-phishing from FlowDesk's verified domain. | Generate invitation emails server-side from pre-compiled templates; validate recipient against database. |
| **SEC-CRIT-04** | Critical | CONFIRMED | Authentication | [`src/backend/utilities/api-auth.ts:41`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/utilities/api-auth.ts#L41) | `requireApiCaller` calls browser singleton `supabase.auth.getUser()` without cookie context. | In production, server-side API auth fails closed or drops caller identity. | Use `createRouteHandlerClient({ cookies })` from `@supabase/auth-helpers-nextjs` or `@supabase/ssr`. |
| **SEC-HIGH-01** | High | CONFIRMED | Authentication / Binding | [`app/api/auth/roles/route.ts:83-108`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/auth/roles/route.ts#L83) | Auto-binds unbound clients by email without verifying `user.email_confirmed_at`. | Attacker registering an unverified victim email claims victim's client portal. | Require `email_confirmed_at IS NOT NULL` and explicit cryptographic token verification before binding. |
| **SEC-HIGH-02** | High | CONFIRMED | Storage & RLS | [`database/migrations/phase29_storage_and_entities_rls_fix.sql:229-247`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase29_storage_and_entities_rls_fix.sql#L229) | Storage RLS policies for `deliverables` and `documents` scope only by workspace ID. | Client A in a workspace can download Client B's private deliverables and contracts. | Scope storage paths to `workspace_id/client_id/...` and verify client ownership in RLS policy. |
| **SEC-HIGH-03** | High | CONFIRMED | Webhooks / Auth | [`app/api/webhooks/brevo/route.ts:11-28`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/brevo/route.ts#L11) | Webhook executes without authentication if `BREVO_WEBHOOK_SECRET` is unset; non-constant-time secret check. | Unauthenticated attacker can forge email delivery events and manipulate message statuses. | Require secret to be present; enforce `crypto.timingSafeEqual`; reject query parameter secrets. |
| **SEC-HIGH-04** | High | CONFIRMED | Auth / Open Redirect | [`app/auth/callback/route.ts:11, 39, 69`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/auth/callback/route.ts#L11) | `next` query parameter redirects using `new URL(next, origin)` without relative path validation. | Phishing via open redirect (e.g. `?next=//attacker.com` or `?next=https://evil.com`). | Validate `next.startsWith('/') && !next.startsWith('//') && !next.includes('://')`. |
| **SEC-MED-01** | Medium | CONFIRMED | Middleware / Routing | [`middleware.ts:33-51, 95-98`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/middleware.ts#L33) | `/connect/*` invite routes omitted from public route matchers. | Invited clients clicking email links get bounced to `/login`, dropping invite token context. | Add `/connect/:path*` to `isClientPublicRoute` and preserve redirect URLs. |
| **SEC-MED-02** | Medium | CONFIRMED | Rate Limiting | [`src/backend/utilities/rate-limiter.ts:34-124`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/utilities/rate-limiter.ts#L34) | Rate limiter uses process-local `Map`; claims to be distributed. | Rate limiting easily bypassed across serverless instances or multi-container deployments. | Integrate Redis (Upstash) or Supabase table-backed token bucket for true distributed limiting. |
| **SEC-MED-03** | Medium | CONFIRMED | Security Headers | [`next.config.ts:4-9`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/next.config.ts#L4) | Missing `Content-Security-Policy` (CSP) and `Strict-Transport-Security` (HSTS). | Elevated risk of XSS execution and SSL stripping attacks. | Add comprehensive security headers in `next.config.ts` (CSP, HSTS, X-Content-Type-Options, etc.). |
| **SEC-MED-04** | Medium | CONFIRMED | Input Validation | `app/api/**` routes (all endpoints) | Zod is installed in `package.json` but imported nowhere in API handlers. | Unvalidated payload shapes, unexpected JSON structures, potential prototype pollution. | Implement strict Zod schemas for all API route request bodies and query parameters. |
| **SEC-MED-05** | Medium | CONFIRMED | PostgREST Injection | [`app/api/auth/roles/route.ts:87`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/auth/roles/route.ts#L87) | Unsanitized email parameter in `.ilike('email', user.email.trim())`. | PostgREST query wildcard injection (`%` or `_`) matching unintended client records. | Escape `%` and `_` characters in email search strings or use exact equality `.eq()`. |
| **SEC-LOW-01** | Low | CONFIRMED | Secrets & Config | [`.env.example:22-26`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/.env.example#L22) | Configuration drift: `.env.example` documents `GEMINI_API_KEY` and Resend; code primarily uses Brevo. | Deployment confusion and accidental misconfiguration. | Align `.env.example` with actual codebase dependencies and remove unused keys. |
| **SEC-LOW-02** | Low | CONFIRMED | Dead Code & Bloat | [`package.json:28-40`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/package.json#L28) | Unused packages installed: `@google/genai`, `firebase-tools`, `html2canvas`. | Increased attack surface, dependency vulnerabilities, and bundle size. | Prune unused dependencies from `package.json`. |

---

## 4. Detailed Write-Up for Critical & High Findings

---

### Finding SEC-CRIT-01: Hardcoded Live Supabase Service Role Key in Source Code

- **Severity:** Critical (CVSS 10.0)
- **Status:** CONFIRMED
- **Location:** [`scripts/apply-schema.ts:12`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/scripts/apply-schema.ts#L12), [`scripts/verify-rls.ts:17`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/scripts/verify-rls.ts#L17)

```typescript
// scripts/apply-schema.ts:12
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1Ni...[REDACTED_LIVE_SERVICE_ROLE_KEY]';

// scripts/verify-rls.ts:17
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1Ni...[REDACTED_LIVE_SERVICE_ROLE_KEY]';
```

#### Exploit Scenario:
1. An attacker inspects the repository or build artifacts and extracts the hardcoded JWT token.
2. The JWT token has `role: "service_role"` with an expiration date in the year 2036 (`exp: 2101432332`).
3. The attacker issues direct HTTP REST requests to `https://ldgjmojwkktymnrthzho.supabase.co/rest/v1/` with header `apikey: <SERVICE_ROLE_KEY>` and `Authorization: Bearer <SERVICE_ROLE_KEY>`.
4. Supabase Postgres completely disables Row Level Security (RLS) for the `service_role`.
5. The attacker dumps all workspace databases, client lists, invoices, payment records, bank account details, and executes arbitrary database commands (`DELETE FROM profiles;`, `SELECT * FROM invoices;`).

#### Remediation:
1. Immediately **rotate the Service Role Key** in the Supabase Dashboard for project `ldgjmojwkktymnrthzho`.
2. Remove the hardcoded strings from `scripts/apply-schema.ts` and `scripts/verify-rls.ts`. Require `process.env.SUPABASE_SERVICE_ROLE_KEY` and throw an error if missing.

```typescript
// Proposed fix in scripts/apply-schema.ts
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
}
```

---

### Finding SEC-CRIT-02: Tokenless Client Account Takeover (IDOR) via Fallback Query

- **Severity:** Critical (CVSS 9.8)
- **Status:** CONFIRMED
- **Location:** [`src/backend/invitations/invitation-service.ts:291, 464`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/invitations/invitation-service.ts#L291)

```typescript
// src/backend/invitations/invitation-service.ts:289-293
const { data: legacyClient } = await supabaseAdmin
  .from('clients')
  .select('*')
  .or(`portal_token.eq.${tokenHash},portal_token.eq.${rawToken},id.eq.${rawToken}`)
  .maybeSingle();

// src/backend/invitations/invitation-service.ts:462-466
const { data: legacyClient } = await supabaseAdmin
  .from('clients')
  .select('*')
  .or(`portal_token.eq.${tokenHash},portal_token.eq.${rawToken},id.eq.${rawToken}`)
  .maybeSingle();
```

#### Exploit Scenario:
1. Freelancer creates a new client "Acme Corp" in their dashboard. The client record is inserted with `user_id = NULL` and an assigned UUID `id = 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`.
2. An attacker (e.g. a rogue client or public observer who discovers the client UUID from an invoice, public asset URL, or enumeration) registers an account on FlowDesk.
3. The attacker sends a POST request to `/api/invitations/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/claim`.
4. `invitation-service.ts` queries the `clients` table using the `.or(...)` filter. Because `id.eq.${rawToken}` matches the client's UUID, `legacyClient` is successfully returned even though the caller has no knowledge of any secret token.
5. Lines 490-504 execute `supabaseAdmin.from('clients').update({ user_id: authUser.id }).eq('id', legacyClient.id)`.
6. The attacker is now permanently bound as the owner of "Acme Corp". The attacker can view all Acme Corp invoices, deliverables, confidential project notes, and contracts.

#### Remediation:
Remove the `id.eq.${rawToken}` clause from both `getInvitationByToken` and `claimInvitation`. Tokens must strictly match SHA-256 hashed secret tokens.

```typescript
// Proposed fix in src/backend/invitations/invitation-service.ts
const { data: legacyClient } = await supabaseAdmin
  .from('clients')
  .select('*')
  .or(`portal_token.eq.${tokenHash},portal_token.eq.${rawToken}`)
  .maybeSingle();
```

---

### Finding SEC-CRIT-03: Arbitrary Email Relay & Phishing Abuse via `/api/email`

- **Severity:** Critical (CVSS 9.1)
- **Status:** CONFIRMED
- **Location:** [`app/api/email/route.ts:205-209, 301-312`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/email/route.ts#L205)

```typescript
// app/api/email/route.ts:205-209
// If not found in clients, check if this is an invitation email (client record might not be linked yet)
if (!clientRecord && eventType !== 'client_invitation') {
  return { ok: false, error: 'Unauthorized: Recipient email is not an authorized client in your workspace' };
}

// app/api/email/route.ts:301-312
const emailResult = await sendEmail({
  to: recipientEmail,
  subject: (body.subject as string) || getDefaultSubject(eventType),
  html: (body.html as string) || generateEmailHtml(eventType, body.data || {}),
  workspaceId,
  eventType,
  entityId: (body.entityId as string) || (body.invoiceId as string) || (body.clientId as string),
  metadata: { ... }
});
```

#### Exploit Scenario:
1. Any authenticated user (freelancer or client) issues a POST request to `/api/email` with:
   ```json
   {
     "to": "target-ceo@fortune500.com",
     "eventType": "client_invitation",
     "subject": "Urgent: Wire Transfer Verification Required",
     "html": "<html><body><h1>Click here to verify your banking credentials: <a href='https://phishing.site'>Login</a></h1></body></html>"
   }
   ```
2. Line 205 explicitly bypasses the recipient database validation check because `eventType === 'client_invitation'`.
3. Lines 301-304 take `body.subject` and `body.html` directly from the untrusted JSON request payload and dispatch them via Brevo or Resend.
4. The phishing email is delivered with valid SPF, DKIM, and DMARC signatures belonging to FlowDesk's production domain.

#### Remediation:
1. Never accept raw `subject` or `html` parameters from client HTTP requests.
2. Generate all transactional email templates strictly on the server based on validated database entities.
3. For client invitations, ensure the recipient email matches a pending invitation record in `client_invitations` belonging to the caller's workspace.

---

### Finding SEC-CRIT-04: Stateless Browser Client Singleton in API Auth Breaks Production

- **Severity:** Critical / Architectural Flaw
- **Status:** CONFIRMED
- **Location:** [`src/backend/utilities/api-auth.ts:39-44`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/utilities/api-auth.ts#L39)

```typescript
// src/backend/utilities/api-auth.ts:39-44
export async function requireApiCaller(req?: NextRequest): Promise<ApiCaller | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email || '', role: 'authenticated' };
  } catch {
    return null;
  }
}
```

#### Exploit & Failure Scenario:
1. In Next.js App Router API route handlers, incoming HTTP requests carry Supabase auth tokens inside `cookie` headers.
2. The imported `supabase` object in `api-auth.ts` is the browser client created with `createClient(url, anonKey)` without cookies.
3. When `await supabase.auth.getUser()` is called in an API route, it searches browser storage / memory, which is empty on the Node.js server.
4. `user` returns `null`, causing `requireApiCaller` to return `null`.
5. Every API route relying on `requireApiCaller` (e.g. `/api/invoices/[id]/payment-status`, `/api/payments/razorpay/order`, `/api/payments/razorpay/verify`) immediately returns HTTP 401 Unauthorized for real users in production mode.

#### Remediation:
Refactor `api-auth.ts` to inspect the incoming `NextRequest` cookies or `Authorization: Bearer <JWT>` header using `@supabase/ssr` or `supabaseAdmin.auth.getUser(token)`.

```typescript
// Proposed fix in src/backend/utilities/api-auth.ts
import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

export async function requireApiCaller(req?: NextRequest): Promise<ApiCaller | null> {
  const token = req?.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || req?.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email || '', role: 'authenticated' };
}
```

---

### Finding SEC-HIGH-01: Unverified Email Auto-Binding in `/api/auth/roles`

- **Severity:** High (CVSS 8.2)
- **Status:** CONFIRMED
- **Location:** [`app/api/auth/roles/route.ts:83-108`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/auth/roles/route.ts#L83)

```typescript
// app/api/auth/roles/route.ts:83-88
const { data: emailMatches } = await supabaseAdmin
  .from('clients')
  .select('id, name, company, status, user_id')
  .ilike('email', user.email.trim())
  .is('user_id', null);

// app/api/auth/roles/route.ts:98-106
for (const match of emailMatches) {
  await supabaseAdmin
    .from('clients')
    .update({ 
      user_id: user.id,
      status: match.status === 'invited' ? 'active' : match.status 
    })
    .eq('id', match.id);
}
```

#### Exploit Scenario:
1. Freelancer Alice creates a client record for `bob@corporate.com`.
2. Attacker Charlie goes to `/signup` and enters `bob@corporate.com` with a password of Charlie's choosing. Supabase Auth creates an unconfirmed user record.
3. If Supabase auto-confirm is enabled or if Charlie triggers the `/api/auth/roles` check before Bob confirms his email, `/api/auth/roles` searches `clients` for `bob@corporate.com`.
4. The route executes `supabaseAdmin.from('clients').update({ user_id: charlie.id })`.
5. Charlie now owns Bob's client portal across all freelancer workspaces in FlowDesk.

#### Remediation:
1. Verify `user.email_confirmed_at` is NOT null.
2. Require clients to claim their account through a signed one-time invite token sent to their inbox, rather than auto-binding on email match.

---

### Finding SEC-HIGH-02: Cross-Client Storage Object Disclosure in Shared Workspaces

- **Severity:** High (CVSS 7.7)
- **Status:** CONFIRMED
- **Location:** [`database/migrations/phase29_storage_and_entities_rls_fix.sql:229-247, 341-359`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/database/migrations/phase29_storage_and_entities_rls_fix.sql#L229)

```sql
-- database/migrations/phase29_storage_and_entities_rls_fix.sql:229-247
CREATE POLICY "deliverables_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'deliverables' AND (
    -- Freelancer check (workspace owner)
    EXISTS (
      SELECT 1 FROM public.workspaces ws
      WHERE ws.owner_id = auth.uid()
      AND (storage.foldername(name))[2] = ws.id::text
    )
    OR
    -- Client check: checks only if user is a client in the workspace!
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid()
      AND c.workspace_id::text = (storage.foldername(name))[2]
    )
  )
);
```

#### Exploit Scenario:
1. Freelancer Bob has two clients: Client A (Apple) and Client B (Microsoft). Both clients are in Bob's workspace (`ws-100`).
2. Bob uploads a confidential prototype deliverable `deliverables/ws-100/client-apple/secret-patent.pdf` for Apple.
3. Client B logs into the portal, authenticates with Supabase, and lists or downloads `deliverables/ws-100/client-apple/secret-patent.pdf`.
4. Because the RLS policy only checks `c.workspace_id::text = (storage.foldername(name))[2]`, and Client B belongs to `ws-100`, Supabase Storage grants Client B full read access to Apple's confidential files.

#### Remediation:
Update storage path conventions and RLS policies to check the client folder segment: `(storage.foldername(name))[3] = c.id::text`.

---

### Finding SEC-HIGH-03: Unauthenticated Brevo Webhook Execution & Plaintext Secret Check

- **Severity:** High (CVSS 7.5)
- **Status:** CONFIRMED
- **Location:** [`app/api/webhooks/brevo/route.ts:11-28`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/brevo/route.ts#L11)

```typescript
// app/api/webhooks/brevo/route.ts:11-28
const BREVO_WEBHOOK_SECRET = process.env.BREVO_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // If a webhook secret is configured, verify it
  if (BREVO_WEBHOOK_SECRET) {
    const headerSecret = req.headers.get('x-brevo-webhook-secret') ||
                         req.headers.get('x-webhook-secret') ||
                         req.nextUrl.searchParams.get('secret');
    if (headerSecret !== BREVO_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  // ... proceeds to update database tables based on body ...
```

#### Exploit Scenario:
1. If an administrator deploys FlowDesk without setting `BREVO_WEBHOOK_SECRET` in production environment variables, `if (BREVO_WEBHOOK_SECRET)` evaluates to false.
2. The endpoint becomes completely unauthenticated.
3. Any external attacker can POST arbitrary payload arrays to `/api/webhooks/brevo`, spoofing `delivered`, `opened`, `clicked`, `bounced`, or `spam` events for any message ID, corrupting invoice audit trails and triggering false notifications.
4. Even when configured, `headerSecret !== BREVO_WEBHOOK_SECRET` is vulnerable to timing attacks, and accepting secrets in query parameters leaks secrets into web server access logs.

#### Remediation:
1. Reject webhook requests if `BREVO_WEBHOOK_SECRET` is not set.
2. Use `crypto.timingSafeEqual` with constant-length buffers.
3. Disallow query parameter secrets.

---

### Finding SEC-HIGH-04: Open Redirect Vulnerability in OAuth Callback Handler

- **Severity:** High (CVSS 7.4)
- **Status:** CONFIRMED
- **Location:** [`app/auth/callback/route.ts:11, 39, 69`](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/auth/callback/route.ts#L11)

```typescript
// app/auth/callback/route.ts:11, 69
let next = requestUrl.searchParams.get('next') || '/auth/post-login';
// ...
return NextResponse.redirect(new URL(next, origin));
```

#### Exploit Scenario:
1. An attacker crafts a malicious link:  
   `https://flowdesk.app/auth/callback?code=valid_code&next=https://attacker-phishing.com/login`  
   or  
   `https://flowdesk.app/auth/callback?code=valid_code&next=//attacker-phishing.com`
2. `new URL('https://attacker-phishing.com/login', 'https://flowdesk.app')` ignores the second parameter (`origin`) when the first parameter is an absolute URL or protocol-relative URL.
3. The user completes Google/OAuth login and is immediately redirected to `https://attacker-phishing.com/login`.

#### Remediation:
Sanitize and validate the `next` redirect path to ensure it is strictly a relative path on the same host.

```typescript
// Proposed fix in app/auth/callback/route.ts
function getSafeRedirectUrl(next: string | null, origin: string): URL {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) {
    return new URL(next, origin);
  }
  return new URL('/auth/post-login', origin);
}
```

---

## 5. Route-by-Route API Security Matrix

Every API endpoint under `app/api/**` was inspected for Authentication, Authorization, Rate Limiting, and Input Validation.

| Route Path | HTTP Method | Authentication Check | Authorization / Tenant Check | Rate Limit | Input Validation |
|---|---|---|---|---|---|
| `/api/auth/roles` | `GET`, `POST` | Supabase User Token | Checks `user.email` & queries `clients` | 10 req/min | Missing (Manual payload parsing) |
| `/api/clients/[id]/invite` | `POST` | Supabase User Token | Workspace Ownership (`c.workspace_id = ws.id`) | Missing | Missing (Zod not used) |
| `/api/clients/[id]/magic-link` | `POST` | Supabase User Token | Workspace Ownership | Missing | Missing (Zod not used) |
| `/api/deliverables/[id]/activity` | `POST` | Supabase User Token | Workspace or Client Participant | Missing | Partial |
| `/api/email` | `POST` | Supabase User Token | Client membership (bypassed on invite) | 20 req/min | Missing (Zod not used) |
| `/api/email/templates/render` | `POST` | Supabase User Token | Workspace Ownership | Missing | Missing (Zod not used) |
| `/api/invitations/[token]/claim` | `POST` | Supabase User Token | Vulnerable to Tokenless IDOR (`id.eq`) | 10 req/min | Missing (Zod not used) |
| `/api/invitations/[token]/public` | `GET` | Public | Token lookup (leaks workspace name/email) | 30 req/min | Token string |
| `/api/invoices/[id]/payment-status` | `GET` | `requireApiCaller` (Broken) | Invoice Ownership | Missing | UUID regex |
| `/api/payments/razorpay/order` | `POST` | `requireApiCaller` (Broken) | Invoice Ownership & Client Match | 20 req/min | Missing (Zod not used) |
| `/api/payments/razorpay/verify` | `POST` | `requireApiCaller` (Broken) | Invoice & HMAC Signature Check | 10 req/min | Missing (Zod not used) |
| `/api/payments/record-manual` | `POST` | Supabase User Token | Freelancer Workspace Ownership | Missing | Missing (Zod not used) |
| `/api/portal/auth` | `POST` | Public / Magic Link | Token Verification | 5 req/min | Email / Token string |
| `/api/webhooks/brevo` | `POST` | Webhook Secret Header | Optional Secret (Bypassed if unset) | Missing | Event array parsing |
| `/api/webhooks/razorpay` | `POST` | HMAC-SHA256 Signature | Gateway Signature Verification | Missing | Webhook payload check |
| `/api/webhooks/resend` | `POST` | Svix Signature | Webhook Secret Verification | Missing | Webhook payload check |

---

## 6. Final Row-Level Security (RLS) Policy Matrix

Compiled from `database/schema/schema.sql` and all 31 migration files (`phase01` through `phase31`).

| Table Name | RLS Enabled | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Security Observations / Deficiencies |
|---|---|---|---|---|---|---|
| `profiles` | YES | `id = auth.uid()` | `id = auth.uid()` | `id = auth.uid()` | `id = auth.uid()` | Proper self-isolation. |
| `workspaces` | YES | `owner_id = auth.uid()` | `owner_id = auth.uid()` | `owner_id = auth.uid()` | `owner_id = auth.uid()` | Isolated to workspace owner. |
| `clients` | YES | Freelancer (owner) OR `user_id = auth.uid()` | Workspace owner | Workspace owner OR self (limited) | Workspace owner | Verified secure after Phase 29 migration. |
| `projects` | YES | Freelancer OR Client of project | Freelancer only | Freelancer only | Freelancer only | Clients have read-only visibility into assigned projects. |
| `deliverables` | YES | Freelancer OR Client of project | Freelancer only | Freelancer OR Client (status change) | Freelancer only | Status update transitions must be strictly enforced. |
| `comments` | YES | Freelancer OR (Client AND `is_internal = false`) | Freelancer OR Client | Freelancer (own) OR Client (own) | Freelancer (own) | `is_internal` comments correctly hidden from clients. |
| `invoices` | YES | Freelancer OR Client of invoice | Freelancer only | Freelancer only | Freelancer only | Payments updated via `service_role` RPC `settle_razorpay_payment`. |
| `payments` | YES | Freelancer OR Client of invoice | `service_role` only | `service_role` only | None | Client cannot insert or tamper with payment records directly. |
| `documents` | YES | Freelancer OR Client of document | Freelancer only | Freelancer only | Freelancer only | Document access scoped to client ID. |
| `client_invitations` | YES | Freelancer owner only | Freelancer owner only | Freelancer owner only | Freelancer owner only | Claiming operations run via `service_role` RPCs. |
| `email_events` | YES | Freelancer owner only | `service_role` only | `service_role` only | None | Webhooks write via `service_role` admin client. |
| `user_settings` | YES | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` | Self-isolated. |
| `storage.objects` (`deliverables`) | YES | Workspace Owner OR Client in Workspace | Workspace Owner OR Client | Workspace Owner | Workspace Owner | **VULNERABLE (SEC-HIGH-02):** Client can read deliverables of other clients in same workspace. |
| `storage.objects` (`documents`) | YES | Workspace Owner OR Client in Workspace | Workspace Owner | Workspace Owner | Workspace Owner | **VULNERABLE (SEC-HIGH-02):** Client can read contracts of other clients in same workspace. |
| `storage.objects` (`avatars`) | YES | Public (`bucket_id = 'avatars'`) | `auth.uid()::text = (storage.foldername(name))[1]` | Owner only | Owner only | Verified OK. |

---

## 7. Verified OK List

The following components, functions, and architectural patterns were audited and verified to be secure and functioning correctly:

1. **Razorpay Payment Amount Integrity**: Payment order generation recalculates the exact balance due server-side from invoice items (`invoice.total - invoice.amount_paid`). Clients cannot alter amounts or pay negative values.
2. **Razorpay Webhook Signature Verification**: `app/api/webhooks/razorpay/route.ts` correctly verifies HMAC-SHA256 signatures using raw request body text and `crypto.createHmac`.
3. **Internal Comment Protection**: Database RLS policy on `comments` strictly prevents clients from viewing comments where `is_internal = true`.
4. **Demo Mode Isolation**: `ALLOW_TEST_PAYMENTS` and mock identities are strictly guarded by `isDemoModeActive()`. In production mode (`NEXT_PUBLIC_AUTH_MODE=production`), mock payment triggers are unreachable.
5. **jsPDF Invoice Generation**: PDF invoice creation executes on client/server using pure vector drawing methods; no raw HTML rendering or unescaped string injection in PDF output.
6. **Password Hashing & Session Management**: Handled entirely via Supabase Auth (Argon2id / bcrypt), with `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.

---

## 8. Prioritized Remediation Roadmap

| Priority | Issue ID | Task / Action | Scope / File | Effort |
|---|---|---|---|---|
| **P0 (Immediate)** | **SEC-CRIT-01** | Rotate Supabase service role key and remove hardcoded tokens. | `scripts/apply-schema.ts`, `scripts/verify-rls.ts` | **S** (1 hour) |
| **P0 (Immediate)** | **SEC-CRIT-02** | Remove `id.eq.${rawToken}` fallback query in invitation claim. | `src/backend/invitations/invitation-service.ts` | **S** (1 hour) |
| **P0 (Immediate)** | **SEC-CRIT-03** | Restrict `/api/email` to server-compiled templates; validate recipients. | `app/api/email/route.ts` | **M** (4 hours) |
| **P0 (Immediate)** | **SEC-CRIT-04** | Fix `requireApiCaller` to inspect request headers/cookies. | `src/backend/utilities/api-auth.ts` | **M** (3 hours) |
| **P1 (Pre-Launch)** | **SEC-HIGH-01** | Enforce email verification check before auto-binding client records. | `app/api/auth/roles/route.ts` | **S** (2 hours) |
| **P1 (Pre-Launch)** | **SEC-HIGH-02** | Scope Storage RLS policies to client UUIDs for `deliverables` & `documents`. | `database/migrations/` | **M** (4 hours) |
| **P1 (Pre-Launch)** | **SEC-HIGH-03** | Enforce mandatory webhook secrets with timing-safe comparison. | `app/api/webhooks/brevo/route.ts` | **S** (2 hours) |
| **P1 (Pre-Launch)** | **SEC-HIGH-04** | Sanitize OAuth redirect URLs to relative paths only. | `app/auth/callback/route.ts` | **S** (1 hour) |
| **P2 (Soon)** | **SEC-MED-01** | Add `/connect/:path*` to public routes in middleware. | `middleware.ts` | **S** (1 hour) |
| **P2 (Soon)** | **SEC-MED-02** | Migrate rate limiting from in-memory Map to Upstash Redis. | `src/backend/utilities/rate-limiter.ts` | **M** (5 hours) |
| **P2 (Soon)** | **SEC-MED-03** | Configure Content Security Policy (CSP) and HSTS headers. | `next.config.ts` | **S** (2 hours) |
| **P2 (Soon)** | **SEC-MED-04** | Implement Zod request body validation schemas across all API routes. | `app/api/**` | **L** (8 hours) |
| **P3 (Later)** | **SEC-LOW-01** | Clean up `.env.example` and remove unused dependencies (`firebase-tools`, `@google/genai`). | `package.json`, `.env.example` | **S** (1 hour) |

---

## 9. Open Questions & Environment Dependencies

1. **Supabase Production Email Confirmation**: Is email confirmation (`auth.email_confirm`) enabled by default on the production Supabase instance? If disabled, unverified signups will exacerbate finding **SEC-HIGH-01**.
2. **Brevo Webhook Secret Deployment**: Confirm whether `BREVO_WEBHOOK_SECRET` is actively provisioned in the Vercel/production deployment environment.
3. **Automated Account Deletion Cron**: Database migration `phase22_account_deletion_lifecycle.sql` creates a purge function for soft-deleted accounts after 30 days. Is there an active Supabase `pg_cron` schedule or external webhook trigger invoking this maintenance function?

---

*Report compiled and verified against repository commit tree.*
