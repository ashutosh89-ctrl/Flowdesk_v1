import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from '@/backend/utilities/supabase';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const path = request.nextUrl.pathname;

  // 0. API routes & Webhooks bypass UI page redirection
  if (path.startsWith('/api')) {
    return response;
  }

  // 1. Public Discovery & Metadata Routes (SEO / AEO)
  if (
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    path === '/manifest.webmanifest' ||
    path === '/llms.txt' ||
    path === '/opengraph-image' ||
    path === '/twitter-image' ||
    path.startsWith('/branding')
  ) {
    return response;
  }

  // 2. Freelancer Public Routes
  const isFreelancerPublicRoute =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/auth') ||
    path.startsWith('/recover') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/forgot-password');

  // 2. Client Portal Public Routes
  const isClientPublicRoute =
    path === '/client' ||
    path.startsWith('/client/login');

  // 3. Client Portal Protected Routes (requiring client token / session)
  const isClientProtectedRoute =
    path.startsWith('/portal') ||
    path.startsWith('/client/dashboard');

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabaseUrl = validateAndFormatUrl(rawUrl) || rawUrl;
  const supabaseAnonKey = validateKey(rawKey) || rawKey;

  // Demo mode is controlled EXCLUSIVELY by deployment configuration.
  // Browser state (cookies/localStorage) can NEVER activate demo mode in production.
  const isDemoEnv =
    process.env.NEXT_PUBLIC_AUTH_MODE === 'demo' ||
    !validateAndFormatUrl(rawUrl) ||
    !validateKey(rawKey);

  // If demo mode is explicitly configured, pass through to client-side demo guards.
  if (isDemoEnv) {
    return response;
  }

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
            });
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      // Refresh auth state and get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Freelancer Protected Route Gate
      // Requires authenticated Supabase user — URL tokens/params are NEVER sufficient
      if (!isFreelancerPublicRoute && !isClientPublicRoute && !isClientProtectedRoute && !user) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }

      // Client Protected Route Gate
      // Requires authenticated Supabase user — URL tokens/params are NEVER sufficient
      // /portal/[clientId] and /client/dashboard both require a valid Supabase session
      if (isClientProtectedRoute && !user) {
        const clientLoginUrl = new URL('/client/login', request.url);
        return NextResponse.redirect(clientLoginUrl);
      }
    } catch (err) {
      console.warn('Middleware error verifying Supabase session:', err);
      if (!isFreelancerPublicRoute && !isClientPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  } else if (!isFreelancerPublicRoute && !isClientPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images, favicon, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
