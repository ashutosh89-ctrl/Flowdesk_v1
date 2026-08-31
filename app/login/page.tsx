'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider } from '@/src/context/auth-context';
import { ToastProvider } from '@/src/components/ui/toast';
import { LoginForm } from '@/src/features/auth/login-form';
import { ArrowLeft } from 'lucide-react';

function LoginContent() {
  const router = useRouter();

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

        <LoginForm
          onSuccess={() => router.replace('/auth/post-login')}
          onSwitchToSignup={() => router.push('/signup')}
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
        <LoginContent />
      </AuthProvider>
    </ToastProvider>
  );
}
