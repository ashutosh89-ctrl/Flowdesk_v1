'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/frontend/auth/auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { LoginForm } from '@/frontend/auth/login-form';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowLeft } from 'lucide-react';
import { getSafeRedirectPath } from '@/shared/utils/safe-redirect';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const targetNext = getSafeRedirectPath(rawNext, '/auth/post-login');

  return (
    <div className="min-h-screen bg-[#101312] text-[#F5F5F0] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#43D6B0] selection:text-[#101312] relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-[#191F1D] border border-[#176B5B]/30 shadow-2xl backdrop-blur-2xl space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 text-xs text-[#A6B4AE] hover:text-[#F5F5F0] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#43D6B0]/50 rounded-lg px-2 py-1 -ml-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </button>

          <FlowDeskLogo variant="full" size="sm" priority />
        </div>

        <LoginForm
          onSuccess={() => router.replace(targetNext)}
          onSwitchToSignup={() => router.push(rawNext ? `/signup?next=${encodeURIComponent(rawNext)}` : '/signup')}
          onSwitchToForgotPassword={() => router.push('/forgot-password')}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <React.Suspense fallback={<div className="min-h-screen bg-[#101312]" />}>
          <LoginContent />
        </React.Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
