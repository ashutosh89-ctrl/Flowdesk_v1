'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/frontend/auth/auth-context';
import { LandingPage } from '@/frontend/landing/landing-page';
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
import { AuthModal, AuthModalView } from '@/frontend/auth/auth-modal';
import { ToastProvider } from '@/frontend/shared/ui/toast';
import { Loader2, ShieldCheck } from 'lucide-react';

function FlowDeskAppContent() {
  const router = useRouter();
  const {
    user,
    profile,
    isLoading,
    isAuthenticated,
    isOnboarded,
  } = useAuth();

  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string>('cli-1');

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialView, setAuthInitialView] = useState<AuthModalView>('login');

  // Quick Actions Modal State (shared between TopNav 'New' and Dashboard 'Create')
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  // Auto-switch to app when authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (!isOnboarded) {
        router.push('/onboarding');
      } else {
        const timer = setTimeout(() => setViewMode('app'), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, isAuthenticated, isOnboarded, router]);

  const handleOpenAuth = (initialView: AuthModalView = 'login') => {
    if (initialView === 'login') {
      router.push('/login');
    } else if (initialView === 'signup') {
      router.push('/signup');
    } else if (initialView === 'onboarding') {
      router.push('/onboarding');
    } else {
      setAuthInitialView(initialView);
      setIsAuthModalOpen(true);
    }
  };

  const handleLaunchApp = () => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (!isOnboarded) {
      router.push('/onboarding');
    } else {
      setViewMode('app');
    }
  };

  const handleOpenWorkspace = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('workspace');
  };

  // When switching to 'app' or explicitly loading authenticated view, show loading skeleton
  if (isLoading && viewMode === 'app') {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-zinc-900/60 border border-white/10 flex flex-col items-center max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">FlowDesk OS</h3>
            <p className="text-xs text-zinc-400 mt-1">Verifying identity & restoring persistent session...</p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Supabase Auth & RLS Guard Active</span>
          </div>
        </div>
      </div>
    );
  }

  const fallbackName = user?.email?.split('@')[0] || 'User';
  const activeUserProfile = {
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
    country: 'India',
    timezone: 'Asia/Kolkata',
    language: 'English',
    onboardingCompleted: Boolean(isOnboarded),
  };

  return (
    <>
      {viewMode === 'landing' ? (
        <LandingPage
          onLaunchApp={handleLaunchApp}
          onOpenAuth={(view) => handleOpenAuth(view)}
        />
      ) : (
        <AppShell
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          onSwitchViewMode={(mode) => setViewMode(mode)}
          userProfile={activeUserProfile}
          breadcrumbLabel={
            currentView === 'workspace' ? 'Client Workspace' : undefined
          }
        >
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={(v) => setCurrentView(v)}
              onOpenClientWorkspace={handleOpenWorkspace}
              onQuickAction={() => setIsQuickActionsOpen(true)}
            />
          )}

          {currentView === 'clients' && (
            <ClientsListView onOpenWorkspace={handleOpenWorkspace} />
          )}

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
      )}

      {/* Global Quick Actions Modal (shared between TopNav 'New' and Dashboard) */}
      <QuickActionsModal
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onNavigate={(view) => setCurrentView(view)}
        onRefresh={() => {}}
      />

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialView={authInitialView}
        onAuthSuccess={() => setViewMode('app')}
      />
    </>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FlowDeskAppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
