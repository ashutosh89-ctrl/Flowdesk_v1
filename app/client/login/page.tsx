'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { ClientAuthService } from '@/backend/client';
import { isDemoModeActive } from '@/backend/utilities/supabase';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ShieldCheck, ArrowRight, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

function ClientLoginForm() {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setError('Please enter your client account email.');
      return;
    }
    if (!passwordInput.trim()) {
      setError('Password is required for authentication.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await ClientAuthService.login(emailInput.trim(), passwordInput.trim());
      if (res.success && res.client) {
        router.replace('/client/dashboard');
      } else {
        setError(res.error || 'Client portal access is not available for this account.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientDemoLogin = async () => {
    if (!isDemoModeActive()) return;
    setDemoLoading(true);
    setError(null);
    try {
      const res = await ClientAuthService.loginDemo('eleanor@apexdigital.io');
      if (res.success && res.client) {
        router.replace('/client/dashboard');
      } else {
        setError(res.error || 'Demo login failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <Card variant="crystal" className="border-white/10 backdrop-blur-xl">
      <CardContent className="p-6 sm:p-7 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">Sign in</h2>
          <p className="text-xs text-zinc-500">Use the email and password for your client account.</p>
        </div>

        <form onSubmit={handleEmailAccess} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@company.com"
                className="pl-9"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="flex items-center justify-end text-xs">
            <a href="/forgot-password" className="text-zinc-400 hover:text-white transition-colors">
              Forgot password?
            </a>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={loading || demoLoading} className="w-full justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="pt-1 border-t border-white/5 space-y-3">
          <p className="text-[11px] text-zinc-500 leading-relaxed text-center">
            New client? Your freelancer will send you a secure FlowDesk connection link. Open that link once to create your client account.
          </p>
          {isDemoModeActive() && (
            <button
              type="button"
              onClick={handleClientDemoLogin}
              disabled={loading || demoLoading}
              className="w-full text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
            >
              {demoLoading ? 'Opening client demo...' : 'Try the client demo'}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClientLoginPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <FlowDeskLogo variant="full" size="md" className="mx-auto" priority />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Client Collaboration Portal
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Access Your Client Workspace</h1>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              Sign in to review your projects, documents, deliverables and invoices.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="p-8 text-center text-zinc-500 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            }
          >
            <ClientLoginForm />
          </Suspense>

          <div className="space-y-3 text-center">
            <p className="text-xs text-zinc-500">Are you a freelancer?</p>
            <a href="/login" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors font-medium">
              Go to Freelancer Login <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
