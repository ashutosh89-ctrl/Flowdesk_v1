import React, { useState } from 'react';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { OAuthButtons } from '@/frontend/shared/common/oauth-buttons';
import { User, Mail, Lock, ArrowRight, Building, AlertCircle } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';

export interface SignupFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  onGoToVerifyEmail: (email: string) => void;
}

export const SignUpForm: React.FC<SignupFormProps> = ({
  onSuccess,
  onSwitchToLogin,
  onGoToVerifyEmail,
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { signUp } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const res = await signUp(email, password, name, company);
    setLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
      showToast('Signup Error', res.error, 'error');
    } else {
      showToast('Account Created', res.message || 'Complete onboarding to initialize OS.', 'info');
      onGoToVerifyEmail(email);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white tracking-tight">Create your FlowDesk OS</h3>
        <p className="text-xs text-zinc-400 mt-1">Join independent freelancers managing world-class business.</p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Google and GitHub OAuth Buttons */}
      <OAuthButtons onSuccess={onSuccess} onError={(err) => setErrorMessage(err)} />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
          <span className="bg-[#121215] px-2 text-zinc-500">OR REGISTER WITH EMAIL</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          required
        />

        <Input
          label="Studio / Company Name"
          type="text"
          placeholder="My Studio"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          leftIcon={<Building className="w-4 h-4" />}
          required
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="jane@studio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <Input
          label="Password (min 6 chars)"
          type="password"
          placeholder="Create password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={loading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Get Started
        </Button>
      </form>

      <p className="text-xs text-center text-zinc-400 pt-2">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-white font-semibold hover:underline"
        >
          Sign In
        </button>
      </p>
    </div>
  );
};

export { SignUpForm as SignupForm };

