import React, { useState } from 'react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import { useToast } from '../../components/ui/toast';
import { useAuth } from '../../context/auth-context';

export interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
  onGoToResetPassword: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onBackToLogin,
  onGoToResetPassword,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { forgotPassword } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const res = await forgotPassword(email);
    setLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
      showToast('Error', res.error, 'error');
    } else {
      showToast('Reset Link Dispatched', res.message || 'Check your email inbox for instructions.', 'info');
      onGoToResetPassword();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white tracking-tight">Reset Password</h3>
        <p className="text-xs text-zinc-400 mt-1">Enter your registered email address to receive reset instructions.</p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Input
        label="Email Address"
        type="email"
        placeholder="alex@riveradesign.co"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        leftIcon={<Mail className="w-4 h-4" />}
        required
      />

      <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
        Send Reset Code
      </Button>

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
      </div>
    </form>
  );
};
