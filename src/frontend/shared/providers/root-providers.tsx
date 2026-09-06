'use client';

import React from 'react';
import { ToastProvider } from '@/frontend/shared/ui/toast';

export function RootProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
