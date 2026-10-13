import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, UpdateClientSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Client Detail Mutation Route Handler (Batch 3: Client Management & Invitations)
 *
 * Secure server-side updates & archiving of client records:
 * - Restricted strictly to authenticated workspace owner.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'client_update',
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
      message: 'Authentication required to update clients.',
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
  const bodyValidation = await parseJsonBody(request, UpdateClientSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const updates = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Client updated successfully (demo mode).',
        client: {
          id: clientId,
          ...updates,
          updated_at: new Date().toISOString(),
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
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('clients')
      .select('id, workspace_id, name, company')
      .eq('id', clientId)
      .maybeSingle();

    if (fetchErr || !existing) {
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
      .eq('id', existing.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can update this client.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.company !== undefined) dbPayload.company = updates.company;
    if (updates.phone !== undefined) dbPayload.phone = updates.phone;
    if (updates.hourlyRate !== undefined) dbPayload.hourly_rate = updates.hourlyRate;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.portalAccessEnabled !== undefined) dbPayload.portal_access_enabled = updates.portalAccessEnabled;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('clients')
      .update(dbPayload)
      .eq('id', clientId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update client in database', updateError, { requestId, clientId });
      return createApiErrorResponse({
        message: 'Failed to update client.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        requestId,
      });
    }

    // Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: existing.workspace_id,
        client_id: clientId,
        action: updates.status === 'archived' ? 'archived_client' : 'updated_client',
        title: updates.status === 'archived' ? `Archived Client "${existing.name}"` : `Updated Client "${existing.name}"`,
        description: `Client details modified by workspace owner.`,
        resource_type: 'client',
        resource_id: clientId,
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Client updated successfully.',
        client: updated,
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
    logger.error('Unexpected exception updating client', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error updating client.',
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
    prefix: 'client_delete',
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
      message: 'Authentication required to delete clients.',
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
    return NextResponse.json({ success: true, message: 'Client deleted (demo mode).' }, { status: 200 });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id, workspace_id, name')
      .eq('id', clientId)
      .maybeSingle();

    if (!existing) {
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
      .eq('id', existing.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can delete this client.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const { error: delError } = await supabaseAdmin.from('clients').delete().eq('id', clientId);
    if (delError) {
      logger.error('Failed to delete client from database', delError, { requestId, clientId });
      return createApiErrorResponse({
        message: 'Failed to delete client.',
        code: 'DATABASE_DELETE_ERROR',
        status: 500,
        requestId,
      });
    }

    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: existing.workspace_id,
        action: 'deleted_client',
        title: `Deleted Client "${existing.name}"`,
        description: `Client was deleted from workspace.`,
        resource_type: 'client',
        resource_id: clientId,
      });
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        success: true,
        message: 'Client deleted successfully.',
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
    logger.error('Unexpected exception deleting client', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error deleting client.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
