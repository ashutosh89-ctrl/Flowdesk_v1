import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/backend/invitations/invitation-service';

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
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string' || token.trim().length < 8) {
      return NextResponse.json(
        { isValid: false, status: 'invalid', error: 'Invalid connection token provided.' },
        { status: 400 }
      );
    }

    const details = await InvitationService.getPublicInvitationDetails(token.trim());
    return NextResponse.json(details);
  } catch (error: any) {
    console.error('[API /api/invitations/[token]] Error:', error);
    return NextResponse.json(
      { isValid: false, status: 'invalid', error: 'Failed to verify connection link.' },
      { status: 500 }
    );
  }
}
