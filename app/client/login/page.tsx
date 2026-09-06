'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { ClientAuthService } from '@/backend/client';
import { AuthService } from '@/backend/auth/auth-service';
import { isDemoModeActive } from '@/backend/utilities/supabase';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ShieldCheck, ArrowRight, Mail, Lock, Loader2, AlertCircle, Zap, Briefcase, Building2, Sparkles, ArrowUpRight } from 'lucide-react';

function ClientLoginForm() {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<'freelancer' | 'client' | null>(null);
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
        router.push('/client/dashboard');
      } else {
        setError(res.error || 'Client portal access has not been configured for this account.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientDemoLogin = async () => {
    // Demo access is ONLY available when demo mode is explicitly configured.
    if (!isDemoModeActive()) {
      setError('Demo access is not enabled in this environment.');
      return;
    }
    setDemoLoading('client');
    setError(null);

    try {
      const res = await ClientAuthService.loginDemo('eleanor@apexdigital.io');
      if (res.success && res.client) {
        router.push('/client/dashboard');
      } else {
        setError(res.error || 'Demo login failed.');
      }
    } catch (err: any) {
      router.push('/client/dashboard');
    } finally {
      setDemoLoading(null);
    }
  };

  const handleFreelancerDemoLogin = async () => {
    // Demo access is ONLY available when demo mode is explicitly configured.
    if (!isDemoModeActive()) {
      setError('Demo access is not enabled in this environment.');
      return;
    }
    setDemoLoading('freelancer');
    setError(null);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('flowdesk_demo_active', 'true');
      }
      if (typeof document !== 'undefined') {
        document.cookie = 'flowdesk_demo_active=true; path=/; max-age=86400; SameSite=Lax';
      }
      await AuthService.signInDemo('alex@riveradesign.co');
      router.push('/dashboard');
    } catch (err: any) {
      router.push('/dashboard');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <Card variant="crystal" className="border-white/10 backdrop-blur-xl">
      <CardContent className="p-6 space-y-4">
        {/* Quick Dual Demo Access — only rendered when demo mode is explicitly configured */}
        {isDemoModeActive() && (
        <div className="space-y-2 p-3 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              1-Click Demo Environments
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Instant access</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {/* Demo 1: Client Portal */}
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

            {/* Demo 2: Freelancer Studio */}
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
                Studio Owner · Full OS
              </span>
            </button>
          </div>
        </div>
        )}

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
            <span className="bg-zinc-900 px-2 text-zinc-500">OR SIGN IN WITH EMAIL</span>
          </div>
        </div>

        <form onSubmit={handleEmailAccess} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">Client Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="client@acme.com"
                className="pl-9"
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
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? 'Authenticating...' : 'Sign In as Client'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ClientLoginPage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <FlowDeskLogo variant="full" size="md" className="mx-auto" priority />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Client Collaboration Portal
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Access Your Client Workspace</h1>
            <p className="text-sm text-zinc-400">
              Sign in with your email and password to access your workspace.
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

          <p className="text-center text-xs text-zinc-500">
            Powered by FlowDesk Client Collaboration Network
          </p>

          <p className="text-center text-xs text-zinc-500">
            Are you a freelancer?{' '}
            <a
              href="/login"
              className="text-zinc-400 hover:text-white transition-colors font-medium"
            >
              Go to Freelancer Login
            </a>
          </p>
        </div>
      </div>
    </ToastProvider>
  );
}
