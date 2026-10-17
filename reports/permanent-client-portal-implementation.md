# FLOWDESK PERMANENT CLIENT PORTAL LINK & MULTI-FREELANCER ARCHITECTURE REPORT

## Executive Summary

This report documents the architectural diagnosis, database redesign, implementation, and verification of FlowDesk's **Permanent Freelancer Portal Link & Multi-Freelancer Connection System**.

Previously, client portal links were broken due to routing mismatches, hardcoded external domains, single-record query assumptions in client authentication, and blanket Next.js middleware interception. Furthermore, a single client user could not connect to multiple freelancers without data conflicts.

This implementation provides:
1. **Permanent, High-Entropy Portal Links:** Every freelancer has one stable link (`/portal/join/fd_[slug]`) tied to their workspace.
2. **Safe Public Discovery:** Unauthenticated visitors see public freelancer/studio metadata without leaking internal UUIDs, database keys, or client data.
3. **Multi-Freelancer Support:** One client account (`client@example.com`) can connect to unlimited independent freelancer studios with isolated projects, invoices, and deliverables.
4. **Interactive Workspace Switcher:** An integrated client portal header dropdown allowing instantaneous workspace switching.
5. **Zero-Trust Multi-Tenant RLS:** Strict row-level security ensuring Freelancer A never sees Freelancer B's clients, and clients only access records explicitly belonging to their active workspace connection.

---

## 1. Root Cause Analysis: Why Previous Portal Links Failed

Auditing the codebase revealed 5 distinct points of failure in the prior implementation:

1. **Routing & Parameter Mismatch in `client-workspace-shell.tsx`:**
   - The "Copy Portal Link" action generated links formatted as `https://flowdesk.app/portal/${client.portalToken}` where `portalToken` was a per-client token.
   - However, the App Router route at `app/portal/[clientId]/page.tsx` directly extracted `params.clientId` and queried the database with `.eq('id', clientId)`. Because `portalToken` is a random string and not the client UUID primary key, the lookup failed with 404 / record not found.
2. **Hardcoded Domain Name:**
   - Portal links hardcoded `https://flowdesk.app`, failing immediately in local development, staging environments, custom domains, or Vercel preview deployments.
3. **Middleware Interception Blocking Public Entry:**
   - In `middleware.ts`, the route matcher executed `path.startsWith('/portal')` as a strictly protected route.
   - When an unauthenticated client or new prospect clicked a shared freelancer link (`/portal/join/...`), the middleware redirected them immediately to `/client/login`, stripping the context and dropping the prospect before they could view the freelancer's profile.
4. **Single-Client-Per-User Database Assumption:**
   - In `ClientAuthService.resolveClientByUserIdOrEmail`, the query used `.eq('user_id', userId).maybeSingle()`.
   - In PostgreSQL / PostgREST, `.maybeSingle()` throws an HTTP 406 runtime exception if more than one row matches the filter. As soon as a client registered with two different freelancers, this query crashed, locking the user out of the portal entirely.
5. **Lack of Freelancer-Level Permanent Identifier:**
   - There was no entity representing a permanent, shareable portal link for a freelancer's workspace. Links were transient or per-client invitation tokens that expired after single use.

---

## 2. Database Relationship Design & Migrations

### A. Logical Entity Model

```
                    ┌─────────────────────────┐
                    │       auth.users        │
                    │   (Freelancers & Clients)│
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────┐                           ┌──────────────────┐
│    workspaces    │                           │  client_users    │
│  (Freelancer A)  │                           │(Global Client ID)│
│  portal_slug     │                           └─────────┬────────┘
│  is_accepting    │                                     │
└────────┬─────────┘                                     │
         │                                               │
         │       ┌──────────────────────────────┐        │
         └──────►│      client_connections      │◄───────┘
                 │ (workspace_id, client_user_id)│
                 │   UNIQUE COMPOSITE KEY       │
                 │   status, connected_at       │
                 └──────────────┬───────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │           clients            │
                 │ (Freelancer-scoped client row)│
                 │  workspace_id, name, currency│
                 └──────────────────────────────┘
```

