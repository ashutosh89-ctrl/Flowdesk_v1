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
  User,
  Sparkles,
  ExternalLink,
  AlertCircle,
  Briefcase,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { PermanentPortalDetails } from '@/shared/types';
import { Avatar } from '@/frontend/shared/ui/avatar';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PermanentPortalJoinPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PermanentPortalDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    isOwner: boolean;
    clientId?: string;
    studioName?: string;
  } | null>(null);

  // Inline sign-up form state
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [connectedClientId, setConnectedClientId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setLoading(true);

        // 1. Resolve permanent portal public details
        const res = await fetch(`/api/portal/resolve?slug=${encodeURIComponent(slug)}`);
        const data: PermanentPortalDetails = await res.json();

        if (!isMounted) return;

        if (!res.ok || !data.valid) {
          setDetails({ valid: false, error: data.error || 'Portal link is invalid or does not exist.' });
          setErrorMessage(data.error || 'This freelancer portal link does not exist.');
          setLoading(false);
          return;
        }

        setDetails(data);

        // 2. Check authenticated user session
        let user = null;
        if (isDemoModeActive()) {
          // Check demo cookie/session
          const hasDemoClient = typeof document !== 'undefined' && document.cookie.includes('flowdesk_client_demo');
          if (hasDemoClient) {
            user = { id: 'usr-demo-client', email: 'eleanor@apexdigital.io' };
          }
        } else {
          const { data: authData } = await supabase.auth.getUser();
          user = authData?.user || null;
        }

        if (user && isMounted) {
          setCurrentUser({ id: user.id, email: user.email });

          // 3. Check connection status for authenticated user
          const statusRes = await fetch(`/api/portal/status?slug=${encodeURIComponent(slug)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (isMounted) setConnectionStatus(statusData);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage('Unable to verify connection link at this time.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Handle explicit confirmation to connect for authenticated client
  const handleConfirmConnection = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/portal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        setAuthError(result.error || 'Failed to establish connection.');
        return;
      }

      setConnectedClientId(result.clientId);
      setConnectionSuccess(true);

      // Redirect after showing positive confirmation
      setTimeout(() => {
        router.replace(result.clientId ? `/portal/${result.clientId}` : '/client/dashboard');
      }, 1100);
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle new client registration & connection
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
        const res = await fetch('/api/portal/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        const result = await res.json();
        setConnectedClientId(result.clientId || 'cli-demo-001');
        setConnectionSuccess(true);
        setTimeout(() => router.replace(`/portal/${result.clientId || 'cli-demo-001'}`), 1000);
        return;
      }

      // Supabase signup with next destination preserved
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
            role: 'client',
          },
          emailRedirectTo: typeof window !== 'undefined'
            ? `${window.location.origin}/portal/join/${encodeURIComponent(slug)}`
            : undefined,
        },
      });

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already registered')) {
          router.replace(`/login?next=${encodeURIComponent('/portal/join/' + slug)}`);
          return;
        }
        throw signUpErr;
      }

      if (!authData.user) {
        throw new Error('Sign up failed.');
      }

      // Check if session was granted immediately (email confirmation disabled)
      if (authData.session) {
        setCurrentUser({ id: authData.user.id, email: authData.user.email });
        // Automatically proceed to explicit confirmation view
        setShowSignUpForm(false);
      } else {
        // Email verification required
        setConnectionSuccess(true);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mx-auto" />
          <p className="text-xs text-zinc-400 font-mono tracking-wider">Verifying Freelancer Portal...</p>
        </div>
      </div>
    );
  }

  // 2. Invalid or Not Found state
  if (!details?.valid) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-white/20 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Portal Link Unavailable</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {errorMessage || 'This freelancer connection link does not exist or has been disabled. Please verify the URL with the freelancer.'}
            </p>
          </div>
          <Button variant="secondary" className="w-full justify-center" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to FlowDesk Home
          </Button>
        </Card>
      </div>
    );
  }

  // 3. Not accepting connections
  if (!details.isAcceptingConnections) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-amber-500/30 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connections Currently Closed</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              <strong>{details.studioName || details.freelancerName}</strong> is not accepting new client connections at this time. Existing client workspaces remain active.
            </p>
          </div>
          <div className="pt-2">
            <Button variant="secondary" className="w-full justify-center" onClick={() => router.push('/login')}>
              Sign In to Existing Account <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Success state
  if (connectionSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-5 border-emerald-500/40 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connected Successfully!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your FlowDesk client account is now connected to <strong>{details.studioName || details.freelancerName}</strong>. Opening your workspace...
            </p>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mt-2" />
        </Card>
      </div>
    );
  }

  // 5. Workspace Owner preventing self-connection
  if (currentUser && connectionStatus?.isOwner) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-white/20 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto text-sky-400">
            <Briefcase className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Your Freelancer Workspace</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              You are signed in as the owner of <strong>{details.studioName}</strong>. Freelancers cannot connect to their own workspace as a client.
            </p>
          </div>
          <Button variant="primary" className="w-full justify-center gap-2" onClick={() => router.push('/dashboard')}>
            Go to Freelancer Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    );
  }

  // 6. Already connected state
  if (currentUser && connectionStatus?.isConnected) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-emerald-500/30 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Already Connected</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your FlowDesk account is already connected to <strong>{details.studioName || details.freelancerName}</strong>.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full justify-center gap-2 py-3"
            onClick={() => {
              if (connectionStatus.clientId) {
                router.push(`/portal/${connectionStatus.clientId}`);
              } else {
                router.push('/client/dashboard');
              }
            }}
          >
            Open {details.studioName || 'Workspace'} <ExternalLink className="w-4 h-4" />
          </Button>
        </Card>
      </div>
    );
  }

  // 7. Main Connect Screen
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-block">
            <FlowDeskLogo className="h-8 w-auto mx-auto" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" /> Permanent Client Portal
          </div>
        </div>

        {/* Public Freelancer Profile Card */}
        <Card variant="crystal" className="p-6 sm:p-8 space-y-6 border-white/20 shadow-2xl backdrop-blur-xl">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3">
            <div className="flex items-center gap-3.5">
              <Avatar
                src={details.avatarUrl}
                name={details.freelancerName || 'Freelancer'}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                  Verified Freelancer
                </span>
                <h3 className="text-base font-bold text-white truncate">
                  {details.studioName || details.freelancerName}
                </h3>
                <p className="text-xs text-zinc-400 truncate">
                  {details.profession || 'Independent Professional'}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-zinc-500" /> Multi-Freelancer Hub
              </span>
              <span className="text-emerald-400 font-mono">● Accepting Connections</span>
            </div>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Branch A: Authenticated Client -> Explicit Confirmation Screen */}
          {currentUser ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Signed in as:</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Authenticated
                  </span>
                </div>
                <div className="text-sm font-bold text-white truncate">{currentUser.email}</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                  Connecting will attach <strong>{details.studioName}</strong> to your FlowDesk account. You can switch between all your connected freelancers anytime.
                </p>
              </div>

              <Button
                variant="primary"
                className="w-full justify-center gap-2 py-3"
                isLoading={isSubmitting}
                onClick={handleConfirmConnection}
              >
                <ShieldCheck className="w-4 h-4" /> Confirm & Connect Workspace
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
                >
                  Not {currentUser.email}? Sign in with a different account
                </button>
              </div>
            </div>
          ) : showSignUpForm ? (
            /* Branch B: Inline Sign Up Form for New Clients */
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Create your FlowDesk client account</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Connect with multiple freelancers using one unified client account.
                </p>
              </div>

              <form onSubmit={handleSignUpAndConnect} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Full Name</label>
                  <Input
                    required
                    placeholder="e.g. Eleanor Vance"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Company / Organization</label>
                  <Input
                    placeholder="e.g. Apex Digital"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Work Email</label>
                  <Input
                    type="email"
                    required
                    placeholder="eleanor@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Password</label>
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-[10px] text-zinc-500">Minimum 6 characters</p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center gap-2 mt-2 py-2.5"
                  isLoading={isSubmitting}
                >
                  Create Account & Connect <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowSignUpForm(false)}
                  className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to options
                </button>
              </div>
            </div>
          ) : (
            /* Branch C: Unauthenticated Landing (Options: Sign In or Register) */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-white">Connect with {details.studioName}</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Sign in with your existing FlowDesk account or create a new client account to access project deliverables, invoices, and documents.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center gap-2 py-3"
                  onClick={() => router.push(`/login?next=${encodeURIComponent('/portal/join/' + slug)}`)}
                >
                  Sign In with Existing Account <ArrowRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center gap-2 py-3"
                  onClick={() => setShowSignUpForm(true)}
                >
                  <User className="w-4 h-4" /> New Client? Create Free Account
                </Button>
              </div>

              <div className="pt-2 border-t border-white/5 text-center">
                <p className="text-[11px] text-zinc-500">
                  One account connects to all your freelancers with complete data isolation.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
