'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabase';
import { AuthProvider, useAuth } from '@/src/context/auth-context';
import { ToastProvider } from '@/src/components/ui/toast';
import { AppShell } from '@/src/components/layout/app-shell';
import { DashboardView } from '@/src/features/dashboard/dashboard-view';
import { ClientsListView } from '@/src/features/clients/clients-list-view';
import { ClientWorkspaceShell } from '@/src/features/workspace/client-workspace-shell';
import { ProjectsListView } from '@/src/features/projects/projects-list-view';
import { DeliverablesListView } from '@/src/features/deliverables/deliverables-list-view';
import { InvoicesListView } from '@/src/features/invoices/invoices-list-view';
import { ActivityFeedView } from '@/src/features/activity/activity-feed-view';
import { SettingsView } from '@/src/features/settings/settings-view';
import { Loader2 } from 'lucide-react';

function DashboardContent() {
  const router = useRouter();
  const { user, profile, isLoading, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string>('cli-1');
  const [workspaceChecked, setWorkspaceChecked] = useState(false);

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

      if (!isAuthenticated || !user) {
        router.replace('/login');
        return;
      }

      try {
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

  const fallbackName = user?.email?.split('@')[0] || 'User';
  const userProfile = {
    id: user?.id || '',
    name: profile ? profile.name : fallbackName,
    title: profile ? profile.title : 'Freelance Specialist',
    email: user?.email || '',
    avatarUrl: user?.user_metadata?.avatar_url || '',
    currency: 'USD',
    companyName: profile ? profile.companyName : 'My Workspace',
    hourlyRate: 150,
    taxRate: 10,
    notificationsEnabled: true,
    profession: '',
    country: 'United States',
    timezone: 'America/New_York',
    language: 'English',
    onboardingCompleted: true,
  };

  const handleOpenWorkspace = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('workspace');
  };

  return (
    <AppShell
      currentView={currentView}
      onNavigate={(view) => setCurrentView(view)}
      onSwitchViewMode={() => router.push('/')}
      userProfile={userProfile}
      breadcrumbLabel={currentView === 'workspace' ? 'Client Workspace' : undefined}
    >
      {currentView === 'dashboard' && (
        <DashboardView
          onNavigate={(v) => setCurrentView(v)}
          onOpenClientWorkspace={handleOpenWorkspace}
          onQuickAction={() => setCurrentView('clients')}
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
      {currentView === 'activity' && <ActivityFeedView />}
      {currentView === 'settings' && <SettingsView />}
    </AppShell>
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
