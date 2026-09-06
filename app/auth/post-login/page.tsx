'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isDemoModeActive } from '@/backend/utilities/supabase';
import { SessionService } from '@/backend/auth/session-service';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function PostLoginGate() {
  const router = useRouter();
  const [statusText, setStatusText] = useState('Verifying credentials...');

  useEffect(() => {
    let isMounted = true;

    async function checkUserAndProfile() {
      try {
        let user = null;

        // In demo mode, use localStorage session instead of Supabase
        if (isDemoModeActive()) {
          const localSession = await SessionService.getSession();
          user = localSession?.user || null;

          if (!user) {
            console.warn('Post-login gate: No local session found, redirecting to /login');
            router.replace('/login');
            return;
          }

          if (!isMounted) return;
          setStatusText('Demo mode active — routing to workspace...');

          // In demo mode, skip Supabase profile check — always go to dashboard
          router.replace('/dashboard');
          return;
        }

        // Production mode: Use Supabase auth
        const { supabase } = await import('@/backend/utilities/supabase');

        // 1. Check authenticated user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        user = userData?.user;

        if (!user) {
          const { data: sessionData } = await supabase.auth.getSession();
          user = sessionData?.session?.user || null;
        }

        // Retry once in case cookie sync is slightly delayed
        if (!user) {
          await new Promise((res) => setTimeout(res, 400));
          const { data: retryData } = await supabase.auth.getUser();
          user = retryData?.user || null;
        }

        if (!isMounted) return;

        if (!user) {
          console.warn('Post-login gate: No authenticated user found, redirecting to /login');
          router.replace('/login');
          return;
        }

        // 2. Check if account is in pending deletion
        const { AccountDeletionService } = await import('@/backend/auth/account-deletion-service');
        const deletionStatus = await AccountDeletionService.getFreelancerDeletionStatus(user.id);
        if (deletionStatus.isPendingDeletion) {
          router.replace('/recover');
          return;
        }

        // 3. Query profiles table for onboarding status
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
          console.warn('Post-login profile query warning:', profileError.message);
        }

        if (!isMounted) return;

        // 4. Routing decision:
        if (!profile || !profile.onboarding_completed) {
          router.replace('/onboarding');
        } else {
          router.replace('/dashboard');
        }
      } catch (err) {
        console.error('Unexpected error in post-login gate:', err);
        if (isMounted) {
          router.replace('/login');
        }
      }
    }

    checkUserAndProfile();

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
          <p className="text-xs text-zinc-400">{statusText}</p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>{isDemoModeActive() ? 'Demo Mode Active' : 'Authentication Gate Active'}</span>
        </div>
      </div>
    </div>
  );
}
