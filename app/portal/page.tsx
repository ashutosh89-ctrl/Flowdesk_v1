'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClientAuthProvider, useClientAuth } from '@/frontend/client/auth/client-auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { ShieldCheck, LogIn, Loader2, ArrowRight } from 'lucide-react';
import { Suspense } from 'react';

function PortalRedirectHandler() {
  const router = useRouter();
  const { client, activeWorkspace, workspaces, isLoading, isAuthenticated } = useClientAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      const targetClientId = activeWorkspace?.clientId || client?.id || workspaces[0]?.clientId;
      if (targetClientId) {
        router.replace(`/portal/${targetClientId}`);
      } else {
        router.replace('/client/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, activeWorkspace, client, workspaces, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Resolving Client Portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-white/20">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">FlowDesk Client Portal</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sign in to access your projects, deliverables, invoices, and documents across all connected freelancer workspaces.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              className="w-full justify-center gap-2"
              onClick={() => router.push('/client/login?returnUrl=/portal')}
            >
              <LogIn className="w-4 h-4" /> Sign In to Client Portal
            </Button>

            <Button
              variant="secondary"
              className="w-full justify-center gap-2"
              onClick={() => router.push('/login')}
            >
              Freelancer Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
        <p className="text-xs text-zinc-400 font-mono">Opening your active workspace...</p>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <ToastProvider>
        <ClientAuthProvider>
          <PortalRedirectHandler />
        </ClientAuthProvider>
      </ToastProvider>
    </Suspense>
  );
}
