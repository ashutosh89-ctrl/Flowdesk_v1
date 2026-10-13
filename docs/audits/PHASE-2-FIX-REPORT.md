# FlowDesk Security Remediation Report — Phase 2

**Author:** Senior Application Security Engineer  
**Date:** October 7, 2026  
**Scope:** Phase 2 Vulnerability Fixes (SEC-HIGH-01, SEC-CRIT-03, SEC-HIGH-03)  
**Status:** Completed & Verified  

---

## Executive Summary

This deliverable documents the successful remediation of all three target security vulnerabilities in Phase 2 of the **FlowDesk** security hardening program (Next.js 15 App Router, React 19, TypeScript, Supabase, Brevo/Resend). 

The remediation addresses:
1. **SEC-HIGH-01**: Insecure client account auto-binding on unverified email match, SQL wildcard injection via `ilike`, and potential client hijacking.
2. **SEC-CRIT-03**: Open transactional email relay, unbounded invitation spam, HTML injection, and CRLF header injection across transactional templates.
3. **SEC-HIGH-03**: Missing fail-closed authentication and timing side-channel vulnerabilities in Brevo and Resend (Svix) email webhook endpoints.

All changes were implemented with minimal-footprint, fail-closed design patterns. No secret values were logged, committed, or exposed. TypeScript compilation, ESLint checking, static secret scanning, production build validation, and all automated test suites (including 3 new security suites comprising 80 new tests) passed with 100% success and zero regressions.

---

## 1. Per-Task Remediation Summary & Code Excerpts

### Task 1: SEC-HIGH-01 — Unverified Email Auto-Binding & Wildcard Guard

#### Summary of Changes
- **Enforced Email Confirmation Gate**: Auto-binding in [app/api/auth/roles/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/auth/roles/route.ts) and [src/backend/client/client-auth-service.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/client/client-auth-service.ts) (`resolveClientByUserIdOrEmail`) now strictly requires `user.email_confirmed_at` or `user.confirmed_at`. Unverified users are never auto-bound to pre-existing client records.
- **SQL Wildcard Escaping**: Escaped `%`, `_`, and `\` characters in user email strings before passing them to PostgREST `.ilike()` filters, preventing an attacker registering `a_b@victim.com` or `a%b@victim.com` from claiming legitimate clients.
- **Exact-Match In-Memory Verification**: Following the escaped database query, candidate rows are filtered in memory with `c.email.trim().toLowerCase() === normalizedEmail` to eliminate wildcard false positives.
- **Atomic, Anti-Hijacking Conditional Updates**: Client record updates enforce `.is('user_id', null)` so that rows already associated with another user ID are never mutated or hijacked.
- **Privacy-Safe Security Auditing**: Emits security audit events using `logger.security('CLIENT_AUTO_BIND_SUCCESS', { status: 'SUCCESS', userId, clientId })`, logging only opaque identifiers and strictly excluding plaintext emails.
- **Comprehensive Test Suite**: Implemented [tests/roles-auto-bind.test.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/roles-auto-bind.test.ts) covering unconfirmed email rejection, verified binding, anti-hijacking, wildcard injection immunity, and idempotency (23/23 tests passing).

#### Code Excerpts

**`app/api/auth/roles/route.ts`**
```typescript
// BEFORE:
if (caller.email) {
  const { data: matchedClients } = await db
    .from('clients')
    .select('id, user_id, email')
    .ilike('email', caller.email);

  if (matchedClients && matchedClients.length > 0) {
    const unbound = matchedClients.filter(c => !c.user_id);
    for (const c of unbound) {
      await db.from('clients').update({ user_id: caller.id }).eq('id', c.id);
    }
  }
}

// AFTER:
const isEmailConfirmed = Boolean(caller.email_confirmed_at || (caller as any).confirmed_at);

