'use client';

import React, { useEffect } from 'react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { AlertCircle, RotateCcw, Home, ArrowRight } from 'lucide-react';
import { Button } from '@/frontend/shared/ui/button';
import { Card } from '@/frontend/shared/ui/card';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log exception for diagnostics
    console.error('[FlowDesk Application Error]:', error);
  }, [error]);

  const errorMessage = error?.message || 'An unexpected client-side error occurred.';
  const digest = error?.digest;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 selection:bg-white selection:text-zinc-950">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center mb-2">
          <FlowDeskLogo variant="full" size="md" />
        </div>

        <Card variant="crystal" className="p-8 space-y-6 border-white/10 shadow-2xl backdrop-blur-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white">Something went wrong</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We encountered an unexpected issue while rendering this page. You can try reloading the section or returning to your workspace.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/5 text-left space-y-1">
            <p className="text-[11px] font-mono text-zinc-300 break-words line-clamp-3">
              {errorMessage}
            </p>
            {digest && (
              <p className="text-[10px] font-mono text-zinc-500">
                Digest: {digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="primary"
              className="flex-1 justify-center gap-2"
              onClick={() => reset()}
            >
              <RotateCcw className="w-4 h-4" /> Try Again
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-center gap-2"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.assign('/dashboard');
                }
              }}
            >
              <Home className="w-4 h-4" /> Dashboard
            </Button>
          </div>
        </Card>

        <p className="text-[11px] text-zinc-600">
          FlowDesk Operating System &bull; Automatic recovery active
        </p>
      </div>
    </div>
  );
}
