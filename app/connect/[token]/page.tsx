'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Building2,
  Mail,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { PublicInvitationDetails } from '@/shared/types';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ConnectInvitationPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PublicInvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (isMounted && user) {
          setCurrentUser({ id: user.id, email: user.email });
        }

        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (isMounted) {
          setDetails(data);
          if (!data.isValid) {
            setErrorMessage(data.error || 'This connection link is not valid.');
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to verify connection link.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleClaimDirectly = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, email: currentUser.email }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        setAuthError(result.error || 'Failed to claim invitation.');
        return;
      }

      setClaimSuccess(true);
      setTimeout(() => {
        router.replace(result.clientId ? `/portal/${result.clientId}` : '/client/dashboard');
      }, 900);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to claim invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      if (isDemoModeActive()) {
        const claimRes = await fetch(`/api/invitations/${encodeURIComponent(token)}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'usr-demo-client', email }),
        });
        const result = await claimRes.json();
        if (!claimRes.ok || !result.success) {
          setAuthError(result.error || 'Failed to connect.');
          return;
        }
        setClaimSuccess(true);
        setTimeout(() => router.replace(`/portal/${result.clientId || 'cli-1'}`), 900);
        return;
      }

      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'client',
          },
        },
      });

      if (signUpErr) {
        // Do not create a second client login form here. Existing clients use
        // the same shared /login page, with the invitation token preserved.
        if (signUpErr.message.toLowerCase().includes('already registered')) {
          router.replace(`/login?connect=${encodeURIComponent(token)}`);
          return;
        }
        throw signUpErr;
      }

      if (!authData.user) {
        throw new Error('Sign up failed.');
      }

      const claimRes = await fetch(`/api/invitations/${encodeURIComponent(token)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id, email: authData.user.email }),
      });
      const result = await claimRes.json();

      if (!claimRes.ok || !result.success) {
        setAuthError(result.error || 'Account created, but could not connect invitation.');
        return;
      }

      setClaimSuccess(true);
      setTimeout(() => {
        router.replace(result.clientId ? `/portal/${result.clientId}` : '/client/dashboard');
      }, 900);
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-9 h-9 animate-spin text-emerald-400 mx-auto" />
          <p className="text-xs text-zinc-400 font-mono tracking-wider">Verifying Connection Link...</p>
        </div>
      </div>
    );
  }

  if (details?.status === 'claimed') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-white/20 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connection Link Already Used</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This connection link has already been used. If you are the client, use the shared FlowDesk login and you will be routed automatically to your workspace.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full justify-center gap-2"
            onClick={() => router.push('/login')}
          >
            Continue to FlowDesk Login <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    );
  }

  if (!details?.isValid || details.status !== 'pending') {
    const isExpired = details?.status === 'expired';
    const isRevoked = details?.status === 'revoked';

    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-white/20 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isExpired ? 'Connection Link Expired' : isRevoked ? 'Connection Link Revoked' : 'Invalid Connection Link'}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isExpired
                ? 'This connection link has expired. Please contact your freelancer to request a new connection link.'
                : isRevoked
                ? 'This invitation link has been revoked by the sender. Please contact your freelancer.'
                : errorMessage || 'This connection link is invalid or does not exist.'}
            </p>
          </div>
          <Button variant="secondary" className="w-full justify-center" onClick={() => router.push('/')}>
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (claimSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-5 border-emerald-500/40 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connected Successfully!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your account has been connected to <strong>{details.freelancerName}</strong>. Opening your portal workspace...
            </p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mx-auto mt-2" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-block">
            <FlowDeskLogo className="h-8 w-auto mx-auto" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" /> Client Portal Connection
          </div>
        </div>

        <Card variant="crystal" className="p-6 sm:p-8 space-y-6 border-white/20 shadow-2xl backdrop-blur-xl">
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Invited By</p>
                <h3 className="text-sm font-bold text-white">{details.freelancerName}</h3>
                {details.companyName && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    For client workspace: <span className="text-zinc-200 font-medium">{details.companyName}</span>
                  </p>
                )}
              </div>
            </div>
            {details.maskedEmail && (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono pt-1 border-t border-white/5">
                <Mail className="w-3 h-3 text-zinc-500" />
                <span>Sent to: {details.maskedEmail}</span>
              </div>
            )}
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {currentUser ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 text-xs text-zinc-300 flex items-center justify-between">
                <span>Signed in as: <strong className="text-white">{currentUser.email}</strong></span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Authenticated</span>
              </div>
              <Button
                variant="primary"
                className="w-full justify-center gap-2 py-3"
                isLoading={isSubmitting}
                onClick={handleClaimDirectly}
              >
                <ShieldCheck className="w-4 h-4" /> Accept & Connect Workspace
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Create your client account</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  New to FlowDesk? Create your account here and this connection will be attached automatically.
                </p>
              </div>

              <form onSubmit={handleSignUpAndConnect} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Your Full Name</label>
                  <Input placeholder="e.g. Eleanor Vance" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Email Address</label>
                  <Input type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Choose a Password</label>
                  <Input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-[10px] text-zinc-500">Minimum 6 characters</p>
                </div>

                <Button type="submit" variant="primary" className="w-full justify-center gap-2 mt-2 py-2.5" isLoading={isSubmitting}>
                  Create Account & Connect <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-3 border-t border-white/5 text-center space-y-2">
                <p className="text-[11px] text-zinc-500">Already have a FlowDesk account?</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-center gap-2"
                  onClick={() => router.push(`/login?connect=${encodeURIComponent(token)}`)}
                >
                  Continue to Shared Login <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="text-center pt-1 border-t border-white/5">
            <p className="text-[11px] text-zinc-500">
              Your connection is secured by FlowDesk&apos;s one-time invitation link.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
