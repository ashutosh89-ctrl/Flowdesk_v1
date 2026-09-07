/**
 * Test environment bootstrap — MUST be imported before any auth module.
 *
 * Sets the explicit demo-mode configuration (NEXT_PUBLIC_AUTH_MODE=demo)
 * BEFORE `src/backend/utilities/supabase.ts` computes `authMode` at module
 * load. Since the fail-closed hardening, demo mode activates ONLY via explicit
 * configuration; a production deployment with missing Supabase env vars fails
 * closed instead of silently becoming a demo environment. Suites that exercise
 * demo functionality must therefore declare demo mode — exactly like a real
 * demo deployment would via its environment configuration.
 */

// Neutralize any real Supabase configuration so demo mode is the only path,
// then declare explicit demo mode (mirrors a demo deployment's env vars).
process.env.NEXT_PUBLIC_SUPABASE_URL = '';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
process.env.NEXT_PUBLIC_AUTH_MODE = 'demo';

export {};
