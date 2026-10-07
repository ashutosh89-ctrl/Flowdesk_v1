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

// SEC-CRIT-03: Durable daily limits for invitation emails based on email_events table
const MAX_INVITATIONS_PER_WORKSPACE_24H = 20;
const MAX_INVITATIONS_PER_RECIPIENT_24H = 3;

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
  userId: string,
  eventType?: string
): Promise<string | null> {
  const db = supabaseAdmin || supabase;

  // For client invitations, the caller MUST be the workspace owner (freelancer).
  // A client linked to a workspace is never allowed to invite others to that workspace.
  const requiresOwner = eventType === 'client_invitation' || !eventType;

  if (workspaceId) {
    const { data: ws } = await db
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    if (ws) {
      if (ws.owner_id === userId) return ws.id;

      if (!requiresOwner) {
        const { data: clientLink } = await db
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .eq('workspace_id', ws.id)
          .maybeSingle();
        if (clientLink) return ws.id;
      }
    }
  }

  // Fallback: Resolve workspace owned by caller
  const { data: ownedWs } = await db
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownedWs) return ownedWs.id;

  // Fallback (for non-owner events only): Resolve workspace where caller is a registered client
  if (!requiresOwner) {
    const { data: clientWs } = await db
      .from('clients')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (clientWs?.workspace_id) return clientWs.workspace_id;
  }

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
): Promise<{ ok: boolean; error?: string; authorizedWsId?: string }> {
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
  const authorizedWsId = await resolveAuthorizedWorkspace(workspaceId, user.id, eventType);

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
    if (profile?.email?.toLowerCase() === normalized) return { ok: true, authorizedWsId };
    return { ok: false, error: 'Unauthorized: recipient is not the workspace owner.' };
  }

  if (CLIENT_DIRECTED_EVENTS.has(eventType)) {
    if (!authorizedWsId) {
      return { ok: false, error: 'Unauthorized: no workspace relationship for this event.' };
    }

    const escapedRecipient = normalized.replace(/[%_\\]/g, '\\$&');

    // Verify recipient belongs to a client in this authorized workspace
    // Exact case-insensitive match without wildcards.
    // SEC-CRIT-03: No bypass for client_invitation — must match existing clients row.
    const { data: clientMatches } = await db
      .from('clients')
      .select('id, email')
      .eq('workspace_id', authorizedWsId)
      .ilike('email', escapedRecipient);

    const clientRecord = (clientMatches || []).find(
      (c) => c.email && c.email.trim().toLowerCase() === normalized
    );

    if (!clientRecord) {
      return { ok: false, error: 'Unauthorized: recipient is not an active client in this workspace.' };
    }

    return { ok: true, authorizedWsId };
  }

  return { ok: false, error: `Unsupported email event type: ${eventType}` };
}

