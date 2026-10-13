-- ==============================================================================
-- PHASE 32: SECURITY HARDENING - HASH LEGACY CLIENT PORTAL TOKENS (UNAPPLIED)
-- ==============================================================================
-- Description:
-- One-off migration to ensure all legacy portal_token values in the clients table
-- conform strictly to SHA-256 digests (64-character hex strings). Any raw plaintext
-- tokens or invalid ID-like tokens are hashed or nullified.
--
-- Note: In accordance with audit instructions, this migration is created for
-- review and has NOT been automatically applied to the database.
-- ==============================================================================

-- Enable pgcrypto if not already enabled for digest() function
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Ensure index on portal_token is active for fast hash lookup
CREATE INDEX IF NOT EXISTS idx_clients_portal_token_hash ON public.clients (portal_token) WHERE portal_token IS NOT NULL;

-- 2. Hash any legacy plaintext portal_token that is not already a 64-character hex digest
-- (Tokens that were mistakenly set to UUIDs or short tokens get converted to their SHA-256 hash)
UPDATE public.clients
SET portal_token = encode(digest(portal_token, 'sha256'), 'hex')
WHERE portal_token IS NOT NULL
  AND length(portal_token) <> 64
  AND portal_token !~ '^[a-f0-9]{64}$';

-- 3. Invalidate any portal_token on clients that already have an active user_id bound
UPDATE public.clients
SET portal_token = NULL
WHERE user_id IS NOT NULL
  AND portal_token IS NOT NULL;

-- 4. Comment on column documenting SHA-256 storage constraint
COMMENT ON COLUMN public.clients.portal_token IS 'Cryptographic SHA-256 hash of the one-time client invitation token. Raw tokens exist only in generated invitation URLs and are never stored.';
