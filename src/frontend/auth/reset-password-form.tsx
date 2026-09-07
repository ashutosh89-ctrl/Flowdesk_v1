import React, { useState, useEffect } from 'react';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { Lock, AlertCircle, ShieldAlert } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';
import { SessionService } from '@/backend/auth/session-service';

export interface ResetPasswordFormProps {
  onSuccess: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // DETERMINISTIC recovery-session gate: the recovery session is established by
  // the server-side code exchange in /auth/callback (type=recovery). This form
  // must know — not guess — that a verified recovery session exists before it
  // allows a password change. No timer; resolution is awaited.
  const [sessionState, setSessionState] = useState<'checking' | 'valid' | 'invalid'>('checking');

  const { resetPassword } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;

    async function verifyRecoverySession() {
      // Small retry window for cookie write visibility right after the callback
      // redirect — resolved deterministically, never abandoned mid-flight.
      for (let attempt = 0; attempt < 3; attempt++) {
        const user = await SessionService.getVerifiedUser();
        if (user) {
          if (mounted) setSessionState('valid');
          return;
        }
        if (attempt < 2) {
          await new Promise((res) => setTimeout(res, 400));
        }
      }
      if (mounted) setSessionState('invalid');
    }

    verifyRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (sessionState !== 'valid') {
      setErrorMessage('Your password reset session is missing or has expired. Please request a new reset link.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      showToast('Error', 'Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const res = await resetPassword(password);
    setLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
      showToast('Error', res.error, 'error');
    } else {
      showToast('Success', 'Password successfully updated.', 'success');
      onSuccess();
    }
  };

  if (sessionState === 'checking') {
    return (
      <div className="py-8 text-center text-zinc-400 flex flex-col items-center gap-3">
        <Lock className="w-6 h-6 animate-pulse text-zinc-400" />
        <p className="text-xs">Verifying your reset link...</p>
      </div>
    );
  }

  if (sessionState === 'invalid') {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto text-amber-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Reset Link Invalid or Expired</h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            We could not verify a password reset session. Reset links expire for security reasons.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={() => {
            window.location.href = '/forgot-password';
          }}
        >
          Request a New Reset Link
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white tracking-tight">Set New Password</h3>
        <p className="text-xs text-zinc-400 mt-1">Enter your new secure password below.</p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Input
        label="New Password"
        type="password"
        placeholder="••••••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        leftIcon={<Lock className="w-4 h-4" />}
        required
      />

      <Input
        label="Confirm New Password"
        type="password"
        placeholder="••••••••••••"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        leftIcon={<Lock className="w-4 h-4" />}
        required
      />

      <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
        Update Password
      </Button>
    </form>
  );
};
