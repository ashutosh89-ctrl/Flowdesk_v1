'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/frontend/auth/auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { SignUpForm } from '@/frontend/auth/signup-form';
import { ArrowLeft } from 'lucide-react';

function SignupContent() {
  const router = useRouter();
  const [signupEmail, setSignupEmail] = useState('');

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-zinc-950">
      <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/80 border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to home</span>
        </button>

        <SignUpForm
          onSuccess={() => router.replace('/onboarding')}
          onSwitchToLogin={() => router.push('/login')}
          onGoToVerifyEmail={(typedEmail) => {
            // Keep the user's signup email for OTP verification — previously
            // discarded, which forced users to verify against a stale address.
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
        <SignupContent />
      </AuthProvider>
    </ToastProvider>
  );
}
