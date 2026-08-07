'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../src/context/auth-context';
import { LandingPage } from '../src/features/landing/landing-page';
import { AppShell } from '../src/components/layout/app-shell';
import { DashboardView } from '../src/features/dashboard/dashboard-view';
import { ClientsListView } from '../src/features/clients/clients-list-view';
import { ClientWorkspaceShell } from '../src/features/workspace/client-workspace-shell';
import { ProjectsListView } from '../src/features/projects/projects-list-view';
import { DeliverablesListView } from '../src/features/deliverables/deliverables-list-view';
import { InvoicesListView } from '../src/features/invoices/invoices-list-view';
import { ActivityFeedView } from '../src/features/activity/activity-feed-view';
import { SettingsView } from '../src/features/settings/settings-view';
import { AuthModal, AuthModalView } from '../src/features/auth/auth-modal';
import { ToastProvider } from '../src/components/ui/toast';
import { mockUserProfile } from '../src/mock/mockData';
import { Loader2, ShieldCheck } from 'lucide-react';

function FlowDeskAppContent() {
  const {
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

  // Auto-switch to app when authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (!isOnboarded) {
        const timer = setTimeout(() => {
          setAuthInitialView('onboarding');
          setIsAuthModalOpen(true);
        }, 0);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setViewMode('app');
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, isAuthenticated, isOnboarded]);

  const handleOpenAuth = (initialView: AuthModalView = 'login') => {
    setAuthInitialView(initialView);
    setIsAuthModalOpen(true);
  };

  const handleLaunchApp = () => {
    if (!isAuthenticated) {
      handleOpenAuth('login');
    } else if (!isOnboarded) {
      handleOpenAuth('onboarding');
    } else {
      setViewMode('app');
    }
  };

  const handleOpenWorkspace = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('workspace');
  };

  // Full Screen Loading Skeleton State
  if (isLoading) {
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
          userProfile={profile || mockUserProfile}
          breadcrumbLabel={
            currentView === 'workspace' ? 'Client Workspace' : undefined
          }
        >
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={(v) => setCurrentView(v)}
              onOpenClientWorkspace={handleOpenWorkspace}
              onQuickAction={() => setCurrentView('clients')}
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

          {currentView === 'activity' && <ActivityFeedView />}

          {currentView === 'settings' && <SettingsView />}
        </AppShell>
      )}

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
