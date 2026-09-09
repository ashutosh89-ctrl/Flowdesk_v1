'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, Building2, ArrowRight, ShieldCheck, Loader2, LogOut } from 'lucide-react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Card } from '@/frontend/shared/ui/card';
import { AuthService } from '@/backend/auth/auth-service';

type WorkspaceRole = 'freelancer' | 'client';

export default function ChooseRolePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<WorkspaceRole | null>(null);

  const choose = async (role: WorkspaceRole) => {
    setSelected(role);
    try {
      const response = await fetch('/api/auth/roles', { cache: 'no-store' });
      const roles = await response.json();
      if (!response.ok || !roles.authenticated) {
        router.replace('/login');
        return;
      }

      if (role === 'freelancer' && roles.freelancer) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('flowdesk_workspace_mode', 'freelancer');
        }
        router.replace(roles.onboardingCompleted ? '/dashboard' : '/onboarding');
        return;
      }

      if (role === 'client' && roles.client) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('flowdesk_workspace_mode', 'client');
        }
        router.replace('/client/dashboard');
        return;
      }

      router.replace('/login?error=Selected%20workspace%20is%20not%20available');
    } catch {
      router.replace('/login?error=Unable%20to%20open%20selected%20workspace');
    }
  };

  const handleSignOut = async () => {
    await AuthService.signOut();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('flowdesk_workspace_mode');
    }
    router.replace('/login');
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-5 selection:bg-white selection:text-zinc-950">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <FlowDeskLogo variant="full" size="md" className="mx-auto" priority />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            One account · Dual workspaces detected
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Where do you want to go?</h1>
            <p className="text-sm text-zinc-400">Choose the FlowDesk workspace you want to open right now.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button type="button" onClick={() => choose('freelancer')} disabled={selected !== null} className="text-left disabled:opacity-60 transition-transform active:scale-[0.99]">
            <Card interactive className="h-full p-6 sm:p-7 relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-5">
                {selected === 'freelancer' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : (
                  <BriefcaseBusiness className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Freelancer Studio</h2>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Manage your clients, projects, deliverables, invoices and get paid.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
              </div>
            </Card>
          </button>

          <button type="button" onClick={() => choose('client')} disabled={selected !== null} className="text-left disabled:opacity-60 transition-transform active:scale-[0.99]">
            <Card interactive className="h-full p-6 sm:p-7 relative overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/15 flex items-center justify-center mb-5">
                {selected === 'client' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                ) : (
                  <Building2 className="w-6 h-6 text-emerald-400" />
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Client Portal</h2>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Review projects, approve deliverables, sign documents and pay invoices.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
              </div>
            </Card>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          {selected && <p className="text-xs text-zinc-400 animate-pulse">Opening your {selected === 'freelancer' ? 'Freelancer Studio' : 'Client Portal'}…</p>}
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out / Switch account</span>
          </button>
        </div>
      </div>
    </main>
  );
}

