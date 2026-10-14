'use client';

import React, { useEffect } from 'react';

/**
 * Route-level client error boundary.
 *
 * Prevents a single component failure (e.g. a failed branding upload response
 * or a missing optional data field) from blanking the entire application with
 * Next.js's generic "Application error: a client-side exception has occurred".
 * The error is logged (never swallowed) so the root cause stays debuggable.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error + stack for diagnosis instead of hiding it.
    console.error('[FlowDesk] Unhandled client error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] bg-[#09090b] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-zinc-900/70 border border-white/10">
        <h2 className="text-lg font-bold tracking-tight">Something went wrong</h2>
        <p className="text-xs text-zinc-400">
          This section failed to render. Your data is safe — you can retry or return to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-xl border border-white/15 text-xs font-semibold text-zinc-200 hover:border-white/30 transition-colors"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
