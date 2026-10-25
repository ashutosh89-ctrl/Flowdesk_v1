'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Client, ConnectedFreelancerWorkspace } from '@/shared/types';
import { ClientAuthService, ClientPortalService } from '@/backend/client';

const CLIENT_SESSION_KEY = 'flowdesk_client_session';
const ACTIVE_WORKSPACE_KEY = 'flowdesk_active_client_workspace';

interface ClientAuthContextType {
  client: Client | null;
  workspaces: ConnectedFreelancerWorkspace[];
  activeWorkspace: ConnectedFreelancerWorkspace | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  switchWorkspace: (workspaceIdOrClientId: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: (email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshClient: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export const ClientAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [workspaces, setWorkspaces] = useState<ConnectedFreelancerWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<ConnectedFreelancerWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load client session and authorized workspaces on mount
  const loadSession = useCallback(async () => {
    try {
      // 1. Fetch connected workspaces for this authenticated client
      const connectedWorkspaces = await ClientAuthService.getConnectedWorkspaces();
      setWorkspaces(connectedWorkspaces);

      // 2. Determine active workspace
      const savedWsId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_WORKSPACE_KEY) : null;
      let targetWs: ConnectedFreelancerWorkspace | null = null;

      if (connectedWorkspaces.length > 0) {
        if (savedWsId) {
          targetWs = connectedWorkspaces.find(
            (w) => w.workspaceId === savedWsId || w.clientId === savedWsId
          ) || connectedWorkspaces[0];
        } else {
          targetWs = connectedWorkspaces[0];
        }
      }

      setActiveWorkspace(targetWs);

      // 3. Resolve client record for the active workspace
      if (targetWs) {
        const portalData = await ClientPortalService.getPortalData(targetWs.clientId);
        if (portalData.client) {
          setClient(portalData.client);
        } else {
          const authClient = await ClientAuthService.getAuthenticatedClient();
          setClient(authClient);
        }
      } else {
        const authClient = await ClientAuthService.getAuthenticatedClient();
        setClient(authClient);
      }
    } catch (err) {
      console.warn('Error loading client session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSession();
    return () => {
      mounted = false;
    };
  }, [loadSession]);

  /**
   * Switches the active workspace safely.
   * Only allows switching to explicitly connected and authorized workspaces.
   */
  const switchWorkspace = async (workspaceIdOrClientId: string) => {
    const targetWs = workspaces.find(
      (w) => w.workspaceId === workspaceIdOrClientId || w.clientId === workspaceIdOrClientId
    );

    if (!targetWs) {
      console.warn('Unauthorized or unknown workspace switch attempt:', workspaceIdOrClientId);
      return;
    }

    setIsLoading(true);
    try {
      setActiveWorkspace(targetWs);
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, targetWs.workspaceId);
      }

      // Fetch fresh client data for the chosen workspace
      const portalData = await ClientPortalService.getPortalData(targetWs.clientId);
      if (portalData.client) {
        setClient(portalData.client);
      }
    } catch (err) {
      console.error('Error switching client workspace:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const result = await ClientAuthService.login(email, password);
      if (result.success && result.client) {
        setClient(result.client);
        await loadSession();
        return { success: true };
      }
      return { success: false, error: result.error || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async (email?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const result = await ClientAuthService.loginDemo(email);
      if (result.success && result.client) {
        setClient(result.client);
        await loadSession();
        return { success: true };
      }
      return { success: false, error: result.error || 'Demo login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await ClientAuthService.logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
    setClient(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
  };

  const refreshClient = async () => {
    await loadSession();
  };

  const isAuthenticated = Boolean(client);

  return (
    <ClientAuthContext.Provider
      value={{
        client,
        workspaces,
        activeWorkspace,
        isLoading,
        isAuthenticated,
        switchWorkspace,
        loginWithEmail,
        loginDemo,
        logout,
        refreshClient,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
};
