import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

import { AuthError } from './errors';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Validates whether a URL string is a valid HTTP/HTTPS URL and not a generic placeholder
 */
export const validateAndFormatUrl = (urlStr: string): string | null => {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (
    !trimmed ||
    trimmed.includes('your-supabase-project') ||
    trimmed.includes('YOUR_SUPABASE') ||
    trimmed.includes('your-project') ||
    trimmed.includes('placeholder-project') ||
    trimmed.includes('<') ||
    trimmed.includes('>')
  ) {
    return null;
  }

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.')) {
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Validates whether an anon key is not a placeholder
 */
export const validateKey = (keyStr: string): string | null => {
  if (!keyStr || typeof keyStr !== 'string') return null;
  const trimmed = keyStr.trim();
  if (
    !trimmed ||
    trimmed.length < 10 ||
    trimmed.includes('your-supabase-anon-key') ||
    trimmed.includes('YOUR_SUPABASE') ||
    trimmed.includes('placeholder-anon-key')
  ) {
    return null;
  }
  return trimmed;
};

export const validSupabaseUrl = validateAndFormatUrl(rawUrl);
export const validSupabaseAnonKey = validateKey(rawKey);

export const isSupabaseConfigured = Boolean(validSupabaseUrl && validSupabaseAnonKey);

/**
 * Explicit authentication mode.
 * PRODUCTION = Supabase authentication only
 * DEMO = FlowDeskStore/demo authentication only
 *
 * SECURITY (fail-closed): demo mode is ONLY active when explicitly configured
 * via NEXT_PUBLIC_AUTH_MODE=demo. Missing/broken Supabase configuration in a
 * production deployment MUST NOT activate demo mode — the app fails closed
 * with a configuration error instead of fabricating a demo identity.
 * Browser state — localStorage flags, cookies, query parameters — can NEVER
 * activate demo mode.
 */
export type AuthMode = 'production' | 'demo';

export const authMode: AuthMode =
  process.env.NEXT_PUBLIC_AUTH_MODE?.trim().toLowerCase() === 'demo'
    ? 'demo'
    : 'production';

export const isProductionMode = authMode === 'production';
export const isDemoMode = authMode === 'demo';

export function isDemoModeActive(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE?.trim().toLowerCase() === 'demo';
}

/**
 * Deployment configuration failure state.
 * True when a production deployment is missing valid Supabase configuration.
 * In this state the app must FAIL CLOSED: authentication is unavailable,
 * no session/profile/workspace may be fabricated, and the UI should surface
 * a clear configuration error (without exposing any secret values).
 *
 * Demo deployments are exempt — they never talk to Supabase.
 */
export function isAuthConfigError(): boolean {
  return !isDemoModeActive() && !isSupabaseConfigured;
}

/**
 * Human-readable, secret-free message for configuration failures.
 */
/**
 * Thrown when a production deployment lacks valid Supabase configuration.
 * Fail-closed guard: callers stop before creating fake sessions or querying
 * a placeholder client. Message is human-readable and exposes no secrets.
 */
export function assertSupabaseConfigured(): void {
  if (isAuthConfigError()) {
    throw new AuthError(AUTH_CONFIG_ERROR_MESSAGE);
  }
}

export const AUTH_CONFIG_ERROR_MESSAGE =
  'FlowDesk authentication is unavailable: the deployment is missing its Supabase configuration. ' +
  'Please contact support or check back later. (Deployment configuration error — no credentials are exposed.)';

let supabaseInstance: SupabaseClient | null = null;

const SAFE_PLACEHOLDER_URL = 'https://placeholder-project.supabase.co';
const SAFE_PLACEHOLDER_KEY = 'placeholder-anon-key';

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    if (isSupabaseConfigured && validSupabaseUrl && validSupabaseAnonKey) {
      try {
        if (typeof window !== 'undefined') {
          supabaseInstance = createBrowserClient(validSupabaseUrl, validSupabaseAnonKey) as unknown as SupabaseClient;
        } else {
          supabaseInstance = createSupabaseClient(validSupabaseUrl, validSupabaseAnonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          });
        }
      } catch (err) {
        console.warn('Failed to initialize Supabase with configured environment variables, using fallback client:', err);
        supabaseInstance = createSupabaseClient(SAFE_PLACEHOLDER_URL, SAFE_PLACEHOLDER_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      }
    } else {
      // Safe fallback client when Supabase is not fully configured
      supabaseInstance = createSupabaseClient(SAFE_PLACEHOLDER_URL, SAFE_PLACEHOLDER_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }
  return supabaseInstance;
};

export const supabase = getSupabase();

let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * Server-only Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * Falls back to standard client if service role key is not configured.
 */
export const getSupabaseAdmin = (): SupabaseClient => {
  if (!supabaseAdminInstance) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (validSupabaseUrl && serviceRoleKey && validateKey(serviceRoleKey)) {
      try {
        supabaseAdminInstance = createSupabaseClient(validSupabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      } catch (err) {
        console.warn('Failed to initialize Supabase admin client, using default client:', err);
        supabaseAdminInstance = getSupabase();
      }
    } else {
      supabaseAdminInstance = getSupabase();
    }
  }
  return supabaseAdminInstance;
};

export const supabaseAdmin = typeof window === 'undefined' ? getSupabaseAdmin() : supabase;
