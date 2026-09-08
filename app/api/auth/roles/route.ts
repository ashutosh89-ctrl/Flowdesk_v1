import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { validateAndFormatUrl, validateKey } from '@/backend/utilities/supabase';

export async function GET(request: NextRequest) {
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
    const { data: clientRows, error: clientError } = await supabase
      .from('clients')
      .select('id, name, company, status')
      .eq('user_id', user.id)
      .neq('status', 'pending_deletion')
      .order('created_at', { ascending: true })
      .limit(10);

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
