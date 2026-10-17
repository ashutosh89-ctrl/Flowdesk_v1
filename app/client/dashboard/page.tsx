'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientPortalView } from '@/frontend/client/portal/client-portal-view';
import { ClientAuthService } from '@/backend/client';
import { ClientAuthProvider, useClientAuth } from '@/frontend/client/auth/client-auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function ClientDashboardContent() {
  const router = useRouter();
  const { client, activeWorkspace, isLoading, isAuthenticated } = useClientAuth();

  // Resolve client ID from authenticated context
  const resolvedClientId = client?.id ?? activeWorkspace?.clientId ?? null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Verifying Client Security Credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md p-8 text-center space-y-5 border-white/20">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Client Portal Authentication Required</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No authenticated client session was found. Please log in using your client credentials.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full justify-center gap-2"
            onClick={() => router.push('/login')}
          >
            <LogIn className="w-4 h-4" /> Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  if (!resolvedClientId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md p-8 text-center space-y-5 border-white/20">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">No Connected Workspaces Yet</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your FlowDesk account is ready, but you have not connected to any freelancer workspaces yet.
              Ask your freelancer for their permanent portal link to connect your account.
            </p>
          </div>
          <Button
            variant="secondary"
            className="w-full justify-center gap-2"
            onClick={() => router.push('/')}
          >
            Return to Home
          </Button>
        </Card>
      </div>
    );
  }

  return <ClientPortalView clientId={resolvedClientId} />;
}

export default function ClientDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <ToastProvider>
        <ClientAuthProvider>
          <ClientDashboardContent />
        </ClientAuthProvider>
      </ToastProvider>
    </Suspense>
  );
}
