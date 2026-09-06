'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientPortalView } from '@/frontend/client/portal/client-portal-view';
import { ClientAuthProvider, useClientAuth } from '@/frontend/client/auth/client-auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

function PortalContent({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { client, isLoading, isAuthenticated } = useClientAuth();

  // Verify the authenticated client matches the requested clientId (derived — no effect needed)
  const resolvedClientId = client && client.id === clientId ? client.id : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Verifying Portal Access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !resolvedClientId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md p-8 text-center space-y-5 border-white/20">
          <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Portal Access Required</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              You must be authenticated to access this client portal. Please log in with your client credentials.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full justify-center gap-2"
            onClick={() => router.push('/client/login')}
          >
            <LogIn className="w-4 h-4" /> Go to Client Login
          </Button>
        </Card>
      </div>
    );
  }

  return <ClientPortalView clientId={resolvedClientId} />;
}

export default function ClientPortalPage({ params }: PageProps) {
  // Use a client component wrapper to resolve params
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <PortalPageWrapper params={params} />
    </Suspense>
  );
}

function PortalPageWrapper({ params }: { params: Promise<{ clientId: string }> }) {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setClientId(resolved.clientId));
  }, [params]);

  if (!clientId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <ClientAuthProvider>
        <PortalContent clientId={clientId} />
      </ClientAuthProvider>
    </ToastProvider>
  );
}
