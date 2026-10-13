import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/backend/invitations/invitation-service';
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/backend/utilities/rate-limiter';
import { logger } from '@/backend/utilities/logger';
import { tokenParamSchema } from '@/shared/validation';

/**
 * Public Invitation Details Endpoint
 * GET /api/invitations/[token]
 * 
 * Safely resolves the public invitation status and context for display on the connect page.
 * NEVER leaks internal database IDs (client_id, workspace_id, freelancer_id) to the client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const clientIp = getClientIp(request);

  // Rate limiting protection on public lookup
  const rateLimit = await checkRateLimit(clientIp, RATE_LIMIT_PRESETS.INVITATION_CLAIM);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        isValid: false,
        status: 'invalid',
        error: `Too many lookup attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    const { token } = await params;

    const validation = tokenParamSchema.safeParse(token);
    if (!validation.success) {
      return NextResponse.json(
        { isValid: false, status: 'invalid', error: 'Invalid connection token provided.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const details = await InvitationService.getPublicInvitationDetails(validation.data);
    const response = NextResponse.json(details);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: any) {
    logger.error('[API /api/invitations/[token]] Error:', error);
    return NextResponse.json(
      { isValid: false, status: 'invalid', error: 'Failed to verify connection link.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
