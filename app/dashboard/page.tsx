'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ActivityFeedView } from '@/frontend/freelancer/activity/activity-feed-view';
import { SettingsView } from '@/frontend/freelancer/settings/settings-view';
import { QuickActionsModal } from '@/frontend/freelancer/dashboard/components/quick-actions-modal';
import { Loader2 } from 'lucide-react';

function DashboardContent() {
  const router = useRouter();
  const { user, profile, isLoading, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string>('cli-1');
  const [workspaceChecked, setWorkspaceChecked] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Safety fallback: guarantee workspaceChecked resolves within 1s max
    const timer = setTimeout(() => {
      if (mounted) {
        setWorkspaceChecked(true);
      }
    }, 1000);

    async function verifyProfileAndWorkspace() {
      if (isLoading) return;

      // SECURITY: demo behavior is decided ONLY by the deployment's explicit
      // auth mode. localStorage flags and cookies can never activate it in production.
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
        const { supabase } = await import('@/backend/utilities/supabase');

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
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
      {currentView === 'workspace' && (
        <ClientWorkspaceShell
          clientId={selectedClientId}
          onBackToClients={() => setCurrentView('clients')}
        />
      )}
      {currentView === 'projects' && <ProjectsListView />}
      {currentView === 'deliverables' && (
        <DeliverablesListView onOpenClientWorkspace={handleOpenWorkspace} />
      )}
      {currentView === 'invoices' && <InvoicesListView />}
      {currentView === 'documents' && <DocumentsListView />}
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
        <DashboardContent />
      </AuthProvider>
    </ToastProvider>
  );
}
