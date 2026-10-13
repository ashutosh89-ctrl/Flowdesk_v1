'use client';

import React, { useEffect } from 'react';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[FlowDesk Global Error]:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090b] text-white min-h-screen font-sans flex items-center justify-center p-6 antialiased">
        <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Application Exception</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              FlowDesk encountered a critical rendering exception. Click below to reload the workspace.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/5 text-left">
            <p className="text-[11px] font-mono text-zinc-300 break-words line-clamp-3">
              {error?.message || 'A client-side exception has occurred.'}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors"
            >
              Reload Page
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.assign('/');
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-semibold text-xs border border-white/10 hover:bg-zinc-700 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
