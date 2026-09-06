import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from '@/backend/utilities/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  let next = requestUrl.searchParams.get('next') || '/auth/post-login';

  if (type === 'recovery' && next === '/auth/post-login') {
    next = '/reset-password';
  }

  if (code) {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabaseUrl = validateAndFormatUrl(rawUrl) || rawUrl;
    const supabaseAnonKey = validateKey(rawKey) || rawKey;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const response = NextResponse.redirect(new URL(next, request.url));
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

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          return response;
        } else {
          console.error('exchangeCodeForSession error:', error.message);
        }
      } catch (err) {
        console.error('Error exchanging code for session in OAuth callback:', err);
      }
    }
  }

  // Fallback redirect to next or post-login gate
  return NextResponse.redirect(new URL(next, request.url));
}