### B. Schema Changes (`20261015000010_permanent_portal_link.sql`)

1. **`public.workspaces` Modifications:**
   - Added column `portal_slug TEXT UNIQUE NOT NULL`.
   - Added column `is_accepting_connections BOOLEAN NOT NULL DEFAULT true`.
   - Created trigger `trg_workspace_portal_slug` that automatically provisions a high-entropy slug prefixed with `fd_` (16 hexadecimal characters, ~64 bits of entropy) upon workspace creation.
2. **`public.client_connections` Table:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE`
   - `freelancer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL`
   - `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'paused'))`
   - `connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `CONSTRAINT uq_client_workspace_connection UNIQUE (client_user_id, workspace_id)`
3. **Database Stored Procedures (Atomic RPCs):**
   - `resolve_freelancer_portal(p_slug TEXT)`: `SECURITY DEFINER` function that returns strictly public sanitized metadata (`freelancer_name`, `studio_name`, `avatar_url`, `currency`, `is_accepting_connections`).
   - `connect_client_to_workspace(p_slug TEXT)`: Atomic, idempotent connection RPC. Validates caller `auth.uid()`, locks workspace row, checks `is_accepting_connections`, prevents self-connection, reuses or creates the freelancer's client row, and upserts `client_connections`.

---

## 3. Row-Level Security (RLS) & Multi-Tenant Isolation

### Policy Enforcement Matrix

| Table | Operation | Role | Policy Rule | Enforced Isolation |
|---|---|---|---|---|
| `workspaces` | `SELECT` | Public / Anon | `is_accepting_connections = true` (via RPC) | Only public display attributes returned. |
| `workspaces` | `UPDATE` | Freelancer | `owner_id = auth.uid()` | Only owner can toggle connection acceptance or edit slug. |
| `client_connections` | `SELECT` | Client | `client_user_id = auth.uid()` | Clients see only their connected studios. |
| `client_connections` | `SELECT` | Freelancer | `freelancer_user_id = auth.uid()` | Freelancers see only their connected clients. |
| `clients` | `SELECT` | Client | `id IN (SELECT client_id FROM client_connections WHERE client_user_id = auth.uid())` | Client cannot read records belonging to other clients or unrelated freelancers. |
| `invoices`, `projects`, `deliverables`, `documents` | `SELECT` | Client | `client_id IN (SELECT client_id FROM client_connections WHERE client_user_id = auth.uid())` | Data displayed in client portal is strictly scoped to the active workspace. |

---

## 4. Architectural Implementation & Files Changed

### Backend Services & Types
- **`src/shared/types/index.ts`:** Added `PermanentPortalDetails`, `PermanentPortalConnectResult`, and `ConnectedFreelancerWorkspace` interfaces.
- **`src/backend/utilities/workspace.ts`:** Updated `Workspace` type with `portalSlug` and `isAcceptingConnections`; added `updateWorkspacePortalSettings()` with cache invalidation.
- **`src/backend/portal/permanent-portal-service.ts`:** Comprehensive service covering public resolution, connection status checks, idempotent connections, multi-workspace fetching, and freelancer settings.
- **`src/backend/client/client-auth-service.ts`:** Refactored client identity resolution to handle multiple client records per authenticated user.

### API Routes
- **`app/api/portal/resolve/route.ts`:** Public, rate-limited endpoint resolving slug to public display metadata.
- **`app/api/portal/status/route.ts`:** Authenticated endpoint checking whether the caller is already connected or owns the workspace.
- **`app/api/portal/connect/route.ts`:** Authenticated, CSRF-safe endpoint executing atomic idempotent connection.
- **`app/api/portal/workspaces/route.ts`:** Fetches all authorized studios for the authenticated client.
- **`app/api/portal/settings/route.ts`:** Retrieves and updates freelancer portal settings (copy link, toggle acceptance).

