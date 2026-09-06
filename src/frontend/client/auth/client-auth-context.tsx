'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Client } from '@/shared/types';
import { ClientAuthService } from '@/backend/client';

const CLIENT_SESSION_KEY = 'flowdesk_client_session';

interface ClientAuthContextType {
  client: Client | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: (email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshClient: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export const ClientAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load client session on mount — ONLY from Supabase auth (authoritative)
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        // Supabase auth is the ONLY source of truth for client identity
        const authClient = await ClientAuthService.getAuthenticatedClient();
        if (authClient && mounted) {
          setClient(authClient);
        }
        // If no auth client, client remains null → unauthenticated
      } catch (err) {
        console.warn('Error loading client session:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const result = await ClientAuthService.login(email, password);
      if (result.success && result.client) {
        setClient(result.client);
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
        return { success: true };
      }
      return { success: false, error: result.error || 'Demo login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await ClientAuthService.logout();
    setClient(null);
  };

  const refreshClient = async () => {
    const authClient = await ClientAuthService.getAuthenticatedClient();
    if (authClient) {
      setClient(authClient);
    }
  };

  const isAuthenticated = Boolean(client);

  return (
    <ClientAuthContext.Provider
      value={{
        client,
        isLoading,
        isAuthenticated,
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
