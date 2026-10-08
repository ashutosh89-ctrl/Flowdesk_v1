import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey, isDemoModeActive, supabaseAdmin } from '@/backend/utilities/supabase';
import { logger } from '@/backend/utilities/logger';

export async function GET(request: NextRequest) {
  if (isDemoModeActive()) {
    const demoRole = request.cookies.get('flowdesk_client_demo')?.value ? 'client' : 'freelancer';
    return NextResponse.json({
      authenticated: true,
      userId: demoRole === 'client' ? 'usr-demo-client' : 'usr-demo-alex',
      freelancer: true,
      client: true,
      clientCount: 1,
      clients: [{ id: 'cli-demo-001', name: 'Eleanor Vance', company: 'Apex Digital', status: 'active' }],
      onboardingCompleted: true,
    });
  }

  const supabaseUrl = validateAndFormatUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const supabaseAnonKey = validateKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ authenticated: false, error: 'Authentication configuration is unavailable.' }, { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
        });
      },
    },
  });

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;

    if (userError || !user) {
      return NextResponse.json({ authenticated: false, freelancer: false, client: false });
    }

    // A freelancer role is represented by workspace ownership, not merely by
    // the existence of a profile. Client-only accounts can also have profiles.
    let { data: ownedWorkspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    if ((!ownedWorkspaces || ownedWorkspaces.length === 0) && supabaseAdmin) {
      try {
        const { data: newWs } = await supabaseAdmin
          .from('workspaces')
          .insert({ owner_id: user.id, name: 'My Workspace' })
          .select('id')
          .maybeSingle();
        if (newWs) {
          ownedWorkspaces = [newWs];
        }
      } catch (wsErr) {
        console.warn('[auth/roles] workspace auto-creation notice:', wsErr);
      }
    }

    // Client role is represented by an authenticated client record. RLS exposes
    // only rows bound to auth.uid(), so this query does not reveal other clients.
    let { data: clientRows, error: clientError } = await supabase
      .from('clients')
      .select('id, name, company, status')
      .eq('user_id', user.id)
      .neq('status', 'pending_deletion')
      .order('created_at', { ascending: true })
      .limit(10);

    // If no client row is bound to user.id yet, check if there is an unbound client record
    // matching user.email (exact case-insensitive match) and bind it.
    // SEC-HIGH-01:
    // a) Only bind when user's email is confirmed (email_confirmed_at / confirmed_at).
    // b) Exact match on lowercased, trimmed email without wildcard matching.
    // c) Only bind rows where user_id IS NULL with conditional update .is('user_id', null).
    // d) Log security event with userId and clientId only (no plaintext email).
    const isEmailConfirmed = Boolean(user.email_confirmed_at || (user as any).confirmed_at);
    if ((!clientRows || clientRows.length === 0) && user.email && isEmailConfirmed && supabaseAdmin) {
      try {
        const normalizedEmail = user.email.trim().toLowerCase();
        const escapedEmail = normalizedEmail.replace(/[%_\\]/g, '\\$&');

        const { data: emailMatches } = await supabaseAdmin
          .from('clients')
          .select('id, name, company, status, user_id, email')
          .ilike('email', escapedEmail)
          .neq('status', 'pending_deletion');

        const exactMatches = (emailMatches || []).filter(
          (c) => c.email && c.email.trim().toLowerCase() === normalizedEmail
        );

        if (exactMatches.length > 0) {
          const unbound = exactMatches.filter((c) => !c.user_id);
          const alreadyBound = exactMatches.filter((c) => c.user_id === user.id);
          const newlyBoundClients: Array<{ id: string; name: string; company: string; status: string }> = [];

          for (const c of unbound) {
            const { error: updateErr } = await supabaseAdmin
              .from('clients')
              .update({ user_id: user.id })
              .eq('id', c.id)
              .is('user_id', null);

            if (!updateErr) {
              newlyBoundClients.push({
                id: c.id,
                name: c.name,
                company: c.company,
                status: c.status,
              });
              logger.security('CLIENT_AUTO_BIND_SUCCESS', {
                status: 'SUCCESS',
                userId: user.id,
                clientId: c.id,
              });
            }
          }

          const combined = [...alreadyBound, ...newlyBoundClients];
          if (combined.length > 0) {
            clientRows = combined.map((c) => ({
              id: c.id,
              name: c.name,
              company: c.company,
              status: c.status,
            }));
          }
        }
      } catch (bindErr) {
        console.warn('[auth/roles] email client auto-binding notice:', bindErr);
      }
    }

    if (workspaceError) console.warn('[auth/roles] workspace role check:', workspaceError.message);
    if (clientError) console.warn('[auth/roles] client role check:', clientError.message);

    const freelancer = true; // Every authenticated user has access to their freelancer workspace
    const clients = (clientRows || []).filter((client) => client.status !== 'pending_deletion');
    const client = clients.length > 0;

    let onboardingCompleted = true;
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (profile) {
      onboardingCompleted = profile.onboarding_completed ?? true;
    }

    const response = NextResponse.json({
      authenticated: true,
      userId: user.id,
      freelancer,
      client,
      clientCount: clients.length,
      clients,
      onboardingCompleted,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error: any) {
    logger.error('[auth/roles] role resolution failed:', error);
    const errRes = NextResponse.json(
      { authenticated: false, freelancer: false, client: false, error: 'Unable to determine account roles.' },
      { status: 500 }
    );
    errRes.headers.set('Cache-Control', 'no-store');
    return errRes;
  }
}


