'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isDemoModeActive, isAuthConfigError, AUTH_CONFIG_ERROR_MESSAGE } from '@/backend/utilities/supabase';
import { SessionService } from '@/backend/auth/session-service';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function PostLoginGate() {
  const router = useRouter();
  const [statusText, setStatusText] = useState('Verifying credentials...');
  const [configError, setConfigError] = useState<boolean>(() => isAuthConfigError());

  useEffect(() => {
    let isMounted = true;

    async function checkUserAndRoles() {
      try {
        if (isAuthConfigError()) {
          setConfigError(true);
          setStatusText('Configuration error detected.');
          return;
        }

        if (isDemoModeActive()) {
          const localSession = await SessionService.getSession();
          if (!localSession?.user) {
            router.replace('/login');
            return;
          }
          setStatusText('Demo mode active — routing to workspace...');
          router.replace('/dashboard');
          return;
        }

        const { supabase } = await import('@/backend/utilities/supabase');
        let user = (await supabase.auth.getUser()).data.user;

        if (!user) {
          user = (await supabase.auth.getSession()).data.session?.user || null;
        }
        if (!user) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          user = (await supabase.auth.getUser()).data.user;
        }

        if (!isMounted) return;
        if (!user) {
          router.replace('/login');
          return;
        }

        const { AccountDeletionService } = await import('@/backend/auth/account-deletion-service');
        const deletionStatus = await AccountDeletionService.getFreelancerDeletionStatus(user.id);
        if (deletionStatus.isPendingDeletion) {
          router.replace('/recover');
          return;
        }

        // A connection link can send an existing client to the shared login page.
        // After authentication, claim that invitation before normal role routing.
        const connectToken = new URLSearchParams(window.location.search).get('connect');
        if (connectToken) {
          setStatusText('Connecting your client workspace...');
          const claimResponse = await fetch(`/api/invitations/${encodeURIComponent(connectToken)}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, email: user.email }),
          });
          const claimResult = await claimResponse.json();

          if (!claimResponse.ok || !claimResult.success) {
            throw new Error(claimResult.error || 'Unable to connect this client workspace.');
          }

          router.replace(claimResult.clientId ? `/portal/${claimResult.clientId}` : '/client/dashboard');
          return;
        }

        setStatusText('Checking your FlowDesk workspaces...');
        const rolesResponse = await fetch('/api/auth/roles', { cache: 'no-store' });
        const roles = await rolesResponse.json();

        if (!rolesResponse.ok || !roles.authenticated) {
          throw new Error(roles.error || 'Unable to determine account roles.');
        }

        if (roles.freelancer && roles.client) {
          setStatusText('You have both freelancer and client access.');
          router.replace('/auth/choose-role');
          return;
        }

        if (roles.client) {
          setStatusText('Opening your client workspace...');
          router.replace('/client/dashboard');
          return;
        }

        if (roles.freelancer) {
          router.replace(roles.onboardingCompleted ? '/dashboard' : '/onboarding');
          return;
        }

        // A newly created freelancer account may not have a workspace yet.
        router.replace('/onboarding');
      } catch (err) {
        console.error('Unexpected error in post-login gate:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Unable to determine account access';
          router.replace(`/login?error=${encodeURIComponent(message)}`);
        }
      }
    }

    checkUserAndRoles();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-zinc-950">
      <div className="p-8 rounded-3xl bg-zinc-900/60 border border-white/10 flex flex-col items-center max-w-sm w-full text-center space-y-4 shadow-2xl backdrop-blur-xl">
        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
        <div>
          <FlowDeskLogo variant="full" size="sm" className="mx-auto mb-2" priority />
          {configError ? (
            <p className="text-xs text-amber-400" role="alert">{AUTH_CONFIG_ERROR_MESSAGE}</p>
          ) : (
            <p className="text-xs text-zinc-400">{statusText}</p>
          )}
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>{isDemoModeActive() ? 'Demo Mode Active' : 'Authentication Gate Active'}</span>
        </div>
      </div>
    </div>
  );
}
