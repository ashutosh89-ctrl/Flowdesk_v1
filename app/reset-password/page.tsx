'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/frontend/auth/auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { ResetPasswordForm } from '@/frontend/auth/reset-password-form';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowLeft } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-white selection:text-zinc-950 relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-white/[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-white/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-zinc-900/85 border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-2xl space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg px-2 py-1 -ml-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>

          <FlowDeskLogo variant="full" size="sm" priority />
        </div>

        <ResetPasswordForm
          onSuccess={() => {
            router.push('/login');
          }}
        />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ResetPasswordContent />
      </AuthProvider>
    </ToastProvider>
  );
}
