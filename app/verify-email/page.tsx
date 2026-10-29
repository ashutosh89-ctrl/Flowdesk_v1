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
    <div className="min-h-screen bg-[#101312] text-[#F5F5F0] flex flex-col items-center justify-center p-4 selection:bg-[#43D6B0] selection:text-[#101312] relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#191F1D] border border-[#176B5B]/30 shadow-2xl backdrop-blur-xl space-y-6 relative z-10">
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-1.5 text-xs text-[#A6B4AE] hover:text-[#F5F5F0] transition-colors"
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
