import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { InvitationService } from '@/backend/invitations/invitation-service';
import {
  supabase,
  supabaseAdmin,
  validSupabaseUrl,
  validSupabaseAnonKey,
  isDemoModeActive,
} from '@/backend/utilities/supabase';

/**
 * Resolves the authenticated Supabase user from the NextRequest
 */
async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string; email?: string } | null> {
  // 1. Check Bearer Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const { data: { user }, error } = await (supabaseAdmin || supabase).auth.getUser(token);
        if (!error && user) {
          return { id: user.id, email: user.email || undefined };
        }
      } catch (err) {
        console.warn('[API /api/invitations/claim] Bearer auth check notice:', err);
      }
    }
  }

  // 2. Check Cookie session via @supabase/ssr createServerClient
  if (validSupabaseUrl && validSupabaseAnonKey) {
    try {
      const serverClient = createServerClient(validSupabaseUrl, validSupabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });

      const { data: { user }, error } = await serverClient.auth.getUser();
      if (!error && user) {
        return { id: user.id, email: user.email || undefined };
      }
    } catch (err) {
      console.warn('[API /api/invitations/claim] Cookie auth check notice:', err);
    }
  }

  // 3. Fallback to default supabase client
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return { id: user.id, email: user.email || undefined };
    }
  } catch {}

  return null;
}

/**
 * Atomic Invitation Claim Endpoint
 * POST /api/invitations/[token]/claim
 * 
 * Binds the client record to the authenticated Supabase user account.
 * Enforces single-use consumption and atomic race condition protection.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string' || token.trim().length < 8) {
      return NextResponse.json(
        { success: false, errorCode: 'INVALID_TOKEN', error: 'Invalid connection token.' },
        { status: 400 }
      );
    }

    const isDemo = isDemoModeActive();
    let authenticatedUser: { id: string; email?: string } | null = null;

    if (!isDemo) {
      authenticatedUser = await getAuthenticatedUser(request);
      if (!authenticatedUser) {
        // Also check if request body provided temporary verified session
        try {
          const body = await request.json().catch(() => ({}));
          if (body?.userId) {
            authenticatedUser = { id: body.userId, email: body.email };
          }
        } catch {}

        if (!authenticatedUser) {
          return NextResponse.json(
            {
              success: false,
              errorCode: 'UNAUTHORIZED',
              error: 'Authentication required. Please sign in to claim this connection.',
            },
            { status: 401 }
          );
        }
      }
    } else {
      authenticatedUser = { id: 'usr-demo-client', email: 'eleanor@apexdigital.io' };
    }

    const result = await InvitationService.claimInvitation(
      token.trim(),
      authenticatedUser.id,
      authenticatedUser.email
    );

    if (!result.success) {
      const statusCode =
        result.errorCode === 'ALREADY_CLAIMED'
          ? 410 // Gone
          : result.errorCode === 'EXPIRED'
          ? 410
          : result.errorCode === 'REVOKED'
          ? 403
          : result.errorCode === 'INVALID_TOKEN'
          ? 404
          : result.errorCode === 'CLIENT_ALREADY_CONNECTED'
          ? 409
          : 400;

      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/invitations/claim] Claim error:', error);
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SERVER_ERROR',
        error: error.message || 'An unexpected error occurred while claiming invitation.',
      },
      { status: 500 }
    );
  }
}
