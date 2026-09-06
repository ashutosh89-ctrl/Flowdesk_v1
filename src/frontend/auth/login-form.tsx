import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { OAuthButtons } from '@/frontend/shared/common/oauth-buttons';
import { Mail, Lock, ArrowRight, AlertCircle, Briefcase, Building2, Sparkles, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';
import { ClientAuthService } from '@/backend/client';
import { isDemoModeActive } from '@/backend/utilities/supabase';

export interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
  onSwitchToForgotPassword: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToSignup,
  onSwitchToForgotPassword,
}) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<'freelancer' | 'client' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { signIn, signInDemo } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const res = await signIn(email, password);
    setLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
      showToast('Sign In Failed', res.error, 'error');
    } else {
      showToast('Welcome back!', 'Authenticated into your FlowDesk workspace.', 'success');
      onSuccess();
    }
  };

  const handleFreelancerDemoLogin = async () => {
    // Demo access is ONLY available when demo mode is explicitly configured.
    if (!isDemoModeActive()) {
      setErrorMessage('Demo access is not enabled in this environment.');
      return;
    }
    setErrorMessage(null);
    setDemoLoading('freelancer');

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('flowdesk_demo_active', 'true');
      }
      if (typeof document !== 'undefined') {
        document.cookie = 'flowdesk_demo_active=true; path=/; max-age=86400; SameSite=Lax';
      }
      const res = await signInDemo('alex@riveradesign.co');
      if (res.error) {
        setErrorMessage(res.error);
        showToast('Demo Login Notice', res.error, 'error');
      } else {
        showToast('Freelancer Studio Demo', 'Welcome, Alex Rivera! Signed into studio owner mode.', 'success');
        router.push('/dashboard');
      }
    } catch (err: any) {
      showToast('Freelancer Demo Active', 'Welcome, Alex Rivera! Accessing studio dashboard.', 'success');
      router.push('/dashboard');
    } finally {
      setDemoLoading(null);
    }
  };

  const handleClientDemoLogin = async () => {
    // Demo access is ONLY available when demo mode is explicitly configured.
    if (!isDemoModeActive()) {
      setErrorMessage('Demo access is not enabled in this environment.');
      return;
    }
    setErrorMessage(null);
    setDemoLoading('client');

    try {
      const res = await ClientAuthService.loginDemo('eleanor@apexdigital.io');
      if (res.success) {
        showToast('Client Portal Demo', 'Welcome, Eleanor Vance (Apex Digital)! Accessing client portal.', 'success');
        router.push('/client/dashboard');
      } else {
        setErrorMessage(res.error || 'Client demo login failed.');
      }
    } catch (err: any) {
      router.push('/client/dashboard');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Sign In to FlowDesk</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Manage your clients, projects, deliverables, and invoices from one place.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Instant Demo Logins: Freelancer vs Client — only rendered when demo mode is explicitly configured */}
      {isDemoModeActive() && (
      <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            1-Click Demo Environments
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">No signup needed</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Demo 1: Freelancer Studio */}
          <button
            type="button"
            disabled={loading || demoLoading !== null}
            onClick={handleFreelancerDemoLogin}
            className="flex flex-col items-start p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 hover:border-indigo-500/40 text-left transition-all group focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 group-hover:text-indigo-200">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                Freelancer Demo
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-white">Alex Rivera</span>
            <span className="text-[10px] text-zinc-400 leading-tight mt-0.5">
              Studio Owner · Full OS & Invoices
            </span>
          </button>

          {/* Demo 2: Client Portal */}
          <button
            type="button"
            disabled={loading || demoLoading !== null}
            onClick={handleClientDemoLogin}
            className="flex flex-col items-start p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 hover:border-emerald-500/40 text-left transition-all group focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 group-hover:text-emerald-200">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Client Demo
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-white">Eleanor Vance</span>
            <span className="text-[10px] text-zinc-400 leading-tight mt-0.5">
              Apex Digital · Review & Approve
            </span>
          </button>
        </div>
      </div>
      )}

      {/* Google and GitHub OAuth Buttons */}
      <OAuthButtons onSuccess={onSuccess} onError={(err) => setErrorMessage(err)} />

      {/* Single Divider */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
          <span className="bg-zinc-900/90 px-3 text-zinc-500">OR WITH EMAIL</span>
        </div>
      </div>

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="your.email@company.com"
          value={email}
          disabled={loading || demoLoading !== null}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <div className="space-y-1.5">
          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            disabled={loading || demoLoading !== null}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-xs text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full h-10 min-h-[40px] text-xs font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all"
          isLoading={loading}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      {/* Account Navigation Links */}
      <div className="space-y-2 pt-1">
        <p className="text-xs text-center text-zinc-400">
          Don’t have a FlowDesk account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-white font-medium hover:underline focus:outline-none focus-visible:underline"
          >
            Create one
          </button>
        </p>

        <div className="text-center">
          <a
            href="/client/login"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors font-medium focus:outline-none focus-visible:underline"
          >
            <span>Are you a client? Access Client Portal Login</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </div>
    </div>
  );
};

