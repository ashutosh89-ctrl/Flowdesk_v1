-- ============================================================
-- Phase 16: RLS Verification Queries
-- Run these against the LIVE Supabase database to verify
-- client portal access isolation
-- ============================================================

-- ============================================================
-- PREREQUISITES
-- ============================================================
-- Before running these tests, you need:
-- 1. Freelancer A user (auth.users entry)
-- 2. Freelancer B user (auth.users entry)
-- 3. Client A user (auth.users entry)
-- 4. Client B user (auth.users entry)
-- 5. Workspace A owned by Freelancer A
-- 6. Workspace B owned by Freelancer B
-- 7. Client A record linked to Workspace A
-- 8. Client B record linked to Workspace B
-- 9. Projects, deliverables, invoices for each client
--
-- Replace the placeholder IDs below with real UUIDs.
-- ============================================================

-- ============================================================
-- TEST 1: FREELANCER A → OWN WORKSPACE (MUST PASS)
-- ============================================================
-- Set session as Freelancer A
-- SET LOCAL request.jwt.claims TO '{"sub": "FREELANCER_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return Freelancer A's clients
-- SELECT id, name, company FROM public.clients;
-- Expected: Client A's record only

-- Should return Freelancer A's projects
-- SELECT id, title, client_id FROM public.projects;
-- Expected: Projects assigned to Client A only

-- Should return Freelancer A's invoices
-- SELECT id, invoice_number, client_id FROM public.invoices;
-- Expected: Invoices for Client A only

-- ============================================================
-- TEST 2: FREELANCER A → FREELANCER B WORKSPACE (MUST FAIL)
-- ============================================================
-- Set session as Freelancer A
-- SET LOCAL request.jwt.claims TO '{"sub": "FREELANCER_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows
-- SELECT * FROM public.clients WHERE workspace_id = 'FREELANCER_B_WORKSPACE_ID';
-- Expected: 0 rows (RLS blocks access)

-- Should return 0 rows
-- SELECT * FROM public.projects WHERE workspace_id = 'FREELANCER_B_WORKSPACE_ID';
-- Expected: 0 rows (RLS blocks access)

-- ============================================================
-- TEST 3: CLIENT A → OWN DATA (MUST PASS)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return Client A's record
-- SELECT id, name, company FROM public.clients
-- WHERE id IN (SELECT public.get_auth_client_ids());
-- Expected: Client A's record only

-- Should return Client A's projects
-- SELECT id, title, client_id FROM public.projects
-- WHERE client_id IN (SELECT public.get_auth_client_ids());
-- Expected: Projects assigned to Client A only

-- Should return Client A's deliverables
-- SELECT id, title, client_id FROM public.deliverables
-- WHERE client_id IN (SELECT public.get_auth_client_ids());
-- Expected: Deliverables assigned to Client A only

-- Should return Client A's invoices
-- SELECT id, invoice_number, client_id FROM public.invoices
-- WHERE client_id IN (SELECT public.get_auth_client_ids());
-- Expected: Invoices for Client A only

-- Should return Client A's documents (non-internal only)
-- SELECT id, title, client_id, is_internal FROM public.documents
-- WHERE client_id IN (SELECT public.get_auth_client_ids());
-- Expected: Non-internal documents for Client A only

