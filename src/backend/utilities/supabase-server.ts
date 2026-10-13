import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from './supabase';

/**
 * Creates a cookie-aware Supabase client for Next.js 15 App Router Route Handlers
 * and Server Components using @supabase/ssr and `await cookies()`.
 */
export async function createRouteSupabaseClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabaseUrl = validateAndFormatUrl(rawUrl);
  const supabaseAnonKey = validateKey(rawKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    cookieStore = await cookies();
  } catch {
    // cookies() may throw outside request context (e.g. during build or static evaluation)
    cookieStore = null;
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore ? cookieStore.getAll() : [];
      },
      setAll(cookiesToSet) {
        if (!cookieStore) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore!.set(name, value, options);
          });
        } catch {
          // Setting cookies is only supported in Server Actions or Route Handlers before response headers are sent
        }
      },
    },
  });
}
