import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/backend/email';
import { supabase } from '@/backend/utilities/supabase';

/**
 * Transactional email events. Recipients are NEVER trusted from the browser —
 * they must resolve to server-side records (a client row in the caller's
 * workspace, the workspace owner's profile email, or the caller's own email).
 */
const CLIENT_DIRECTED_EVENTS = new Set([
  'client_invitation',
  'deliverable_ready',
  'invoice_issued',
  'payment_received',
  'receipt_issued',
]);

// Sent from the client portal to the workspace owner (freelancer).
const OWNER_DIRECTED_EVENTS = new Set([
  'deliverable_approved',
  'revision_requested',
  'document_uploaded',
]);

// Account lifecycle/security — recipient must be the authenticated caller.
const SELF_DIRECTED_EVENTS = new Set([
  'account_deleted',
  'account_restored',
  'security_alert',
]);

/**
 * Resolves the workspace referenced by the event and verifies the caller has a
 * legitimate relationship to it:
 *  - freelancer caller: owns the workspace (owner_id = caller)
 *  - client caller: has a client row bound to the workspace (user_id = caller)
 * Returns the workspace id if authorized, else null.
 */
async function resolveAuthorizedWorkspace(
  workspaceId: string | undefined,
  userId: string
): Promise<string | null> {
  if (!workspaceId) return null;

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, owner_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!ws) return null;

  if (ws.owner_id === userId) return ws.id;

  const { data: clientLink } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', ws.id)
    .maybeSingle();
  if (clientLink) return ws.id;

  return null;
}

/**
 * Validates that the recipient email is a trusted server-side record.
 */
async function validateRecipient(
  recipientEmail: string | undefined,
  eventType: string,
  userId: string,
  workspaceId: string | undefined
): Promise<{ ok: boolean; error?: string }> {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { ok: false, error: 'Valid recipient email is required.' };
  }

  const normalized = recipientEmail.toLowerCase().trim();

  if (SELF_DIRECTED_EVENTS.has(eventType)) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email?.toLowerCase() === normalized) return { ok: true };
    return { ok: false, error: 'Unauthorized: recipient is not the account owner.' };
  }

  // Workspace relationship check — the caller must be bound to the referenced
  // workspace either as owner (freelancer) or as a linked client.
  const authorizedWsId = await resolveAuthorizedWorkspace(workspaceId, userId);

  if (OWNER_DIRECTED_EVENTS.has(eventType)) {
    if (!authorizedWsId) {
      return { ok: false, error: 'Unauthorized: no workspace relationship for this event.' };
    }
    // Recipient must be the workspace owner's profile email.
    const { data: ws } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', authorizedWsId)
      .single();
    if (!ws?.owner_id) return { ok: false, error: 'Workspace owner could not be resolved.' };
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', ws.owner_id)
      .single();
    if (profile?.email?.toLowerCase() === normalized) return { ok: true };
    return { ok: false, error: 'Unauthorized: recipient is not the workspace owner.' };
  }

  if (CLIENT_DIRECTED_EVENTS.has(eventType)) {
    if (!authorizedWsId) {
      return { ok: false, error: 'Unauthorized: no workspace relationship for this event.' };
    }
    // Recipient must be a client row in the referenced workspace.
    const { data: client, error } = await supabase
      .from('clients')
      .select('id')
      .eq('email', normalized)
      .eq('workspace_id', authorizedWsId)
      .maybeSingle();
    if (error || !client) {
      return { ok: false, error: 'Unauthorized: recipient is not a client record in this workspace.' };
    }
    return { ok: true };
  }

  return { ok: false, error: `Unsupported email event type: ${eventType}` };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Require an authenticated Supabase session.
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { options } = body;

    // Only the structured `options` payload is supported.
    // The legacy free-form `action` dispatcher is removed — the browser must
    // never be able to request arbitrary templates or arbitrary recipients.
    if (!options || typeof options !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing email options payload.' },
        { status: 400 }
      );
    }

    const { to, eventType, referenceType, referenceId, workspaceId, subject, html } = options;

    if (!eventType || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Email payload is incomplete (eventType, subject, html required).' },
        { status: 400 }
      );
    }

    // 2. Recipient must be a trusted server-side record owned by the caller.
    const recipientCheck = await validateRecipient(to, eventType, user.id, workspaceId);
    if (!recipientCheck.ok) {
      return NextResponse.json(
        { success: false, error: recipientCheck.error },
        { status: 403 }
      );
    }

    // 3. Dispatch server-side. This route runs on the server, so EmailService
    //    takes the direct provider path (no recursive browser relay).
    const result = await EmailService.send({
      to,
      subject,
      html,
      text: options.text,
      eventType,
      referenceType,
      referenceId,
      workspaceId,
      userId: options.userId || user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/email] Dispatch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error while processing email.' },
      { status: 500 }
    );
  }
}