### Frontend Components & Pages
- **`middleware.ts`:** Excluded `/portal/join/:path*` from mandatory authentication redirect so visitors can access the public card.
- **`app/portal/join/[slug]/page.tsx`:** Complete responsive connection landing page:
  - Displays public freelancer avatar, studio name, profession, and badge.
  - Sign in / Register buttons with safe `returnUrl` preservation.
  - Explicit "Confirm Connection" action for authenticated users.
  - Already-connected state with instant "Open Workspace" button.
  - Self-connection detection preventing freelancers from connecting to themselves.
- **`src/frontend/client/portal/client-workspace-switcher.tsx`:** Dynamic dropdown in client portal header allowing clients to switch between connected freelancers with zero page reloads or stale cache issues.
- **`src/frontend/client/auth/client-auth-context.tsx`:** Provides `workspaces`, `activeWorkspace`, and `switchWorkspace` globally to client views.
- **`src/frontend/freelancer/settings/portal-settings-panel.tsx`:** Added "Client Portal" tab in freelancer Settings with one-click "Copy Link", acceptance toggle, and client count badge.

---

## 5. Automated Test Suite & Verification Results

### Test Execution (`tests/permanent-portal-link.test.ts`)
Run command: `npx tsx tests/permanent-portal-link.test.ts`

| Test Case | Category | Status | Verified Invariant |
|---|---|---|---|
| A1. Permanent portal slug format | Slug Stability | ✅ PASS | Matches regex `^[a-zA-Z0-9_-]{3,64}$` with `fd_` prefix |
| A2. Resolving valid portal slug | Public Resolution | ✅ PASS | Returns freelancer name, studio, avatar, profession, currency |
| A3. Public resolution privacy | Zero-Leakage | ✅ PASS | Strips workspace UUID, owner_id, emails, service keys, and client list |
| A4. Injection attempt rejection | Security | ✅ PASS | PostgREST filter injection, path traversal, script tags safely rejected |
| B5. Unauthenticated connect check | Authentication Gate | ✅ PASS | Returns HTTP 401 / error without active session |
| B6. Authenticated client connect | Connection Flow | ✅ PASS | Returns valid clientId, workspaceId, studioName |
| B7. Idempotency on repeated clicks | Data Integrity | ✅ PASS | Returns same clientId; zero duplicate connection records created |
| B8. Workspace owner self-connection | Business Rules | ✅ PASS | Correctly identifies workspace owner and blocks self-connection |
| B9. Safe return URL destination | Navigation Safety | ✅ PASS | Preserves join link while sanitizing open redirect attacks |
| C10. Multi-freelancer resolution | Multi-Tenant | ✅ PASS | Single client account resolves all authorized studio workspaces |
| C11. Workspace independence | Data Scoping | ✅ PASS | Distinct workspace IDs, distinct client IDs, and independent currencies |
| C12. Context switcher switching | Switcher State | ✅ PASS | Active context transitions cleanly to target workspace client ID |
| D13. Freelancer settings retrieval | Freelancer UX | ✅ PASS | Resolves stable link using active environment origin |
| D14. Toggle connection acceptance | Control Toggle | ✅ PASS | Toggles `is_accepting_connections` on and off cleanly |
| D15. Slug validation & protection | Input Sanitization | ✅ PASS | Custom slug updates reject spaces, semicolons, and special characters |

**Total Suite Result:** 15/15 Passed (100% Pass Rate).
**Payment & Invoicing Suite Result:** 48/48 Passed (100% Pass Rate).
**TypeScript Static Analysis:** 0 Errors (`tsc --noEmit` exited code 0).

---

## 6. Steps to Apply Migrations to Remote Supabase

To deploy this migration to your live Supabase instance:

1. **Option A: Supabase CLI (Recommended)**
   ```bash
   npx supabase db push
   ```
2. **Option B: Supabase Dashboard SQL Editor**
   - Open your project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
   - Navigate to **SQL Editor** -> **New Query**.
   - Paste the contents of `supabase/migrations/20261015000010_permanent_portal_link.sql`.
   - Click **Run**.
3. **Verification Query:**
   ```sql
   SELECT id, name, portal_slug, is_accepting_connections FROM public.workspaces LIMIT 5;
   ```
   All existing and future workspaces will have unique `portal_slug` entries populated.
