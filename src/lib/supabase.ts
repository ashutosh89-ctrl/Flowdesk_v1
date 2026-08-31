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

let supabaseInstance: SupabaseClient | null = null;

const SAFE_PLACEHOLDER_URL = 'https://placeholder-project.supabase.co';
const SAFE_PLACEHOLDER_KEY = 'placeholder-anon-key';

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    if (isSupabaseConfigured && validSupabaseUrl && validSupabaseAnonKey) {
      try {
        supabaseInstance = createBrowserClient(validSupabaseUrl, validSupabaseAnonKey) as unknown as SupabaseClient;
      } catch (err) {
        console.warn('Failed to initialize Supabase with configured environment variables, using fallback client:', err);
        supabaseInstance = createSupabaseClient(SAFE_PLACEHOLDER_URL, SAFE_PLACEHOLDER_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      }
    } else {
      // Safe fallback client when Supabase is not fully configured
      supabaseInstance = createSupabaseClient(SAFE_PLACEHOLDER_URL, SAFE_PLACEHOLDER_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
  }
  return supabaseInstance;
};

export const supabase = getSupabase();
