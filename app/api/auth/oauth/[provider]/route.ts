import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from '@/backend/utilities/supabase';

const ALLOWED_PROVIDERS = new Set(['google', 'github']);

/**
 * Start OAuth from a Route Handler so the PKCE verifier is written to the
 * response cookie by the same server-side Supabase client that later performs
 * the code exchange in /auth/callback.
 *
 * The redirect response is created before signInWithOAuth and is never replaced
 * afterwards. That is important because @supabase/ssr writes the verifier
 * cookie through the response cookie adapter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider?.toLowerCase();

  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'Unsupported OAuth provider.' }, { status: 400 });
  }

  const supabaseUrl = validateAndFormatUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const supabaseAnonKey = validateKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      new URL('/login?error=Authentication%20configuration%20is%20unavailable.', request.url)
    );
  }

  const origin = request.nextUrl.origin;
  const redirectTo = `${origin}/auth/callback`;

  // Keep this exact response object for the whole flow. Supabase's SSR client
  // will attach the PKCE verifier cookie to it via setAll().
  const response = NextResponse.redirect(new URL('/login', origin));

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

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github',
      options: { redirectTo },
    });

    if (error || !data?.url) {
      const message = error?.message || 'Unable to start OAuth authentication.';
      response.headers.set(
        'Location',
        new URL(`/login?error=${encodeURIComponent(message)}`, origin).toString()
      );
      return response;
    }

    // Preserve the PKCE verifier cookies already attached to `response` while
    // changing only the destination of the redirect.
    response.headers.set('Location', data.url);
    return response;
  } catch (error: any) {
    const message = error?.message || 'Unable to start OAuth authentication.';
    response.headers.set(
      'Location',
      new URL(`/login?error=${encodeURIComponent(message)}`, origin).toString()
    );
    return response;
  }
}
