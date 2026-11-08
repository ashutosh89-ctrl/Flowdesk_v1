'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isDemoMode } from '@/backend/utilities/supabase';
import { AuthProvider, useAuth } from '@/frontend/auth/auth-context';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { AppShell } from '@/frontend/shared/layout/app-shell';
import { DashboardView } from '@/frontend/freelancer/dashboard/dashboard-view';
import { ClientsListView } from '@/frontend/freelancer/clients/clients-list-view';
import { ClientWorkspaceShell } from '@/frontend/freelancer/workspace/client-workspace-shell';
import { ProjectsListView } from '@/frontend/freelancer/projects/projects-list-view';
import { DeliverablesListView } from '@/frontend/freelancer/deliverables/deliverables-list-view';
import { InvoicesListView } from '@/frontend/freelancer/invoices/invoices-list-view';
import { DocumentsListView } from '@/frontend/freelancer/documents/documents-list-view';
import { TasksView } from '@/frontend/freelancer/tasks/tasks-view';
import { ReportsView } from '@/frontend/freelancer/reports/reports-view';
import { ActivityFeedView } from '@/frontend/freelancer/activity/activity-feed-view';
import { SettingsView } from '@/frontend/freelancer/settings/settings-view';
import { QuickActionsModal } from '@/frontend/freelancer/dashboard/components/quick-actions-modal';
import { Loader2, AlertCircle } from 'lucide-react';

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#101312] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Something went wrong loading your dashboard</h2>
          <p className="text-xs text-zinc-400 max-w-md">
            {this.state.error?.message || 'An unexpected client error occurred. Please try reloading.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#43D6B0] text-[#101312] font-semibold text-xs rounded-xl hover:bg-[#43D6B0]/90 transition-colors"
            >
              Reload Dashboard
            </button>
            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem('flowdesk_workspace_mode');
                } catch {}
                window.location.href = '/login';
              }}
              className="px-4 py-2 bg-white/10 text-white font-medium text-xs rounded-xl hover:bg-white/20 transition-colors"
            >
              Sign In Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const requestedClient = searchParams.get('clientId');

  const { user, profile, isLoading, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<string>(requestedView || 'dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(requestedClient || null);
  const [workspaceChecked, setWorkspaceChecked] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  useEffect(() => {
    if (requestedView) {
      setCurrentView(requestedView);
    }
    if (requestedClient) {
      setSelectedClientId(requestedClient);
    }
  }, [requestedView, requestedClient]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted) setWorkspaceChecked(true);
    }, 3000);

    async function verifyProfileAndWorkspace() {
      if (isLoading) return;

      if (isDemoMode) {
        if (mounted) {
          setWorkspaceChecked(true);
          clearTimeout(timer);
        }
        return;
      }

      if (!isAuthenticated || !user) {
        router.replace('/login');
        return;
      }

      try {
        const workspaceMode = typeof window !== 'undefined'
          ? sessionStorage.getItem('flowdesk_workspace_mode')
          : null;

        const rolesResponse = await fetch('/api/auth/roles', { cache: 'no-store' });
        const roles = await rolesResponse.json();

        if (!rolesResponse.ok || !roles.authenticated) {
          router.replace('/login?error=Unable%20to%20determine%20workspace');
          return;
        }

        if (workspaceMode === 'client') {
          router.replace('/client/dashboard');
          return;
        }

        if (roles.freelancer && roles.client && workspaceMode !== 'freelancer') {
          router.replace('/auth/choose-role');
          return;
        }

        if (!roles.freelancer) {
          if (roles.client) {
            router.replace('/client/dashboard');
          } else {
            router.replace('/onboarding');
          }
          return;
        }

        if (typeof window !== 'undefined' && workspaceMode !== 'freelancer') {
          sessionStorage.setItem('flowdesk_workspace_mode', 'freelancer');
        }

        const { supabase } = await import('@/backend/utilities/supabase');
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (profErr && profErr.code !== 'PGRST116') {
          console.warn('Dashboard profile check notice:', profErr.message);
        }

        if (prof && !prof.onboarding_completed && !profile?.onboardingCompleted) {
          router.replace('/onboarding');
          return;
        }
      } catch (err) {
        console.warn('Workspace verification exception:', err);
      }

      if (mounted) {
        setWorkspaceChecked(true);
        clearTimeout(timer);
      }
    }

    verifyProfileAndWorkspace();

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isLoading, isAuthenticated, user, profile, router]);

  if (isLoading || !workspaceChecked) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  const isDemo = isDemoMode;
  const fallbackName = user?.email?.split('@')[0] || (isDemo ? 'Alex Rivera' : 'User');
  const userProfile = {
    id: user?.id || (isDemo ? 'usr-demo-alex' : ''),
    name: profile?.name || (isDemo ? 'Alex Rivera' : fallbackName),
    title: profile?.title || (isDemo ? 'Principal Product Designer & Strategist' : 'Freelance Specialist'),
    email: user?.email || (isDemo ? 'alex@riveradesign.co' : ''),
    avatarUrl: user?.user_metadata?.avatar_url || profile?.avatarUrl || '',
    currency: profile?.currency || 'USD',
    companyName: profile?.companyName || (isDemo ? 'Rivera Studio' : 'My Workspace'),
    hourlyRate: profile?.hourlyRate || 150,
    taxRate: 10,
    notificationsEnabled: true,
    profession: profile?.profession || 'Product & Brand Design',
    country: profile?.country || 'India',
    timezone: profile?.timezone || 'Asia/Kolkata',
    language: 'English',
    onboardingCompleted: true,
  };

  const handleOpenWorkspace = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('workspace');
  };

  return (
    <>
      <AppShell
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onSwitchViewMode={() => router.push('/')}
        userProfile={userProfile}
        breadcrumbLabel={currentView === 'workspace' ? 'Client Workspace' : undefined}
        onQuickAction={() => setIsQuickActionsOpen(true)}
      >
        {currentView === 'dashboard' && (
          <DashboardView
            onNavigate={(v) => setCurrentView(v)}
            onOpenClientWorkspace={handleOpenWorkspace}
            onQuickAction={() => setIsQuickActionsOpen(true)}
          />
        )}
        {currentView === 'clients' && <ClientsListView onOpenWorkspace={handleOpenWorkspace} />}
        {currentView === 'workspace' && selectedClientId && (
          <ClientWorkspaceShell
            clientId={selectedClientId}
            onBackToClients={() => setCurrentView('clients')}
          />
        )}
        {currentView === 'projects' && <ProjectsListView />}
        {currentView === 'tasks' && <TasksView />}
        {currentView === 'deliverables' && <DeliverablesListView onOpenClientWorkspace={handleOpenWorkspace} />}
        {currentView === 'invoices' && <InvoicesListView />}
        {currentView === 'documents' && <DocumentsListView />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'activity' && <ActivityFeedView />}
        {currentView === 'settings' && <SettingsView />}
      </AppShell>

      <QuickActionsModal
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onNavigate={(view) => setCurrentView(view)}
        onRefresh={() => {}}
      />
    </>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#101312] text-zinc-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#43D6B0]" />
              <p className="text-xs font-mono">Loading FlowDesk...</p>
            </div>
          }
        >
          <DashboardErrorBoundary>
            <DashboardContent />
          </DashboardErrorBoundary>
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