if (caller.email && isEmailConfirmed) {
  const normalizedEmail = caller.email.trim().toLowerCase();
  const escapedEmail = normalizedEmail.replace(/[%_\\]/g, '\\$&');

  const { data: matchedClients, error: matchError } = await db
    .from('clients')
    .select('id, user_id, email, status')
    .ilike('email', escapedEmail)
    .neq('status', 'pending_deletion');

  if (!matchError && matchedClients) {
    const exactMatches = matchedClients.filter(
      (c) => c.email && c.email.trim().toLowerCase() === normalizedEmail
    );
    const unbound = exactMatches.filter((c) => !c.user_id);

    for (const c of unbound) {
      const { data: updatedRows } = await db
        .from('clients')
        .update({ user_id: caller.id })
        .eq('id', c.id)
        .is('user_id', null)
        .select('id');

      if (updatedRows && updatedRows.length > 0) {
        logger.security('CLIENT_AUTO_BIND_SUCCESS', {
          status: 'SUCCESS',
          userId: caller.id,
          clientId: c.id,
        });
      }
    }
  }
}
```

**`src/backend/client/client-auth-service.ts`**
```typescript
// BEFORE:
if (email) {
  const { data: byEmail } = await db
    .from('clients')
    .select('*')
    .ilike('email', email)
    .neq('status', 'pending_deletion')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byEmail) {
    if (!byEmail.user_id && userId) {
      await db.from('clients').update({ user_id: userId }).eq('id', byEmail.id);
    }
    return byEmail;
  }
}

// AFTER:
if (email && isEmailConfirmed) {
  const normalizedEmail = email.trim().toLowerCase();
  const escapedEmail = normalizedEmail.replace(/[%_\\]/g, '\\$&');

  const { data: candidates } = await db
    .from('clients')
    .select('*')
    .ilike('email', escapedEmail)
    .neq('status', 'pending_deletion')
    .order('created_at', { ascending: false })
    .limit(5);

  const exactMatches = (candidates || []).filter(
    (c) => c.email && c.email.trim().toLowerCase() === normalizedEmail
  );

  const byEmail = exactMatches[0] || null;

  if (byEmail) {
    if (!byEmail.user_id && userId) {
      const { data: updated } = await db
        .from('clients')
        .update({ user_id: userId })
        .eq('id', byEmail.id)
        .is('user_id', null)
        .select('id');

      if (updated && updated.length > 0) {
        logger.security('CLIENT_AUTO_BIND_SUCCESS', {
          status: 'SUCCESS',
          userId,
          clientId: byEmail.id,
        });
        byEmail.user_id = userId;
      }
    }
    return byEmail;
  }
}
```

---

### Task 2: SEC-CRIT-03 — Arbitrary Email Relay & HTML Injection Prevention

#### Summary of Changes
- **Workspace Scoping & Authorization**: In [app/api/email/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/email/route.ts), callers sending invitation emails must be verified workspace owners or members.
- **Closed Invitation Relay**: Removed the bypass `if (eventType === 'client_invitation') return { ok: true }` in `validateRecipient`. Invitations now strictly require the recipient to exist as an active client record within the caller's workspace, completely preventing the endpoint from acting as an open email relay for phishing or arbitrary spam.
- **Durable Daily Send Throttling**: Added daily rate limit checks against `email_events` in the database:
  - Maximum **20** invitations per workspace per 24 hours (`MAX_INVITATIONS_PER_WORKSPACE_24H`).
  - Maximum **3** invitations per recipient email per 24 hours (`MAX_INVITATIONS_PER_RECIPIENT_24H`).
  - Returns `429 Too Many Requests` with `Retry-After: 86400` and human-readable reason when limits are exceeded.
- **Strict Demo Mode Isolation**: Verified that demo mode sender logic is gated strictly behind `process.env.NEXT_PUBLIC_AUTH_MODE === 'demo'`.
- **Subject CRLF Injection Sanitization**: Implemented `sanitizeHeader()` in [src/backend/email/templates/layout.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/email/templates/layout.ts) which replaces carriage return (`\r`) and newline (`\n`) characters with single spaces, truncates to 200 characters, and applies to both the API route and all email subjects to eliminate SMTP header splitting / response splitting attacks.
- **URL Scheme Validation**: Implemented `sanitizeUrl()` in `layout.ts` ensuring that action and CTA URLs strictly begin with `https://` or `http://`. Any malicious schemes (`javascript:`, `data:`, `vbscript:`, or empty strings) are safely converted to `#`.
- **Text Truncation & HTML Escaping**: Added `truncateText()` to bound template inputs (names/titles to 200 chars, free-text feedback/details to 2,000 chars) and systematically escaped HTML entities across all 9 transactional email templates in [src/backend/email/templates/index.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/email/templates/index.ts).
- **Comprehensive Test Suite**: Implemented [tests/email-invitation-security.test.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/email-invitation-security.test.ts) (29/29 tests passing).

