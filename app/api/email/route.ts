import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { EmailService } from '@/backend/email';
import {
  supabase,
  supabaseAdmin,
  validSupabaseUrl,
  validSupabaseAnonKey,
  isDemoModeActive,
} from '@/backend/utilities/supabase';

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
 * Helper to resolve the authenticated Supabase user from the NextRequest
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
        console.warn('[API /api/email] Bearer auth check notice:', err);
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
          setAll() {
            // Read-only in route handler
          },
        },
      });

      const { data: { user }, error } = await serverClient.auth.getUser();
      if (!error && user) {
        return { id: user.id, email: user.email || undefined };
      }
    } catch (err) {
      console.warn('[API /api/email] Cookie auth check notice:', err);
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
  const db = supabaseAdmin || supabase;

  if (workspaceId) {
    const { data: ws } = await db
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    if (ws) {
      if (ws.owner_id === userId) return ws.id;

      const { data: clientLink } = await db
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .eq('workspace_id', ws.id)
        .maybeSingle();
      if (clientLink) return ws.id;
    }
  }

  // Fallback: Resolve workspace owned by caller
  const { data: ownedWs } = await db
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  if (ownedWs) return ownedWs.id;

  // Fallback: Resolve workspace where caller is a registered client
  const { data: clientWs } = await db
    .from('clients')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (clientWs?.workspace_id) return clientWs.workspace_id;

  return null;
}

/**
 * Validates that the recipient email is a trusted server-side record.
 */
async function validateRecipient(
  recipientEmail: string | undefined,
  eventType: string,
  user: { id: string; email?: string },
  workspaceId: string | undefined
): Promise<{ ok: boolean; error?: string }> {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { ok: false, error: 'Valid recipient email is required.' };
  }

  const normalized = recipientEmail.toLowerCase().trim();

  if (SELF_DIRECTED_EVENTS.has(eventType)) {
    if (user.email?.toLowerCase() === normalized) return { ok: true };
    return { ok: false, error: 'Unauthorized: recipient is not the account owner.' };
  }

  const db = supabaseAdmin || supabase;

  // Workspace relationship check — the caller must be bound to the referenced
  // workspace either as owner (freelancer) or as a linked client.
  const authorizedWsId = await resolveAuthorizedWorkspace(workspaceId, user.id);

  if (OWNER_DIRECTED_EVENTS.has(eventType)) {
    if (!authorizedWsId) {
      return { ok: false, error: 'Unauthorized: no workspace relationship for this event.' };
    }
    // Recipient must be the workspace owner's profile email.
    const { data: ws } = await db
      .from('workspaces')
      .select('owner_id')
      .eq('id', authorizedWsId)
      .maybeSingle();
    if (!ws?.owner_id) return { ok: false, error: 'Workspace owner could not be resolved.' };
    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('id', ws.owner_id)
      .maybeSingle();
    if (profile?.email?.toLowerCase() === normalized) return { ok: true };
    return { ok: false, error: 'Unauthorized: recipient is not the workspace owner.' };
  }

  if (CLIENT_DIRECTED_EVENTS.has(eventType)) {
    if (!authorizedWsId) {
      return { ok: false, error: 'Unauthorized: no workspace relationship for this event.' };
    }
    // Recipient must be a client row in the referenced workspace.
    const { data: client, error } = await db
      .from('clients')
      .select('id')
      .ilike('email', normalized)
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
    const isDemo = isDemoModeActive();

    let authenticatedUser: { id: string; email?: string } | null = null;

    if (!isDemo) {
      authenticatedUser = await getAuthenticatedUser(request);
      if (!authenticatedUser) {
        return NextResponse.json(
          { success: false, error: 'Authentication required to dispatch emails.' },
          { status: 401 }
        );
      }
    } else {
      authenticatedUser = { id: 'usr-demo-freelancer', email: 'alex@flowdesk.dev' };
    }

    const body = await request.json();
    const { options } = body;

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

    // 2. Recipient must be a trusted server-side record owned by the caller (in non-demo environments)
    if (!isDemo && authenticatedUser) {
      const recipientCheck = await validateRecipient(to, eventType, authenticatedUser, workspaceId);
      if (!recipientCheck.ok) {
        return NextResponse.json(
          { success: false, error: recipientCheck.error },
          { status: 403 }
        );
      }
    }

    // 3. Dispatch server-side via EmailService
    const result = await EmailService.send({
      to,
      subject,
      html,
      text: options.text,
      eventType,
      referenceType,
      referenceId,
      workspaceId,
      userId: options.userId || authenticatedUser?.id,
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