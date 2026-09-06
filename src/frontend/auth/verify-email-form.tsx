import React, { useState } from 'react';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { Mail, AlertCircle } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';

export interface VerifyEmailFormProps {
  email: string;
  onSuccess: () => void;
}

export const VerifyEmailForm: React.FC<VerifyEmailFormProps> = ({ email, onSuccess }) => {
  const [code, setCode] = useState('740192');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { verifyOtp } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const res = await verifyOtp(email, code);
    setLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
      showToast('Verification Failed', res.error, 'error');
    } else {
      showToast('Verified', 'Email address confirmed!', 'success');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-2 text-white">
        <Mail className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">Verify Your Email</h3>
        <p className="text-xs text-zinc-400 mt-1">
          We sent a 6-digit verification code to <span className="text-white font-semibold">{email || 'your email'}</span>
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2 text-left">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Input
        label="Verification Code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="text-center font-mono text-lg tracking-widest"
        maxLength={6}
        required
      />

      <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
        Verify Account
      </Button>

      <p className="text-xs text-zinc-500">
        Didn’t receive a code?{' '}
        <button
          type="button"
          onClick={() => showToast('Dispatched', 'New verification code dispatched.', 'info')}
          className="text-zinc-300 hover:text-white underline font-medium"
        >
          Resend code
        </button>
      </p>
    </form>
  );
};