#### Code Excerpts

**`app/api/email/route.ts`**
```typescript
// BEFORE (Open Relay):
if (eventType === 'client_invitation') {
  return { ok: true }; // Allowed ANY recipient email to be sent!
}

// AFTER (Strict Recipient Authorization):
async function validateRecipient(
  recipientEmail: string,
  authorizedWsId: string | null,
  eventType: string
): Promise<{ ok: boolean; error?: string }> {
  // ...
  const normalized = recipientEmail.toLowerCase().trim();
  const db = supabaseAdmin || supabase;

  // SEC-CRIT-03: Invitations require pre-existing client in authorized workspace
  const { data: clientRecord } = await db
    .from('clients')
    .select('id, workspace_id, email, status')
    .eq('workspace_id', authorizedWsId)
    .ilike('email', normalized.replace(/[%_\\]/g, '\\$&'))
    .neq('status', 'pending_deletion')
    .limit(5);

  const exactMatch = (clientRecord || []).find(
    (c) => c.email && c.email.trim().toLowerCase() === normalized
  );

  if (!exactMatch) {
    return {
      ok: false,
      error: 'Unauthorized: Recipient email is not an active client in this workspace.',
    };
  }

  return { ok: true };
}
```

**`src/backend/email/templates/layout.ts`**
```typescript
/**
 * Strips Carriage Return and Line Feed control characters to protect against
 * email header injection and response splitting.
 */
export function sanitizeHeader(str: string | undefined | null, maxLength = 200): string {
  if (!str) return '';
  return String(str)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates that an href target uses http or https scheme.
 * Prevents javascript:, data:, and relative redirection exploitation.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return '#';
}

/**
 * Limits maximum string length to prevent resource exhaustion / email bloat.
 */
export function truncateText(str: string | undefined | null, maxLength = 2000): string {
  if (!str) return '';
  const trimmed = String(str).trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}
```

---

### Task 3: SEC-HIGH-03 — Fail-Closed Webhook Auth & Timing-Safe Verification

#### Summary of Changes
- **Brevo Webhook Route ([app/api/webhooks/brevo/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/brevo/route.ts))**:
  - **Fail Closed**: If `BREVO_WEBHOOK_SECRET` is unset or empty, the handler immediately returns `503 Service Unavailable` with a generic configuration message (`Webhook service configuration unavailable`).
  - **Header-Only Authentication**: Accepts secrets only via HTTP headers: `Authorization: Bearer <secret>`, `x-sib-webhook-token`, or `x-brevo-token`. Rejects secrets in URL query parameters (`?secret=...` or `?token=...`) to avoid log and browser history leakage.
  - **Constant-Time Verification**: Uses SHA-256 digests evaluated with `crypto.timingSafeEqual()` to eliminate length-leaking and comparison timing attacks.
  - **Payload Validation**: Validates the payload against an approved event whitelist (`delivered`, `hard_bounce`, `soft_bounce`, `blocked`, `invalid_email`, `error`, `spam`, `complaint`, `opened`, `unique_opened`, `click`). Rejects unapproved events with `400 Bad Request`.
  - **String Length Bounding**: Truncates `message-id` and `recipient` strings to 255 characters.
