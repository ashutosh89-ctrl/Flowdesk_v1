import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { LoginForm } from './login-form';
import { SignupForm } from './signup-form';
import { ForgotPasswordForm } from './forgot-password-form';
import { ResetPasswordForm } from './reset-password-form';
import { VerifyEmailForm } from './verify-email-form';
import { OnboardingFlow } from './onboarding-flow';

export type AuthModalView = 'login' | 'signup' | 'forgot' | 'reset' | 'verify' | 'onboarding';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthModalView;
  onAuthSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialView = 'login',
  onAuthSuccess,
}) => {
  const [view, setView] = useState<AuthModalView>(initialView);
  const [prevInitialView, setPrevInitialView] = useState<AuthModalView>(initialView);
  const [userEmail, setUserEmail] = useState('');

  if (initialView !== prevInitialView) {
    setPrevInitialView(initialView);
    setView(initialView);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={view === 'onboarding' ? 'md' : 'sm'}>
      <div className="p-2">
        {view === 'login' && (
          <LoginForm
            onSuccess={() => {
              onAuthSuccess();
              onClose();
            }}
            onSwitchToSignup={() => setView('signup')}
            onSwitchToForgotPassword={() => setView('forgot')}
          />
        )}

        {view === 'signup' && (
          <SignupForm
            onSuccess={() => setView('onboarding')}
            onSwitchToLogin={() => setView('login')}
            onGoToVerifyEmail={(typedEmail) => {
              // Pass the email actually typed at signup — the OTP must be
              // verified against the same address the code was sent to.
              setUserEmail(typedEmail || userEmail);
              setView('verify');
            }}
          />
        )}

        {view === 'forgot' && (
          <ForgotPasswordForm
            onBackToLogin={() => setView('login')}
            onGoToResetPassword={() => setView('reset')}
          />
        )}

        {view === 'reset' && (
          <ResetPasswordForm
            onSuccess={() => setView('login')}
          />
        )}

        {view === 'verify' && (
          <VerifyEmailForm
            email={userEmail}
            onSuccess={() => setView('onboarding')}
          />
        )}

        {view === 'onboarding' && (
          <OnboardingFlow
            onComplete={() => {
              onAuthSuccess();
              onClose();
            }}
          />
        )}
      </div>
    </Modal>
  );
};