-- ============================================================
-- TEST 4: CLIENT A → CLIENT B DATA (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows
-- SELECT * FROM public.projects WHERE client_id = 'CLIENT_B_ID';
-- Expected: 0 rows (RLS blocks access)

-- Should return 0 rows
-- SELECT * FROM public.deliverables WHERE client_id = 'CLIENT_B_ID';
-- Expected: 0 rows (RLS blocks access)

-- Should return 0 rows
-- SELECT * FROM public.invoices WHERE client_id = 'CLIENT_B_ID';
-- Expected: 0 rows (RLS blocks access)

-- Should return 0 rows
-- SELECT * FROM public.documents WHERE client_id = 'CLIENT_B_ID';
-- Expected: 0 rows (RLS blocks access)

-- ============================================================
-- TEST 5: CLIENT A → FREELANCER-ONLY DATA (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows (profiles are user-specific)
-- SELECT * FROM public.profiles WHERE id = 'FREELANCER_A_USER_ID';
-- Expected: 0 rows

-- Should return 0 rows (workspaces are freelancer-owned)
-- SELECT * FROM public.workspaces WHERE owner_id = 'FREELANCER_A_USER_ID';
-- Expected: 0 rows

-- ============================================================
-- TEST 6: CLIENT A → INTERNAL DOCUMENTS (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows (internal documents are freelancer-only)
-- SELECT * FROM public.documents
-- WHERE client_id IN (SELECT public.get_auth_client_ids())
--   AND is_internal = true;
-- Expected: 0 rows

-- ============================================================
-- TEST 7: CLIENT A → INTERNAL COMMENTS (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows (internal comments are freelancer-only)
-- SELECT * FROM public.workspace_comments
-- WHERE client_id IN (SELECT public.get_auth_client_ids())
--   AND is_internal = true;
-- Expected: 0 rows

-- ============================================================
-- TEST 8: CLIENT A → UNAUTHORIZED INVOICE (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows (cannot see invoices not assigned to them)
-- SELECT * FROM public.invoice_items
-- WHERE invoice_id IN (
--   SELECT id FROM public.invoices
--   WHERE client_id NOT IN (SELECT public.get_auth_client_ids())
-- );
-- Expected: 0 rows

-- ============================================================
-- TEST 9: CLIENT A → UNAUTHORIZED DELIVERABLE (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows (cannot see deliverables not assigned to them)
-- SELECT * FROM public.deliverable_files
-- WHERE deliverable_id IN (
--   SELECT id FROM public.deliverables
--   WHERE client_id NOT IN (SELECT public.get_auth_client_ids())
-- );
-- Expected: 0 rows

-- ============================================================
-- TEST 10: CLIENT A → APPROVE OWN DELIVERABLE (MUST PASS)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should succeed (client can approve their own deliverable)
-- UPDATE public.deliverables
-- SET status = 'approved', approved_at = now()
-- WHERE id = 'CLIENT_A_DELIVERABLE_ID'
--   AND client_id IN (SELECT public.get_auth_client_ids());
-- Expected: 1 row updated

-- ============================================================
-- TEST 11: CLIENT A → MODIFY UNAUTHORIZED DELIVERABLE (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should fail (client cannot modify deliverables not assigned to them)
-- UPDATE public.deliverables
-- SET status = 'approved'
-- WHERE id = 'CLIENT_B_DELIVERABLE_ID';
-- Expected: 0 rows updated (RLS blocks)

-- ============================================================
-- TEST 12: FREELANCER A → APPROVE AS CLIENT A (MUST FAIL)
-- ============================================================
-- Set session as Freelancer A
-- SET LOCAL request.jwt.claims TO '{"sub": "FREELANCER_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should fail (freelancer cannot impersonate client)
-- UPDATE public.deliverables
-- SET status = 'approved', approved_at = now()
-- WHERE id = 'CLIENT_A_DELIVERABLE_ID';
-- Expected: This UPDATE would succeed if Freelancer A owns the workspace,
-- but the approved_at timestamp should reflect freelancer action, not client.
-- The application layer should track who performed the action.

-- ============================================================
-- TEST 13: UNAUTHENTICATED → CLIENT PORTAL (MUST FAIL)
-- ============================================================
-- No JWT claims set
-- RESET role;

-- Should return 0 rows for all queries
-- SELECT * FROM public.clients;
-- Expected: 0 rows (RLS blocks unauthenticated access)

-- ============================================================
-- TEST 14: LOGGED-OUT CLIENT → CLIENT PORTAL (MUST FAIL)
-- ============================================================
-- Session expired / no JWT
-- RESET role;

-- Should return 0 rows
-- SELECT * FROM public.projects;
-- Expected: 0 rows (RLS blocks expired session)

-- ============================================================
-- TEST 15: CHANGED URL CLIENTID → UNAUTHORIZED CLIENT (MUST FAIL)
-- ============================================================
-- Set session as Client A
-- SET LOCAL request.jwt.claims TO '{"sub": "CLIENT_A_USER_ID"}';
-- SET LOCAL role TO 'authenticated';

-- Should return 0 rows (URL manipulation doesn't bypass RLS)
-- SELECT * FROM public.projects WHERE client_id = 'CLIENT_B_ID';
-- Expected: 0 rows (RLS enforces authorization, not URL)
-- ============================================================
