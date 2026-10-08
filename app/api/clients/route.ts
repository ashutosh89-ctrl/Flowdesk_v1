import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, CreateClientSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { InvitationService } from '@/backend/invitations/invitation-service';
import { assertWithinLimit } from '@/backend/billing';
import { PlanLimitError } from '@/shared/billing';

/**
 * Client Creation Route Handler (Batch 3: Client Management & Invitations)
 *
 * Secure server-side client registration:
 * - Restricted to authenticated workspace owner.
 * - Automatically provisions connection invitation link.
 * - Dispatches transactional invitation email to client (non-blocking).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'client_create',
    maxRequests: 30,
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
      message: 'Authentication required to create clients.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, CreateClientSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Client created successfully (demo mode).',
        client: {
          id: `cli-demo-${Date.now()}`,
          name: payload.name,
          email: payload.email,
          company: payload.company || '',
          status: 'active',
          portal_access_enabled: true,
          created_at: new Date().toISOString(),
        },
        requestId,
      },
      {
        status: 201,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 5. Production DB Execution & Authorization
  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id, name')
      .eq('owner_id', caller.userId)
      .limit(1)
      .maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found for this account.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 5a. Quota Enforcement: Verify within plan limit for active clients
    try {
      await assertWithinLimit(workspace.id, 'activeClients', 1);
    } catch (limitErr: any) {
      if (limitErr instanceof PlanLimitError) {
        return createApiErrorResponse({
          message: limitErr.message,
          code: limitErr.code,
          status: limitErr.statusCode,
          requestId,
        });
      }
      throw limitErr;
    }

    const nowIso = new Date().toISOString();
    const { data: insertedClient, error: insertError } = await supabaseAdmin
      .from('clients')
      .insert({
        workspace_id: workspace.id,
        name: payload.name,
        email: payload.email.toLowerCase().trim(),
        company: payload.company || '',
        phone: payload.phone || null,
        hourly_rate: payload.hourlyRate || null,
        currency: payload.currency || 'USD',
        status: 'active',
        portal_access_enabled: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single();

    if (insertError || !insertedClient) {
      logger.error('Failed to create client in database', insertError, { requestId });
      return createApiErrorResponse({
        message: 'Failed to create client.',
        code: 'DATABASE_INSERT_ERROR',
        status: 500,
        requestId,
      });
    }

    // 6. Automatically generate connection link & dispatch invitation email
    let inviteUrl: string | undefined;
    try {
      const inviteResult = await InvitationService.createOrGetInvitation(insertedClient.id, {
        recipientEmail: insertedClient.email,
        workspaceId: workspace.id || undefined,
        freelancerId: caller.userId || undefined,
      });
      inviteUrl = inviteResult.url;

      if (insertedClient.email) {
        const { EmailService } = await import('@/backend/email/email-service');
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('business_name, full_name')
          .eq('id', caller.userId)
          .maybeSingle();

        const studioName = profile?.business_name || profile?.full_name || workspace.name || 'FlowDesk Studio';
        await EmailService.sendClientInvitation(
          insertedClient.email,
          {
            clientName: insertedClient.name,
            freelancerName: studioName,
            portalUrl: inviteResult.url,
          },
          { workspaceId: workspace.id || undefined, clientId: insertedClient.id }
        );
      }
    } catch (inviteErr) {
      logger.warn('Non-critical auto-invitation notice for new client', {
        requestId,
        error: String(inviteErr),
      });
    }

    // 7. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: workspace.id,
        client_id: insertedClient.id,
        action: 'created_client',
        title: `Created Client "${insertedClient.name}"`,
        description: `Created client ${insertedClient.name} (${insertedClient.company || 'No Company'}).`,
        resource_type: 'client',
        resource_id: insertedClient.id,
      });
    } catch { /* non-critical */ }

    logger.security('CLIENT_CREATED', {
      requestId,
      status: 'SUCCESS',
      clientId: insertedClient.id,
      workspaceId: workspace.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Client created successfully.',
        client: insertedClient,
        inviteUrl,
        requestId,
      },
      {
        status: 201,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected exception creating client', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error creating client.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
