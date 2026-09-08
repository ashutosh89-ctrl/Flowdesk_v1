'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Card } from '@/frontend/shared/ui/card';

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

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-5 selection:bg-white selection:text-zinc-950">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <FlowDeskLogo variant="full" size="md" className="mx-auto" priority />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            One account · Two workspaces
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Where do you want to go?</h1>
            <p className="text-sm text-zinc-400">Choose the FlowDesk workspace you want to use right now.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button type="button" onClick={() => choose('freelancer')} disabled={selected !== null} className="text-left disabled:opacity-60">
            <Card interactive className="h-full p-6 sm:p-7">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-5">
                <BriefcaseBusiness className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Freelancer Workspace</h2>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Manage clients, projects, deliverables, invoices and payments.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
              </div>
            </Card>
          </button>

          <button type="button" onClick={() => choose('client')} disabled={selected !== null} className="text-left disabled:opacity-60">
            <Card interactive className="h-full p-6 sm:p-7">
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/15 flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Client Workspace</h2>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">Review projects, documents, deliverables, invoices and approvals.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
              </div>
            </Card>
          </button>
        </div>

        {selected && <p className="text-center text-xs text-zinc-500">Opening your {selected} workspace…</p>}
      </div>
    </main>
  );
}
