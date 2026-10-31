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
  ArrowLeft,
  Clock,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { PermanentPortalDetails } from '@/shared/types';
import { Avatar } from '@/frontend/shared/ui/avatar';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const GoogleButton = ({
  onClick,
  isLoading,
  label = 'Continue with Google',
}: {
  onClick: () => void;
  isLoading?: boolean;
  label?: string;
}) => (
  <Button
    type="button"
    variant="outline"
    size="md"
    className="w-full h-11 min-h-[44px] justify-center bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 hover:text-white font-medium text-xs rounded-xl border-white/10 hover:border-white/25 transition-all shadow-sm"
    isLoading={isLoading}
    onClick={onClick}
    leftIcon={
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
    }
  >
    {label}
  </Button>
);

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
    isPending?: boolean;
    isOwner: boolean;
    clientId?: string;
    studioName?: string;
  } | null>(null);

  // Inline authentication mode ('options' | 'signin' | 'signup')
  const [formMode, setFormMode] = useState<'options' | 'signin' | 'signup'>('options');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [connectedClientId, setConnectedClientId] = useState<string | null>(null);

  // Private Mode Approval States
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isCheckingPendingStatus, setIsCheckingPendingStatus] = useState(false);
  const [pendingDetails, setPendingDetails] = useState<{ clientName?: string; company?: string; email?: string } | null>(null);

  // Automatic redirect effect whenever connectionSuccess becomes true
  useEffect(() => {
    if (connectionSuccess) {
      const destUrl = connectedClientId ? `/portal/${connectedClientId}` : '/client/dashboard';
      const timer = setTimeout(() => {
        window.location.href = destUrl;
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [connectionSuccess, connectedClientId]);

  // Periodic poll for pending client approval in Private Mode
  useEffect(() => {
    if (!isPendingApproval) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/portal/status?slug=${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isConnected && data.clientId) {
            setConnectedClientId(data.clientId);
            setIsPendingApproval(false);
            setConnectionSuccess(true);
          }
        }
      } catch {
        // ignore background poll errors
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isPendingApproval, slug]);

  const checkApprovalStatus = async () => {
    setIsCheckingPendingStatus(true);
    try {
      const res = await fetch(`/api/portal/status?slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.isConnected && data.clientId) {
          setConnectedClientId(data.clientId);
          setIsPendingApproval(false);
          setConnectionSuccess(true);
          return;
        }
      }
    } catch {
      // ignore
    } finally {
      setIsCheckingPendingStatus(false);
    }
  };

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
            if (isMounted) {
              setConnectionStatus(statusData);

              // If client request is pending approval in Private Mode, show waiting view
              if (statusData.isPending) {
                setIsPendingApproval(true);
                setPendingDetails({
                  clientName: user.user_metadata?.full_name || user.email?.split('@')[0],
                  company: user.user_metadata?.company_name || 'Client Workspace',
                  email: user.email,
                });
                return;
              }

              // If already connected, auto-open client workspace immediately
              if (statusData.isConnected && statusData.clientId) {
                setConnectedClientId(statusData.clientId);
                setConnectionSuccess(true);
                return;
              }

              // If authenticated client (not owner) and not yet connected, auto-connect
              if (!statusData.isOwner && !statusData.isConnected && !statusData.isPending) {
                const connectRes = await fetch('/api/portal/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ slug }),
                });
                const connectResult = await connectRes.json();
                if (connectResult.success) {
                  if (connectResult.requiresApproval || connectResult.status === 'pending') {
                    setIsPendingApproval(true);
                    setPendingDetails({
                      clientName: user.user_metadata?.full_name || user.email?.split('@')[0],
                      company: user.user_metadata?.company_name || 'Client Workspace',
                      email: user.email,
                    });
                    return;
                  }

                  const targetClientId = connectResult.clientId;
                  const targetWorkspaceId = connectResult.workspaceId;

                  if (typeof window !== 'undefined') {
                    try {
                      if (targetWorkspaceId) {
                        localStorage.setItem('flowdesk_active_client_workspace', targetWorkspaceId);
                      }
                      sessionStorage.setItem('flowdesk_workspace_mode', 'client');
                    } catch {
                      // ignore
                    }
                  }

                  setConnectedClientId(targetClientId);
                  setConnectionSuccess(true);
                  return;
                }
              }
            }
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

  // Initiate Google OAuth for client
  const handleGoogleLogin = () => {
    setIsSubmitting(true);
    setAuthError(null);
    const returnUrl = `/portal/join/${encodeURIComponent(slug)}`;
    window.location.assign(`/api/auth/oauth/google?next=${encodeURIComponent(returnUrl)}`);
  };

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

      if (result.requiresApproval || result.status === 'pending') {
        setIsPendingApproval(true);
        setPendingDetails({
          clientName: currentUser.email?.split('@')[0],
          company: 'Client Workspace',
          email: currentUser.email,
        });
        return;
      }

      const targetClientId = result.clientId;
      const targetWorkspaceId = result.workspaceId;

      if (typeof window !== 'undefined') {
        try {
          if (targetWorkspaceId) {
            localStorage.setItem('flowdesk_active_client_workspace', targetWorkspaceId);
          }
          sessionStorage.setItem('flowdesk_workspace_mode', 'client');
        } catch {
          // ignore
        }
      }

      setConnectedClientId(targetClientId);
      setConnectionSuccess(true);
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle existing client login directly on this connection page
  const handleSignInAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Email and password are required.');
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
        if (result.requiresApproval || result.status === 'pending') {
          setIsPendingApproval(true);
          setPendingDetails({
            clientName: email.split('@')[0],
            company: 'Client Workspace',
            email: email.trim().toLowerCase(),
          });
          return;
        }
        const targetClientId = result.clientId || 'cli-demo-001';
        setConnectedClientId(targetClientId);
        setConnectionSuccess(true);
        return;
      }

      // Authenticate directly through Supabase
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        throw signInErr;
      }

      if (!authData.user) {
        throw new Error('Sign in failed.');
      }

      setCurrentUser({ id: authData.user.id, email: authData.user.email });

      // Directly connect client to this freelancer workspace
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

      if (result.requiresApproval || result.status === 'pending') {
        setIsPendingApproval(true);
        setPendingDetails({
          clientName: authData.user.user_metadata?.full_name || email.split('@')[0],
          company: authData.user.user_metadata?.company_name || 'Client Workspace',
          email: email.trim().toLowerCase(),
        });
        return;
      }

      const targetClientId = result.clientId;
      const targetWorkspaceId = result.workspaceId;

      if (typeof window !== 'undefined') {
        try {
          if (targetWorkspaceId) {
            localStorage.setItem('flowdesk_active_client_workspace', targetWorkspaceId);
          }
          sessionStorage.setItem('flowdesk_workspace_mode', 'client');
        } catch {
          // ignore
        }
      }

      setConnectedClientId(targetClientId);
      setConnectionSuccess(true);
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during sign in.');
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
    if (!fullName.trim()) {
      setAuthError('Full name is required.');
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
        if (result.requiresApproval || result.status === 'pending') {
          setIsPendingApproval(true);
          setPendingDetails({
            clientName: fullName.trim(),
            company: companyName.trim() || `${fullName.trim()} Workspace`,
            email: email.trim().toLowerCase(),
          });
          return;
        }
        const targetClientId = result.clientId || 'cli-demo-001';
        setConnectedClientId(targetClientId);
        setConnectionSuccess(true);
        return;
      }

      // 1. Create client account via server endpoint with email_confirm: true
      const registerRes = await fetch('/api/portal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          fullName: fullName.trim(),
          companyName: companyName.trim() || `${fullName.trim()} Organization`,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok || !registerData.success) {
        if (registerData.code === 'USER_EXISTS') {
          setFormMode('signin');
          setAuthError('An account with this email is already registered. Please sign in with your password to connect.');
          return;
        }
        throw new Error(registerData.error || 'Failed to create account.');
      }

      // 2. Sign in immediately to establish session and cookies
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr || !signInData.user) {
        throw new Error(signInErr?.message || 'Account created, but sign in failed. Please sign in.');
      }

      setCurrentUser({ id: signInData.user.id, email: signInData.user.email });

      // 3. Connect client to this freelancer workspace
      const connectRes = await fetch('/api/portal/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const connectResult = await connectRes.json();

      if (!connectRes.ok || !connectResult.success) {
        throw new Error(connectResult.error || 'Failed to link account to freelancer workspace.');
      }

      if (connectResult.requiresApproval || connectResult.status === 'pending') {
        setIsPendingApproval(true);
        setPendingDetails({
          clientName: fullName.trim(),
          company: companyName.trim() || `${fullName.trim()} Workspace`,
          email: email.trim().toLowerCase(),
        });
        return;
      }

      const targetClientId = connectResult.clientId;
      const targetWorkspaceId = connectResult.workspaceId;

      if (typeof window !== 'undefined') {
        try {
          if (targetWorkspaceId) {
            localStorage.setItem('flowdesk_active_client_workspace', targetWorkspaceId);
          }
          sessionStorage.setItem('flowdesk_workspace_mode', 'client');
        } catch {
          // ignore
        }
      }

      setConnectedClientId(targetClientId);
      setConnectionSuccess(true);
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

  // 3b. Pending Approval State (Private Mode Verification Queue)
  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-amber-500/30">
        <Card variant="crystal" className="max-w-lg w-full p-8 text-center space-y-6 border-amber-500/30 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto text-amber-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5" /> Studio Private Mode
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Connection Request Submitted</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your request to connect with <strong>{details.studioName || details.freelancerName}</strong> has been received. In Private Mode, the freelancer reviews and approves each client before granting workspace access.
            </p>
          </div>

          {/* Client Details Preview Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 text-left space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Submitted Client Details
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500">Full Name</span>
                <span className="font-medium text-white">{pendingDetails?.clientName || fullName || currentUser?.email || 'Client'}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500">Company / Workspace</span>
                <span className="font-medium text-white">{pendingDetails?.company || companyName || 'Client Organization'}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500">Email Address</span>
                <span className="font-mono text-zinc-300">{pendingDetails?.email || email || currentUser?.email}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-500">Status</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Pending Verification
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full justify-center gap-2"
              isLoading={isCheckingPendingStatus}
              onClick={checkApprovalStatus}
            >
              <RefreshCw className="w-4 h-4" /> Check Approval Status
            </Button>
            <p className="text-[11px] text-zinc-500">
              This page automatically checks for updates in the background. Once the freelancer approves your connection, your workspace will open automatically.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Success state (Direct auto-transition, Open Workspace button removed)
  if (connectionSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4 sm:p-6 selection:bg-emerald-500/30">
        <Card variant="crystal" className="max-w-md w-full p-8 text-center space-y-6 border-emerald-500/40 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connected Successfully!</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your FlowDesk client account is now connected to <strong>{details.studioName || details.freelancerName}</strong>. Opening your workspace...
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Opening your client workspace...</span>
          </div>
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
        <div className="text-center">
          <div className="inline-block">
            <FlowDeskLogo className="h-8 w-auto mx-auto" />
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
          ) : formMode === 'signin' ? (
            /* Branch B: Inline Sign In Form for Clients */
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Sign In to Your Client Account</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sign in to connect with {details.studioName || details.freelancerName}.
                </p>
              </div>

              {/* Google OAuth Option */}
              <div className="space-y-3 pt-1">
                <GoogleButton onClick={handleGoogleLogin} isLoading={isSubmitting} />

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                    <span className="bg-[#121215] px-2 text-zinc-500">OR SIGN IN WITH EMAIL</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSignInAndConnect} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Work Email</label>
                  <Input
                    type="email"
                    required
                    placeholder="you@company.com"
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
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center gap-2 mt-2 py-2.5"
                  isLoading={isSubmitting}
                >
                  Sign In & Connect <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setFormMode('options');
                  }}
                  className="text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to options
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setFormMode('signup');
                  }}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  New Client? Create Account
                </button>
              </div>
            </div>
          ) : formMode === 'signup' ? (
            /* Branch C: Inline Sign Up Form for New Clients */
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Create your FlowDesk client account</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Connect with {details.studioName || details.freelancerName} using one unified client account.
                </p>
              </div>

              {/* Google OAuth Option */}
              <div className="space-y-3 pt-1">
                <GoogleButton onClick={handleGoogleLogin} isLoading={isSubmitting} label="Sign up with Google" />

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                    <span className="bg-[#121215] px-2 text-zinc-500">OR REGISTER WITH EMAIL</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSignUpAndConnect} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Full Name</label>
                  <Input
                    required
                    placeholder="e.g. Sunil Yadav"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Company / Organization</label>
                  <Input
                    placeholder="e.g. Nex Mind"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Work Email</label>
                  <Input
                    type="email"
                    required
                    placeholder="nexmind0921@gmail.com"
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

              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setFormMode('options');
                  }}
                  className="text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to options
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setFormMode('signin');
                  }}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Existing User? Sign In
                </button>
              </div>
            </div>
          ) : (
            /* Branch D: Unauthenticated Landing (Options: Google, Sign In or Register) */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-white">Connect with {details.studioName}</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Sign in with your existing FlowDesk account or create a new client account to access project deliverables, invoices, and documents.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <GoogleButton onClick={handleGoogleLogin} isLoading={isSubmitting} />

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                    <span className="bg-[#121215] px-2 text-zinc-500">OR USE EMAIL</span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center gap-2 py-3"
                  onClick={() => {
                    setAuthError(null);
                    setFormMode('signin');
                  }}
                >
                  Sign In with Existing Account <ArrowRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center gap-2 py-3"
                  onClick={() => {
                    setAuthError(null);
                    setFormMode('signup');
                  }}
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
