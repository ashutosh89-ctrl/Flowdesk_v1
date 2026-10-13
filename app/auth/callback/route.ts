import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from '@/backend/utilities/supabase';
import { getSafeRedirectPath } from '@/shared/utils/safe-redirect';
import { logger } from '@/backend/utilities/logger';


export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  let next = getSafeRedirectPath(requestUrl.searchParams.get('next'), '/auth/post-login');

  // Determine external canonical base URL for serverless/reverse proxy environments (Vercel)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;

  // Handle OAuth provider error redirect
  if (error || errorDescription) {
    const errorMsg = errorDescription || error || 'OAuth provider authentication failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, origin));
  }

  if (type === 'recovery') {
    next = next === '/auth/post-login' ? '/reset-password' : getSafeRedirectPath(next, '/reset-password');
  }

  if (code) {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabaseUrl = validateAndFormatUrl(rawUrl) || rawUrl;
    const supabaseAnonKey = validateKey(rawKey) || rawKey;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const response = NextResponse.redirect(new URL(next, origin));
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                request.cookies.set(name, value);
                response.cookies.set(name, value, options);
              });
            },
          },
        });

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) {
          return response;
        } else {
          logger.error('[OAuth callback] exchangeCodeForSession error', exchangeError);
          const userMsg = process.env.NODE_ENV === 'production' ? 'Unable to authenticate with OAuth provider.' : exchangeError.message;
          return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(userMsg)}`, origin));
        }
      } catch (err: any) {
        logger.error('[OAuth callback] Error exchanging code for session', err);
        const userMsg = process.env.NODE_ENV === 'production' ? 'OAuth session exchange failed.' : (err?.message || 'OAuth session exchange failed.');
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(userMsg)}`, origin));
      }

    }
  }

  // Fallback redirect to next or post-login gate
  return NextResponse.redirect(new URL(next, origin));
}
