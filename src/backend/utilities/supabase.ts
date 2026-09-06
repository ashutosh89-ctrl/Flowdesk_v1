import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

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
 * Determined by NEXT_PUBLIC_AUTH_MODE env var.
 * Falls back to: PRODUCTION if Supabase is configured, DEMO if not.
 * NEVER auto-switches based on network failures.
 */
export type AuthMode = 'production' | 'demo';

export const authMode: AuthMode = (() => {
  const envMode = process.env.NEXT_PUBLIC_AUTH_MODE?.toLowerCase();
  if (envMode === 'demo') return 'demo';
  if (envMode === 'production') return 'production';
  // Default: production if Supabase is configured, demo if not
  return isSupabaseConfigured ? 'production' : 'demo';
})();

export const isProductionMode = authMode === 'production';
export const isDemoMode = authMode === 'demo';

// Legacy alias — kept for backward compatibility during migration.
// DO NOT USE in new code. Use isDemoMode / isProductionMode instead.
export const isDemoFallbackEnabled = isDemoMode;

/**
 * Runtime demo mode check.
 * Demo mode is controlled EXCLUSIVELY by deployment configuration
 * (NEXT_PUBLIC_AUTH_MODE=demo or missing Supabase credentials).
 * Browser state — localStorage flags, cookies, query parameters — can NEVER
 * activate demo mode in production. Production must fail closed.
 */
export function isDemoModeActive(): boolean {
  return isDemoMode || !isSupabaseConfigured;
}

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
