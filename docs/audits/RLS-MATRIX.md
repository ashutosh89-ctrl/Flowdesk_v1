# FlowDesk Row-Level Security (RLS) Policy Matrix & Audit

**Audit Date**: October 2026  
**Status**: Comprehensive Baseline & Hardened  
**Scope**: All PostgreSQL tables in `public` schema and Supabase `storage.objects` buckets.

---

## 1. Executive Summary

FlowDesk employs a multi-tenant dual-role security architecture:
1. **Freelancer (Workspace Owner)**: Authenticated via Supabase Auth (`auth.uid()`), owns one or more workspaces (`workspaces.owner_id = auth.uid()`). Holds full administrative control over all workspace resources.
2. **Client**: Authenticated via Supabase Auth (`auth.uid() = clients.user_id`) or historical portal sessions. Access is strictly scoped to records linked to their resolved client ID via `public.get_auth_client_ids()`.
3. **Public / Anon**: Anonymous or unauthenticated visitors. Denied across all business tables by default; allowed read-only access to explicitly public storage assets (e.g. logos, avatars) and public invitation verification via `SECURITY DEFINER` RPC.
4. **Service Role / Admin**: Background cron routes, webhook ingress, and administrative jobs operate via `process.env.SUPABASE_SERVICE_ROLE_KEY` which safely bypasses RLS while bound to server-side authentication (`CRON_SECRET`, webhook HMAC signatures).

---

## 2. Comprehensive Table RLS Matrix

| Table Name | RLS Status | Operation | Role | Policy Name & Scope Rule | Evaluation / Risk Rating |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **`profiles`** | **ENABLED** | SELECT | Authenticated | `Users can select own profile`: `auth.uid() = id`<br>`Clients can view workspace owner profile`: `id IN (ws.owner_id)` | **SECURE** |
| | | INSERT | Authenticated | `Users can insert own profile`: `auth.uid() = id` | **SECURE** |
| | | UPDATE | Authenticated | `Users can update own profile`: `auth.uid() = id` | **SECURE** |
| | | DELETE | Authenticated | None (Default Deny; account purge handled via service role) | **SECURE** |
| **`workspaces`** | **ENABLED** | ALL | Authenticated | `Users have full access to own workspaces`: `auth.uid() = owner_id` | **SECURE** |
| | | SELECT | Authenticated | `Clients can view assigned workspace`: `id IN (SELECT workspace_id FROM clients WHERE id IN get_auth_client_ids())` | **SECURE** (Hardened in Phase 35) |
| **`user_settings`** | **ENABLED** | ALL | Authenticated | `Users can [select/insert/update/delete] own settings`: `auth.uid() = id` | **SECURE** |
| **`clients`** | **ENABLED** | ALL | Authenticated | `Freelancer manage own workspace clients`: `is_workspace_owner(workspace_id)` | **SECURE** |
| | | SELECT | Authenticated | `Clients can view own client profile`: `id IN get_auth_client_ids()` | **SECURE** |
| **`projects`** | **ENABLED** | ALL | Authenticated | `Freelancer manage workspace projects`: `is_workspace_owner(workspace_id)` | **SECURE** |
| | | SELECT | Authenticated | `Clients can view assigned projects`: `client_id IN get_auth_client_ids()` | **SECURE** |
| **`deliverables`** | **ENABLED** | ALL | Authenticated | `Freelancer manage workspace deliverables`: `is_workspace_owner(workspace_id)` | **SECURE** |
| | | SELECT | Authenticated | `Clients can view assigned deliverables`: `client_id IN get_auth_client_ids()` | **SECURE** |
| | | UPDATE | Authenticated | Client approval/rejection restricted to server-mediated API routes | **SECURE** |
| **`deliverable_versions`** | **ENABLED** | ALL | Authenticated | `freelancer_[select/insert/update/delete]_deliverable_versions`: Workspace owner | **SECURE** |
| | | SELECT | Authenticated | `client_select_deliverable_versions`: `deliverable.client_id IN get_auth_client_ids()` | **SECURE** |
| **`deliverable_files`** | **ENABLED** | ALL | Authenticated | `freelancer_[select/insert/update/delete]_deliverable_files`: Workspace owner | **SECURE** |
| | | SELECT | Authenticated | `client_select_deliverable_files`: `deliverable.client_id IN get_auth_client_ids()` | **SECURE** |
| **`deliverable_comments`**| **ENABLED** | ALL | Authenticated | `freelancer_[select/insert/update/delete]_deliverable_comments`: Workspace owner | **SECURE** |
| | | SELECT | Authenticated | `client_select_deliverable_comments`: `client_id IN get_auth_client_ids() AND is_internal = false` | **SECURE** (Internal comments protected) |
| | | INSERT | Authenticated | `client_insert_deliverable_comments`: `client_id IN get_auth_client_ids() AND is_internal = false` | **SECURE** |
| **`documents`** | **ENABLED** | ALL | Authenticated | `Freelancer manage workspace documents`: `is_workspace_owner(workspace_id)` | **SECURE** |
| | | SELECT | Authenticated | `Clients view assigned documents`: `client_id IN get_auth_client_ids() AND is_internal = false` | **SECURE** |
| | | INSERT | Authenticated | `Clients upload assigned documents`: `client_id IN get_auth_client_ids() AND is_internal = false` | **SECURE** |
| **`invoices`** | **ENABLED** | ALL | Authenticated | `Freelancer manage workspace invoices`: `is_workspace_owner(workspace_id)` | **SECURE** |
| | | SELECT | Authenticated | `Clients view assigned invoices`: `client_id IN get_auth_client_ids()` | **SECURE** |
| **`invoice_items`** | **ENABLED** | ALL | Authenticated | `freelancer_[select/insert/update/delete]_invoice_items`: Workspace owner | **SECURE** |
| | | SELECT | Authenticated | `client_select_invoice_items`: `invoice.client_id IN get_auth_client_ids()` | **SECURE** |
| **`invoice_payments`** | **ENABLED** | ALL | Authenticated | `freelancer_[select/insert/update]_invoice_payments`: Workspace owner | **SECURE** |
| | | SELECT | Authenticated | `client_select_invoice_payments`: `invoice.client_id IN get_auth_client_ids()` | **SECURE** |
| **`invoice_sequences`**| **ENABLED** | ALL | Authenticated | `Workspace members can access invoice sequences`: `owner_id = auth.uid()` | **SECURE** |
| **`receipts`** | **ENABLED** | SELECT/INSERT | Authenticated | `freelancer_[select/insert]_receipts`: `owner_id = auth.uid()` | **SECURE** |
| | | SELECT | Authenticated | `client_select_receipts`: `client_id IN get_auth_client_ids()` | **SECURE** |
| | | UPDATE/DELETE | Any | Default Deny (Receipts are immutable financial audit artifacts) | **IMMUTABLE** |
| **`razorpay_orders`** | **ENABLED** | SELECT/INS/UPD | Authenticated | `freelancer_[select/insert/update]_razorpay_orders`: `owner_id = auth.uid()` | **SECURE** |
| | | SELECT | Authenticated | `client_select_razorpay_orders`: `client_id IN get_auth_client_ids()` | **SECURE** |
| **`email_events`** | **ENABLED** | SELECT | Authenticated | `Freelancers can view own workspace email events`: `owner_id = auth.uid()` | **SECURE** |
| | | INS/UPD/DEL | Authenticated | Default Deny (Email events logged exclusively via server background) | **AUDIT PROTECTED** |
| **`client_invitations`**| **ENABLED** | ALL | Authenticated | `freelancer_manage_own_invitations`: `owner_id = auth.uid()` | **SECURE** |
| | | SELECT | Authenticated | `clients_view_own_claimed_invitation`: `claimed_by_user_id = auth.uid()` | **SECURE** |
| **`account_deletions`** | **ENABLED** | ALL | Authenticated | `Workspace owners can manage deletion records`: Scoped to owner or target user | **SECURE** |
| **`activities`** | **ENABLED** | ALL | Authenticated | `Freelancer manage workspace activities`: `owner_id = auth.uid()` | **SECURE** |
| | | SELECT | Authenticated | `Clients can view own activities`: `client_id IN get_auth_client_ids()` | **SECURE** |
| **`workspace_comments`**| **ENABLED** | ALL | Authenticated | `Freelancer manage workspace comments`: `owner_id = auth.uid()` | **SECURE** |
| | | SELECT | Authenticated | `Clients view non-internal comments`: `client_id IN get_auth_client_ids() AND is_internal = false` | **SECURE** |

