'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider } from '@/frontend/auth/auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { VerifyEmailForm } from '@/frontend/auth/verify-email-form';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';

function VerifyEmailContent() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-zinc-950">
      <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/80 border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </button>

        <Suspense
          fallback={
            <div className="py-8 text-center text-zinc-400 text-xs">
              Loading...
            </div>
          }
        >
          <VerifyEmailFormWrapper
            onSuccess={() => router.replace('/onboarding')}
          />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Reads the signup email from the ?email= query parameter (set by the signup
 * page) so the OTP is verified against the address the code was actually
 * sent to. The field remains editable if the user needs to correct it.
 */
function VerifyEmailFormWrapper({ onSuccess }: { onSuccess: () => void }) {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  return <VerifyEmailForm email={email} onSuccess={onSuccess} />;
}

export default function VerifyEmailPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <VerifyEmailContent />
      </AuthProvider>
    </ToastProvider>
  );
}
