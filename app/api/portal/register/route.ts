import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';

const SLUG_REGEX = /^fd_[a-z0-9_]{6,64}$/i;

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit(clientIp, {
    prefix: 'portal_register',
    maxRequests: 15,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const { slug, fullName, companyName, email, password } = body || {};

    if (!slug || typeof slug !== 'string' || !SLUG_REGEX.test(slug.trim())) {
      return NextResponse.json(
        { success: false, error: 'Valid portal identifier is required.' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Full name is required.' },
        { status: 400 }
      );
    }

    if (isDemoModeActive()) {
      return NextResponse.json({
        success: true,
        isDemo: true,
        userId: 'usr-demo-client',
      });
    }

    const admin = getSupabaseAdmin();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Verify that the workspace exists and is accepting connections
    const { data: ws, error: wsErr } = await admin
      .from('workspaces')
      .select('id, name, is_accepting_connections')
      .ilike('portal_slug', cleanSlug)
      .maybeSingle();

    if (wsErr || !ws) {
      return NextResponse.json(
        { success: false, error: 'Freelancer portal link does not exist.' },
        { status: 404 }
      );
    }

    if (ws.is_accepting_connections === false) {
      return NextResponse.json(
        { success: false, error: 'This freelancer is not currently accepting new connections.' },
        { status: 400 }
      );
    }

    // 2. Create the client user with pre-confirmed email so they are immediately active
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        company_name: companyName?.trim() || `${fullName.trim()} Organization`,
        role: 'client',
      },
    });

    if (createError) {
      const msg = createError.message?.toLowerCase() || '';
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        createError.status === 422
      ) {
        return NextResponse.json(
          {
            success: false,
            code: 'USER_EXISTS',
            error: 'An account with this email is already registered. Please sign in to connect.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: createError.message || 'Failed to create client account.' },
        { status: 400 }
      );
    }

    const userId = createData.user.id;

    // 3. Ensure profile has client role
    try {
      await admin.from('profiles').upsert(
        {
          id: userId,
          email: cleanEmail,
          full_name: fullName.trim(),
          role: 'client',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // Non-fatal if profiles table doesn't require manual sync
    }

    return NextResponse.json({
      success: true,
      userId,
      email: cleanEmail,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Registration failed.' },
      { status: 500 }
    );
  }
}
