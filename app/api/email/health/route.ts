import { NextRequest, NextResponse } from 'next/server';
import { getBrevoAccountStatus, getDefaultSender, checkEmailKillSwitch } from '@/backend/email/brevo-client';
import { maskEmail } from '@/backend/invitations/invitation-service';

export async function GET(request: NextRequest) {
  try {
    const status = await getBrevoAccountStatus();
    const defaultSender = getDefaultSender();
    const killSwitch = checkEmailKillSwitch();

    return NextResponse.json(
      {
        configured: status.configured,
        authenticated: status.authenticated,
        relayEnabled: status.relayEnabled,
        sendingPlatformActive: status.sendingPlatformActive,
        killSwitchActive: killSwitch,
        status: status.status,
        blockerReason: status.blockerReason || null,
        sender: defaultSender,
        accountEmailMasked: status.accountEmail ? maskEmail(status.accountEmail) : null,
        planType: status.planType || null,
        credits: status.credits ?? null,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        configured: false,
        authenticated: false,
        relayEnabled: false,
        sendingPlatformActive: false,
        killSwitchActive: false,
        status: 'error',
        blockerReason: err?.message || 'Error checking email provider health',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