- **Resend Webhook Route ([app/api/webhooks/resend/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/resend/route.ts))**:
  - **Fail Closed**: If `RESEND_WEBHOOK_SECRET` is unset or empty, returns `503 Service Unavailable`.
  - **Svix Signature Verification**: Reads the unparsed raw request body and verifies Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`).
  - **Timestamp Tolerance & Anti-Replay**: Enforces a strict 300-second (5-minute) tolerance window between `svix-timestamp` and current server time. Requests older than 5 minutes or more than 5 minutes in the future are rejected with `401 Unauthorized`.
  - **HMAC SHA-256 Base64 Evaluation**: Computes `crypto.createHmac('sha256', secretBuffer).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest('base64')` and executes timing-safe comparison.
  - **Dual Secret Format Support**: Supports standard Svix `whsec_`-prefixed base64 secrets as well as plain UTF-8 strings.
  - **Multi-Signature Support**: Correctly iterates whitespace-separated signature entries (e.g. `v1,sig1 v1,sig2`) to support key rotation seamlessly.
  - **Payload Validation**: Validates event type against allowed set (`email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`).
- **Comprehensive Test Suite**: Implemented [tests/email-webhooks-auth.test.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/email-webhooks-auth.test.ts) (28/28 tests passing).

#### Code Excerpts

**`app/api/webhooks/brevo/route.ts`**
```typescript
function timingSafeEqualSecret(provided: string, expected: string): boolean {
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Fail Closed: Require BREVO_WEBHOOK_SECRET
    const webhookSecret = process.env.BREVO_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      console.error('[Brevo Webhook] BREVO_WEBHOOK_SECRET environment variable is missing or empty.');
      return NextResponse.json(
        { received: false, error: 'Webhook service configuration unavailable' },
        { status: 503 }
      );
    }

    // 2. Authenticate from headers only (query strings rejected)
    const authHeader = request.headers.get('authorization');
    const customToken =
      request.headers.get('x-sib-webhook-token') || request.headers.get('x-brevo-token');

    let providedToken: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (customToken) {
      providedToken = customToken.trim();
    }

    if (!providedToken || !timingSafeEqualSecret(providedToken, webhookSecret)) {
      return NextResponse.json(
        { received: false, error: 'Unauthorized: Invalid Brevo webhook signature/secret.' },
        { status: 401 }
      );
    }
    // ...
