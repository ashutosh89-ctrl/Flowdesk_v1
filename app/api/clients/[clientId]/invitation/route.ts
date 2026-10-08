import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, CreateClientInvitationSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { InvitationService } from '@/backend/invitations/invitation-service';

/**
 * Client Connection Invitation Route Handler (Batch 3: Client Management & Invitations)
 *
 * Secure server-side provisioning and revocation of one-time client connection invitations:
 * - Restricted strictly to authenticated workspace owner.
 * - Enforces cryptographically secure 256-bit token generation and SHA-256 storage.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'client_invitation_gen',
    maxRequests: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to manage client invitations.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Route Parameter Validation
  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.clientId, uuidSchema, 'clientId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const clientId = paramValidation.data;

  // 4. Request Body Validation
  const bodyValidation = await parseJsonBody(request, CreateClientInvitationSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { recipientEmail, forceNew, sendEmail } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    const rawToken = 'demo-token-' + Date.now();
    return NextResponse.json(
      {
        success: true,
        message: 'Client invitation created (demo mode).',
        url: `http://localhost:3000/connect/${rawToken}`,
        rawToken,
        invitation: {
          id: `inv-demo-${clientId}`,
          clientId,
          status: 'pending',
          recipientEmail: recipientEmail || 'client@demo.com',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 6. Production DB Execution & Authorization
  try {
    const { data: client, error: fetchErr } = await supabaseAdmin
      .from('clients')
      .select('id, workspace_id, email, name')
      .eq('id', clientId)
      .maybeSingle();

    if (fetchErr || !client) {
      return createApiErrorResponse({
        message: 'Client not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', client.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      logger.security('CLIENT_INVITATION_FORBIDDEN', {
        requestId,
        ip,
        callerId: caller.userId,
        clientId,
        status: 'BLOCKED',
        reason: 'User lacks workspace ownership for client invitation generation',
      });
      return createApiErrorResponse({
        message: 'Only the workspace owner can generate client invitations.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. Invoke Invitation Service Server-Side
    const result = await InvitationService.createOrGetInvitation(clientId, {
      forceNew,
      recipientEmail: recipientEmail || client.email,
      workspaceId: client.workspace_id || undefined,
      freelancerId: caller.userId || undefined,
    });

    let emailDispatched = false;
    if (sendEmail) {
      const emailTarget = (recipientEmail || client.email || '').trim();
      if (emailTarget && emailTarget.includes('@')) {
        try {
          let studioName = 'FlowDesk Studio';
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('business_name, full_name')
            .eq('id', caller.userId)
            .maybeSingle();
          if (profile?.business_name) studioName = profile.business_name;
          else if (profile?.full_name) studioName = profile.full_name;

          const { EmailService } = await import('@/backend/email/email-service');
          const emailRes = await EmailService.sendClientInvitation(
            emailTarget,
            {
              clientName: client.name || 'Client',
              freelancerName: studioName,
              portalUrl: result.url,
            },
            { workspaceId: client.workspace_id, clientId: client.id }
          );
          emailDispatched = Boolean(emailRes.success);
        } catch (emailErr) {
          logger.warn('Failed to dispatch client invitation email server-side', { error: String(emailErr) });
        }
      }
    }

    logger.security('CLIENT_INVITATION_GENERATED', {
      requestId,
      status: 'SUCCESS',
      clientId,
      workspaceId: client.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: emailDispatched
          ? `Invitation email successfully dispatched to ${recipientEmail || client.email}`
          : 'Connection link generated successfully.',
        url: result.url,
        rawToken: result.rawToken,
        invitation: result.invitation,
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected exception during invitation generation', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error generating invitation.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'client_invitation_revoke',
    maxRequests: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to revoke invitations.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.clientId, uuidSchema, 'clientId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const clientId = paramValidation.data;

  if (isDemoModeActive()) {
    return NextResponse.json({ success: true, message: 'Invitation revoked (demo mode).' }, { status: 200 });
  }

  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, workspace_id')
      .eq('id', clientId)
      .maybeSingle();

    if (!client) {
      return createApiErrorResponse({
        message: 'Client not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', client.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can revoke client invitations.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('client_invitations')
      .update({ status: 'revoked', revoked_at: nowIso })
      .eq('client_id', clientId)
      .eq('status', 'pending');

    await supabaseAdmin
      .from('clients')
      .update({ portal_token: null })
      .eq('id', clientId);

    logger.security('CLIENT_INVITATION_REVOKED', {
      requestId,
      status: 'SUCCESS',
      clientId,
      workspaceId: client.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'All pending invitations for this client have been revoked.',
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected exception during invitation revocation', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error revoking invitation.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