import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from '@/backend/utilities/rate-limiter';
import { logger } from '@/backend/utilities/logger';

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  try {
    // SEC-CRIT-03: Demo identity is STRICTLY gated by NEXT_PUBLIC_AUTH_MODE === 'demo'
    const isDemo = process.env.NEXT_PUBLIC_AUTH_MODE?.trim().toLowerCase() === 'demo';

    // 0. Rate limiting protection (in-memory layer 1)
    const rateLimit = await checkRateLimit(clientIp, RATE_LIMIT_PRESETS.EMAIL_DISPATCH);
    if (!rateLimit.allowed) {
      logger.security('EMAIL_DISPATCH_RATE_LIMITED', {
        ip: clientIp,
        status: 'BLOCKED',
        reason: 'Rate limit exceeded',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Too many email dispatch requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    let authenticatedUser: { id: string; email?: string } | null = null;

    if (!isDemo) {
      authenticatedUser = await getAuthenticatedUser(request);
      if (!authenticatedUser) {
        logger.security('EMAIL_DISPATCH_UNAUTHORIZED', {
          ip: clientIp,
          status: 'BLOCKED',
          reason: 'Missing authenticated session',
        });
        return NextResponse.json(
          { success: false, error: 'Authentication required to dispatch emails.' },
          { status: 401 }
        );
      }
    } else {
      authenticatedUser = { id: 'usr-demo-freelancer', email: 'alex@flowdesk.dev' };
    }

    // Layer 1b: User-level rate limiting
    const userRateLimit = await checkRateLimit(`user:${authenticatedUser.id}`, RATE_LIMIT_PRESETS.EMAIL_DISPATCH);
    if (!userRateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many email dispatch requests for this account. Please try again in ${userRateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429, headers: { 'Retry-After': String(userRateLimit.retryAfterSeconds) } }
      );
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
    let validatedWsId = workspaceId;
    if (!isDemo && authenticatedUser) {
      const recipientCheck = await validateRecipient(to, eventType, authenticatedUser, workspaceId);
      if (!recipientCheck.ok) {
        logger.security('EMAIL_RECIPIENT_VALIDATION_FAILED', {
          userId: authenticatedUser.id,
          to,
          eventType,
          workspaceId,
          status: 'BLOCKED',
          reason: recipientCheck.error,
        });
        return NextResponse.json(
          { success: false, error: recipientCheck.error },
          { status: 403 }
        );
      }

      validatedWsId = recipientCheck.authorizedWsId || workspaceId;

      // Durable daily send limits for client_invitation based on email_events table
      if (eventType === 'client_invitation') {
        const db = supabaseAdmin || supabase;
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Check per-workspace daily limit
        if (validatedWsId) {
          const { count: wsCount } = await db
            .from('email_events')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', validatedWsId)
            .eq('event_type', 'client_invitation')
            .gte('created_at', twentyFourHoursAgo);

          if ((wsCount ?? 0) >= MAX_INVITATIONS_PER_WORKSPACE_24H) {
            logger.security('EMAIL_DISPATCH_RATE_LIMITED', {
              userId: authenticatedUser.id,
              workspaceId: validatedWsId,
              status: 'BLOCKED',
              reason: `Workspace daily invitation limit (${MAX_INVITATIONS_PER_WORKSPACE_24H}) exceeded`,
            });
            return NextResponse.json(
              {
                success: false,
                error: `Too many invitation requests for this workspace. Daily limit of ${MAX_INVITATIONS_PER_WORKSPACE_24H} reached.`,
              },
              {
                status: 429,
                headers: { 'Retry-After': '86400' },
              }
            );
          }
        }

        // Check per-recipient daily limit
        const normalizedTo = String(to).toLowerCase().trim();
        const escapedTo = normalizedTo.replace(/[%_\\]/g, '\\$&');
        const { count: recipientCount } = await db
          .from('email_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', 'client_invitation')
          .ilike('recipient', escapedTo)
          .gte('created_at', twentyFourHoursAgo);

        if ((recipientCount ?? 0) >= MAX_INVITATIONS_PER_RECIPIENT_24H) {
          logger.security('EMAIL_DISPATCH_RATE_LIMITED', {
            userId: authenticatedUser.id,
            to: normalizedTo,
            status: 'BLOCKED',
            reason: `Recipient daily invitation limit (${MAX_INVITATIONS_PER_RECIPIENT_24H}) exceeded`,
          });
          return NextResponse.json(
            {
              success: false,
              error: `Too many invitation requests for this recipient. Daily limit of ${MAX_INVITATIONS_PER_RECIPIENT_24H} reached.`,
            },
            {
              status: 429,
              headers: { 'Retry-After': '86400' },
            }
          );
        }
      }
    }

    // Strip CR/LF from subject line to prevent header injection
    const cleanSubject = String(subject).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);

    // 3. Dispatch server-side via EmailService
    const result = await EmailService.send({
      to,
      subject: cleanSubject,
      html,
      text: options.text,
      eventType,
      referenceType,
      referenceId,
      workspaceId: validatedWsId,
      userId: options.userId || authenticatedUser?.id,
    });

    if (result.success) {
      logger.info('Email dispatched successfully', {
        userId: authenticatedUser?.id,
        eventType,
        referenceType,
        referenceId,
        provider: (result as any).provider,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('[API /api/email] Dispatch error', error, { ip: clientIp });
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error while processing email.' },
      { status: 500 }
    );
  }
}