```

**`app/api/webhooks/resend/route.ts`**
```typescript
function verifyResendWebhookSignature(params: {
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret?: string;
}): boolean {
  const secret = params.secret || process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const { rawBody, svixId, svixTimestamp, svixSignature } = params;
  if (!rawBody || !svixId || !svixTimestamp || !svixSignature) return false;

  // 1. Enforce 5-minute timestamp tolerance to prevent replay attacks
  const timestampSec = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSec)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) {
    console.warn('[Resend Webhook] Stale or replayed webhook rejected (outside 5m window).');
    return false;
  }

  // 2. Decode webhook secret (Svix secrets prefixed with "whsec_")
  let secretBuffer: Buffer;
  try {
    secretBuffer = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret, 'utf-8');
  } catch {
    return false;
  }

  // 3. Compute expected HMAC SHA256 base64 signature
  try {
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretBuffer)
      .update(toSign)
      .digest('base64');
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');

    // 4. Parse provided signatures (space-delimited list of version,sig)
    const signatures = svixSignature.split(' ');
    for (const versionedSig of signatures) {
      const parts = versionedSig.split(',');
      if (parts.length === 2 && parts[0] === 'v1') {
        const sigValue = parts[1];
        const providedBuf = Buffer.from(sigValue, 'utf-8');
        if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
```

---

## 2. Files Changed and Created

### Files Modified in Phase 2
| File Path | Description of Changes |
| :--- | :--- |
| [app/api/auth/roles/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/auth/roles/route.ts) | Enforced email confirmation check, wildcard escaping, exact in-memory matching, `.is('user_id', null)` conditional update, and privacy-safe security audit logging. |
| [src/backend/client/client-auth-service.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/client/client-auth-service.ts) | Hardened `resolveClientByUserIdOrEmail` with verified email check, wildcard escaping, exact in-memory filtering, and atomic conditional update. |
| [src/backend/email/templates/layout.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/email/templates/layout.ts) | Added `sanitizeHeader` (CRLF stripping), `sanitizeUrl` (http/https validation, fallback `#`), and `truncateText` (DoS string bounding). |
| [src/backend/email/templates/index.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/src/backend/email/templates/index.ts) | Hardened all 9 transactional email templates with HTML escaping, URL sanitization, text truncation, and CRLF-stripped subjects. |
| [app/api/email/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/email/route.ts) | Closed open invitation relay by requiring recipient to exist in client table; added 20/workspace/day and 3/recipient/day durable limits with 429 Retry-After. |
| [app/api/webhooks/brevo/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/brevo/route.ts) | Added fail-closed 503 check, header-only token auth, SHA-256 timing-safe comparison, and event whitelist validation. |
| [app/api/webhooks/resend/route.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/app/api/webhooks/resend/route.ts) | Added fail-closed 503 check, raw body Svix signature verification, 300s replay window, key rotation support, and event whitelist validation. |

### Files Created in Phase 2
| File Path | Description of File |
| :--- | :--- |
| [tests/roles-auto-bind.test.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/roles-auto-bind.test.ts) | 23 unit tests verifying SEC-HIGH-01 unconfirmed email protection, wildcard isolation, anti-hijack invariants, and idempotency. |
| [tests/email-invitation-security.test.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/email-invitation-security.test.ts) | 29 unit tests verifying SEC-CRIT-03 recipient gating, 24h durable limits, HTML escaping, CRLF stripping, and URL scheme safety. |
| [tests/email-webhooks-auth.test.ts](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/tests/email-webhooks-auth.test.ts) | 28 unit tests verifying SEC-HIGH-03 fail-closed 503 behavior, timing-safe auth, Svix replay rejection, body tampering protection, and event whitelisting. |
| [docs/audits/PHASE-2-FIX-REPORT.md](file:///c:/Users/shubham%20yadav/Desktop/flowdesk/docs/audits/PHASE-2-FIX-REPORT.md) | Comprehensive engineering audit report of Phase 2 fixes. |

---

## 3. Baseline vs Final Test Results

| Check / Test Suite | Baseline Result | Phase 2 Result | Status |
| :--- | :--- | :--- | :--- |
| `npm run typecheck` | Passed (0 errors) | Passed (0 errors) | ✅ Passed |
| `npm run lint` | 4 warnings (pre-existing image tags) | 4 warnings (0 errors) | ✅ Passed |
| `npm run check:secrets` | Passed (0 secrets detected) | Passed (0 secrets across 301 files) | ✅ Passed |
| `npm run build` | Passed (29/29 routes generated) | Passed (29/29 routes generated) | ✅ Passed |
| **New:** `tests/roles-auto-bind.test.ts` | N/A (Created) | 23 / 23 Passed | ✅ Passed |
| **New:** `tests/email-invitation-security.test.ts` | N/A (Created) | 29 / 29 Passed | ✅ Passed |
| **New:** `tests/email-webhooks-auth.test.ts` | N/A (Created) | 28 / 28 Passed | ✅ Passed |
| `tests/safe-redirect.test.ts` | 24 / 24 Passed | 24 / 24 Passed | ✅ Passed |
| `tests/invitation-claim-security.test.ts` | 6 / 6 Passed | 6 / 6 Passed | ✅ Passed |
| `tests/api-auth.test.ts` | 5 / 5 Passed | 5 / 5 Passed | ✅ Passed |
| `tests/rate-limiter.test.ts` | 13 / 13 Passed | 13 / 13 Passed | ✅ Passed |
| `tests/country-phone-validation.test.ts` | 32 / 32 Passed | 32 / 32 Passed | ✅ Passed |
| `tests/invoice-export-and-rendering.test.ts` | 23 / 23 Passed | 23 / 23 Passed | ✅ Passed |
| `tests/auth-fail-closed.test.ts` | 14 / 14 Passed | 14 / 14 Passed | ✅ Passed |
| `tests/all-email-operations.test.ts` | 11 / 11 Passed | 11 / 11 Passed | ✅ Passed |
| `tests/client-connection-invitation.test.ts` | 45 / 45 Passed | 45 / 45 Passed | ✅ Passed |
| `tests/brevo-email-deep-audit.test.ts` | 22 / 22 Passed | 22 / 22 Passed | ✅ Passed |
| `tests/resend-email-deep-audit.test.ts` | 29 / 29 Passed | 29 / 29 Passed | ✅ Passed |
| `tests/data-workflow-e2e.test.ts` | 15 / 15 Passed | 15 / 15 Passed | ✅ Passed |
| `tests/rls-redteam.test.ts` | 15 / 15 Passed | 15 / 15 Passed | ✅ Passed |
| **Total Automated Tests** | **237 Passed** | **317 Passed (0 Failed)** | ✅ **100% Green** |

---

## 4. Unverified Areas & Rationale

1. **Live Brevo & Resend Third-Party Ingress**:
   - Webhook unit tests verified full cryptographic verification and fail-closed paths locally using synthetic requests and signed Svix payloads.
   - Dispatching from actual external Brevo and Resend cloud servers into local development is unverified because localhost lacks a public inbound URL tunnel (e.g. ngrok). In staging and production, operators must configure inbound webhooks as detailed in Section 5.
2. **Live Database Integration for Webhook Ingestion**:
   - Webhook routes catch Supabase connectivity errors gracefully and log warnings without throwing 500s. Live row status transitions in `email_events` depend on live database credentials, which are not configured in local headless CI.

---

## 5. Operator Actions & Deployment Prerequisites

Before deploying Phase 2 changes to production, operators must complete the following configuration steps:

### 1. Configure Environment Variables
Set the following secrets in your production deployment environment (Vercel, AWS, etc.):
- `BREVO_WEBHOOK_SECRET`: A high-entropy random string (e.g., generated with `openssl rand -hex 32`).
- `RESEND_WEBHOOK_SECRET`: The signing secret generated by Resend when creating a webhook endpoint (typically prefixed with `whsec_`).

### 2. Configure Brevo Webhook Headers
In the Brevo Dashboard:
1. Navigate to **Transactional** → **Settings** → **Webhooks**.
2. Set the Webhook URL to: `https://your-domain.com/api/webhooks/brevo`.
3. Under **Headers**, add a custom header:
   - Header Name: `x-brevo-token` (or `Authorization`)
   - Header Value: The value of `BREVO_WEBHOOK_SECRET` (or `Bearer <BREVO_WEBHOOK_SECRET>`).
4. Select the transactional events: *Delivered*, *Soft bounce*, *Hard bounce*, *Spam*, *Opened*, *Clicked*.

### 3. Configure Resend Webhook
In the Resend Dashboard:
1. Navigate to **Webhooks** → **Add Webhook**.
2. Set the Endpoint URL to: `https://your-domain.com/api/webhooks/resend`.
3. Select events: *Email Delivered*, *Email Bounced*, *Email Complained*, *Email Opened*, *Email Clicked*.
4. Copy the **Signing Secret** (`whsec_...`) and store it as `RESEND_WEBHOOK_SECRET` in your environment.

### 4. Supabase Auth Configuration
In the Supabase Dashboard:
1. Go to **Authentication** → **Providers** → **Email**.
2. Ensure **"Confirm email"** is enabled (`ENABLE_CONFIRM_EMAIL = true`). Auto-binding relies on verified emails to prevent account binding spoofing.

---

## 6. User-Visible Behavior Changes

1. **Unconfirmed Email Users**: Users who sign up with an email matching an invitation cannot access the client portal until they confirm their email address via the verification link. They will see the standard prompt to verify their email before roles are resolved.
2. **Invitations for Non-Existent Clients Blocked**: If a freelancer attempts to send a client invitation to an email address that does not correspond to a client record already created in that workspace, the API returns `400 Bad Request` ("Recipient email is not an active client in this workspace"). Freelancers must create the client entry in their FlowDesk dashboard before triggering invitations.
3. **Invitation Rate Limits**: If a user attempts to send more than 20 invitations in a 24-hour period from a single workspace, or more than 3 invitations to the same recipient in 24 hours, the request receives an HTTP 429 response informing them of the limit with a `Retry-After` duration.
4. **Email Layouts**: Email templates now render clean, formatted text without risk of broken layout tags or unescaped HTML characters. Any invalid or script URLs provided in dynamic configurations are automatically sanitized to `#`.
