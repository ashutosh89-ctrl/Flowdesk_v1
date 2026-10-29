'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/frontend/auth/auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { SignUpForm } from '@/frontend/auth/signup-form';
import { ArrowLeft } from 'lucide-react';
import { getSafeRedirectPath } from '@/shared/utils/safe-redirect';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const targetNext = getSafeRedirectPath(rawNext, '/onboarding');
  const [, setSignupEmail] = useState('');

  return (
    <div className="min-h-screen bg-[#101312] text-[#F5F5F0] flex flex-col items-center justify-center p-4 selection:bg-[#43D6B0] selection:text-[#101312] relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#191F1D] border border-[#176B5B]/30 shadow-2xl backdrop-blur-xl space-y-6 relative z-10">
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-xs text-[#A6B4AE] hover:text-[#F5F5F0] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to home</span>
        </button>

        <SignUpForm
          onSuccess={() => router.replace(targetNext)}
          onSwitchToLogin={() => router.push(rawNext ? `/login?next=${encodeURIComponent(rawNext)}` : '/login')}
          onGoToVerifyEmail={(typedEmail) => {
            setSignupEmail(typedEmail || '');
            router.push('/verify-email');
          }}
        />
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <React.Suspense fallback={<div className="min-h-screen bg-[#101312]" />}>
          <SignupContent />
        </React.Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
