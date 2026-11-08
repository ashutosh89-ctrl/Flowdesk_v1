'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled FlowDesk Application Exception:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#101312] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
      <div className="max-w-md w-full bg-[#16181B] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
        <FlowDeskLogo variant="full" size="md" className="mx-auto" />
        
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Something unexpected happened</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            FlowDesk encountered an issue loading this screen. Your data and settings are safely preserved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-[#101312] font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#43D6B0]/10"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/dashboard';
              }
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" /> Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

