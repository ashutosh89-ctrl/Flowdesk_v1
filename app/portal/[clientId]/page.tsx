'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ClientPortalView } from '@/frontend/client/portal/client-portal-view';
import { ClientAuthProvider, useClientAuth } from '@/frontend/client/auth/client-auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { ShieldAlert, LogIn, Loader2, Clock } from 'lucide-react';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

function PortalContent({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { client, workspaces, switchWorkspace, isLoading, isAuthenticated } = useClientAuth();

  // If clientId matches an authorized workspace that isn't active yet, switch to it
  useEffect(() => {
    if (client && client.id !== clientId && workspaces.length > 0) {
      const match = workspaces.find((w) => w.clientId === clientId);
      if (match) {
        switchWorkspace(match.workspaceId);
      }
    }
  }, [client, clientId, workspaces, switchWorkspace]);

  const isAuthorized = Boolean(
    client && (client.id === clientId || workspaces.some((w) => w.clientId === clientId))
  );

  const resolvedClientId = client?.id === clientId
    ? client.id
    : workspaces.find((w) => w.clientId === clientId)?.clientId || client?.id || null;

  const isPending = Boolean(
    client?.status === 'pending' ||
    workspaces.find((w) => w.clientId === clientId || w.clientId === resolvedClientId)?.status === 'pending'
  );

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

  if (!isAuthenticated) {
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
            onClick={() => router.push(`/login?next=${encodeURIComponent('/portal/' + clientId)}`)}
          >
            <LogIn className="w-4 h-4" /> Go to FlowDesk Login
          </Button>
        </Card>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 selection:bg-amber-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-5 border-amber-500/30 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono">
              Pending Freelancer Verification
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Access Pending Approval</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your connection request is awaiting review by the workspace owner. Workspace deliverables, projects, and invoices are strictly secured until approval.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="secondary"
              className="w-full justify-center gap-2"
              onClick={() => window.location.reload()}
            >
              Refresh Status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-zinc-400 hover:text-white"
              onClick={() => router.push('/client/dashboard')}
            >
              Go to Client Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!isAuthorized || !resolvedClientId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md p-8 text-center space-y-5 border-rose-500/20">
          <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Unauthorized Workspace Access</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your authenticated account is not connected to this freelancer workspace.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full justify-center gap-2"
            onClick={() => router.push('/client/dashboard')}
          >
            Go to Your Authorized Workspace
          </Button>
        </Card>
      </div>
    );
  }

  return <ClientPortalView clientId={resolvedClientId} />;
}

export default function ClientPortalPage({ params }: PageProps) {
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
  const resolved = use(params);
  const clientId = resolved.clientId;

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
