import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from '@/src/lib/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabaseUrl = validateAndFormatUrl(rawUrl);
    const supabaseAnonKey = validateKey(rawKey);

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
                response.cookies.set(name, value, options);
              });
            },
          },
        });

        await supabase.auth.exchangeCodeForSession(code);
        return response;
      } catch (err) {
        console.error('Error exchanging code for session:', err);
      }
    }
  }

  // Fallback redirect to app home
  return NextResponse.redirect(new URL('/', request.url));
}
