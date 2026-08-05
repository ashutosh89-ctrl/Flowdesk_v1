import React from 'react';
import { ClientPortalView } from '../../../src/features/portal/client-portal-view';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientPortalPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <ClientPortalView clientId={resolvedParams.clientId} />;
}