---

## 3. Storage Objects (`storage.objects`) Policy Matrix

| Storage Bucket | Visibility | Allowed MIME Types | Client Scope | Freelancer Scope | Evaluation |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **`documents`** | **PRIVATE** | Images (no SVG), PDF, Word, Excel, Plain Text, Zip | `SELECT`, `INSERT`, `UPDATE`, `DELETE` restricted to `workspaces/<wsId>/clients/<cliId>/*` | `ALL` operations restricted to `workspaces/<wsId>/*` | **SECURE (Canonical Path)** |
| **`deliverables`** | **PRIVATE** | Images (no SVG), PDF, Word, Excel, Plain Text, Zip | `SELECT` only restricted to `workspaces/<wsId>/clients/<cliId>/*` | `ALL` operations restricted to `workspaces/<wsId>/*` | **SECURE (Client Read-Only)** |
| **`avatars`** | **PUBLIC** | PNG, JPEG, GIF, WebP (Max 2MB, no SVG) | Read: Public<br>Write: `auth.uid() = id` folder | Read: Public<br>Write: `workspaces/<wsId>/*` | **SECURE** |
| **`logos`** | **PUBLIC** | PNG, JPEG, GIF, WebP (Max 2MB, no SVG) | Read: Public<br>Write: Denied | Read: Public<br>Write: `workspaces/<wsId>/*` | **SECURE** |
| **`signatures`** | **PUBLIC** | PNG, JPEG, GIF, WebP (Max 2MB, no SVG) | Read: Public<br>Write: Denied | Read: Public<br>Write: `workspaces/<wsId>/*` | **SECURE** |

---

## 4. Key Gaps Identified & Remediated in Phase 35 Migration

1. **Client Workspace Read Barrier**:
   - *Issue*: `workspaces` table only had a policy for `owner_id = auth.uid()`. When authenticated clients queried their workspace name or logo, RLS blocked them.
   - *Remediation*: Added `Clients can view assigned workspace` SELECT policy scoped through `public.get_auth_client_ids()`.
2. **Client Freelancer Profile View Barrier**:
   - *Issue*: `profiles` table only permitted `auth.uid() = id`. Clients viewing invoices or deliverables could not view their freelancer's name/avatar.
   - *Remediation*: Added `Clients can view workspace owner profile` SELECT policy scoped to owners of workspaces the client belongs to.
3. **Public Storage Canonical Path Hardening**:
   - *Issue*: `logos` and `signatures` allowed historical un-prefixed root paths (`<wsId>/...`).
   - *Remediation*: Standardized path matching on canonical `workspaces/<wsId>/...` structure across all buckets.
