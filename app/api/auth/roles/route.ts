import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey, isDemoModeActive, supabaseAdmin } from '@/backend/utilities/supabase';

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
    const { data: ownedWorkspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

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
    // matching user.email (case-insensitive) and bind it.
    if ((!clientRows || clientRows.length === 0) && user.email) {
      try {
        const { data: emailMatches } = await supabaseAdmin
          .from('clients')
          .select('id, name, company, status, user_id')
          .ilike('email', user.email.trim())
          .neq('status', 'pending_deletion');

        if (emailMatches && emailMatches.length > 0) {
          const unbound = emailMatches.filter((c) => !c.user_id || c.user_id === user.id);
          if (unbound.length > 0) {
            for (const c of unbound) {
              if (c.user_id !== user.id) {
                await supabaseAdmin.from('clients').update({ user_id: user.id }).eq('id', c.id);
              }
            }
            clientRows = unbound.map((c) => ({
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

    const freelancer = Boolean(ownedWorkspaces?.length);
    const clients = (clientRows || []).filter((client) => client.status !== 'pending_deletion');
    const client = clients.length > 0;

    let onboardingCompleted = true;
    if (freelancer) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();
      onboardingCompleted = Boolean(profile?.onboarding_completed);
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      freelancer,
      client,
      clientCount: clients.length,
      clients,
      onboardingCompleted,
    });
  } catch (error: any) {
    console.error('[auth/roles] role resolution failed:', error);
    return NextResponse.json(
      { authenticated: false, freelancer: false, client: false, error: 'Unable to determine account roles.' },
      { status: 500 }
    );
  }
}

