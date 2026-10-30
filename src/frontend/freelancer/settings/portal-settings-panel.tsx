'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Users,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Globe,
  Lock,
  Mail,
  Building2,
  Calendar,
  X,
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { ClientConnectionRequest, ConnectedClientItem } from '@/shared/types';

export const PortalSettingsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [portalSlug, setPortalSlug] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [portalMode, setPortalMode] = useState<'public' | 'private'>('public');
  const [isAcceptingConnections, setIsAcceptingConnections] = useState(true);
  const [connectedClientsCount, setConnectedClientsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [isSavingMode, setIsSavingMode] = useState(false);

  // Client requests & directory state
  const [pendingRequests, setPendingRequests] = useState<ClientConnectionRequest[]>([]);
  const [connectedClients, setConnectedClients] = useState<ConnectedClientItem[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showConnectedList, setShowConnectedList] = useState(true);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const { showToast } = useToast();

  const refreshData = async () => {
    try {
      const [settingsRes, requestsRes] = await Promise.all([
        fetch('/api/portal/settings'),
        fetch('/api/portal/requests'),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setConnectedClientsCount(sData.connectedClientsCount || 0);
      }

      if (requestsRes.ok) {
        const rData = await requestsRes.json();
        const connList = rData.connectedClients || [];
        setPendingRequests(rData.requests || []);
        setConnectedClients(connList);
        setConnectedClientsCount(connList.length);
      }
    } catch (err) {
      console.warn('Error refreshing portal requests:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initSettingsAndRequests() {
      try {
        const [settingsRes, requestsRes] = await Promise.all([
          fetch('/api/portal/settings'),
          fetch('/api/portal/requests'),
        ]);

        if (!isMounted) return;

        let initialCount = 0;
        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          setPortalSlug(sData.portalSlug || '');
          setPortalUrl(sData.portalUrl || '');
          setPortalMode(sData.portalMode === 'private' ? 'private' : 'public');
          setIsAcceptingConnections(sData.isAcceptingConnections !== false);
          initialCount = sData.connectedClientsCount || 0;
          setConnectedClientsCount(initialCount);
        }

        if (requestsRes.ok) {
          const rData = await requestsRes.json();
          const connList = rData.connectedClients || [];
          setPendingRequests(rData.requests || []);
          setConnectedClients(connList);
          // Prioritize accurate resolved connections count
          setConnectedClientsCount(Math.max(connList.length, initialCount));
        }
      } catch (err) {
        console.warn('Error loading portal settings and requests:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initSettingsAndRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  const effectiveOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const effectivePortalUrl =
    portalUrl ||
    (portalSlug ? `${effectiveOrigin}/portal/join/${portalSlug}` : `${effectiveOrigin}/portal/join/fd_demo_studio`);

  const handleCopyLink = () => {
    if (!effectivePortalUrl) return;
    navigator.clipboard?.writeText(effectivePortalUrl);
    setCopied(true);
    showToast('Permanent Link Copied', 'Your permanent freelancer portal link was copied to clipboard.', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleAccepting = async () => {
    const nextState = !isAcceptingConnections;
    setIsSavingToggle(true);

    try {
      const res = await fetch('/api/portal/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAcceptingConnections: nextState }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsAcceptingConnections(nextState);
        showToast(
          nextState ? 'Connections Enabled' : 'Connections Paused',
          nextState
            ? 'New clients can now connect via your permanent portal link.'
            : 'New connections are paused. Existing connected clients are unaffected.',
          'info'
        );
      } else {
        showToast('Update Failed', data.error || 'Could not update connection status.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to update settings.', 'error');
    } finally {
      setIsSavingToggle(false);
    }
  };

  const handleModeChange = async (targetMode: 'public' | 'private') => {
    if (targetMode === portalMode || isSavingMode) return;
    setIsSavingMode(true);

    try {
      const res = await fetch('/api/portal/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalMode: targetMode }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPortalMode(targetMode);
        showToast(
          targetMode === 'private' ? 'Private Mode Active' : 'Public Mode Active',
          targetMode === 'private'
            ? 'Clients joining via your link without prior invitation must now be reviewed and approved by you.'
            : 'Clients joining via your link will now connect automatically without requiring manual approval.',
          'success'
        );
      } else {
        showToast('Mode Update Failed', data.error || 'Could not update portal mode.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to change portal mode.', 'error');
    } finally {
      setIsSavingMode(false);
    }
  };

  const handleApproveRequest = async (connectionId: string, clientName: string) => {
    setProcessingRequestId(connectionId);
    try {
      const res = await fetch('/api/portal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, action: 'approve' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(
          'Client Approved',
          `${clientName} has been verified and granted access to your studio workspace.`,
          'success'
        );
        // Refresh silently to sync all state
        await refreshData();
      } else {
        showToast('Approval Failed', data.error || 'Could not approve client request.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Approval operation failed.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (connectionId: string, clientName: string) => {
    setProcessingRequestId(connectionId);
    try {
      const res = await fetch('/api/portal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, action: 'reject' }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(
          'Request Declined',
          `Connection request from ${clientName} was declined.`,
          'info'
        );
        await refreshData();
      } else {
        showToast('Decline Failed', data.error || 'Could not decline client request.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Operation failed.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const filteredConnectedClients = connectedClients.filter((c) => {
    if (!clientSearchTerm.trim()) return true;
    const term = clientSearchTerm.toLowerCase();
    return (
      c.clientName.toLowerCase().includes(term) ||
      (c.company && c.company.toLowerCase().includes(term)) ||
      c.email.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
        <p className="text-xs text-zinc-400 font-mono">Loading portal settings & client verification queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permanent Portal Link Card */}
      <Card variant="crystal" className="border-white/10">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#43D6B0]" />
                Permanent Client Portal Link
              </CardTitle>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#43D6B0]/10 border border-[#43D6B0]/20 text-[#43D6B0] text-xs font-mono self-start sm:self-auto">
              <Link2 className="w-3.5 h-3.5" /> Permanent Link
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Link URL & Actions Bar */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3">
            <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-medium">
              Your Public Connection URL
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-xs font-mono text-zinc-200 select-all overflow-x-auto whitespace-nowrap">
                {effectivePortalUrl}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-initial justify-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(effectivePortalUrl, '_blank')}
                  className="px-3"
                  title="Open connection page in new tab"
                >
                  <ExternalLink className="w-4 h-4 text-zinc-400" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              This link never expires or changes between reloads. It directs visitors to your verified connection page without exposing private workspace data.
            </p>
          </div>

          {/* Access Mode Selector: Public vs. Private */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold block">
                  Portal Access & Verification Mode
                </span>
                <p className="text-xs text-zinc-400">
                  Control how new clients who access your permanent link join your studio workspace.
                </p>
              </div>
              {isSavingMode && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving mode...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Public Mode */}
              <button
                type="button"
                onClick={() => handleModeChange('public')}
                disabled={isSavingMode}
                className={`p-4 rounded-xl text-left transition-all duration-200 relative group cursor-pointer border ${
                  portalMode === 'public'
                    ? 'bg-emerald-500/[0.08] border-emerald-500/50 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                    : 'bg-zinc-900/60 border-white/10 hover:border-white/20 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        portalMode === 'public'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/5'
                      }`}
                    >
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Public Mode</span>
                      <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                        Instant Auto-Join
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      portalMode === 'public'
                        ? 'border-emerald-400 bg-emerald-500 text-black'
                        : 'border-zinc-600 bg-transparent'
                    }`}
                  >
                    {portalMode === 'public' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Clients joining via your link connect immediately with instant workspace access without waiting for manual verification.
                </p>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Row-Level Tenant Isolation Enforced</span>
                </div>
              </button>

              {/* Option 2: Private Mode */}
              <button
                type="button"
                onClick={() => handleModeChange('private')}
                disabled={isSavingMode}
                className={`p-4 rounded-xl text-left transition-all duration-200 relative group cursor-pointer border ${
                  portalMode === 'private'
                    ? 'bg-amber-500/[0.08] border-amber-500/50 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30'
                    : 'bg-zinc-900/60 border-white/10 hover:border-white/20 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        portalMode === 'private'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/5'
                      }`}
                    >
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Private Mode</span>
                      <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                        Manual Approval Queue
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      portalMode === 'private'
                        ? 'border-amber-400 bg-amber-500 text-black'
                        : 'border-zinc-600 bg-transparent'
                    }`}
                  >
                    {portalMode === 'private' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Clients joining without prior invitation enter a verification queue. You inspect their profile and details before approving access.
                </p>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Zero-Access Sandbox Until Approved</span>
                </div>
              </button>
            </div>
          </div>

          {/* Connection Acceptance Controls & Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Acceptance Status Toggle */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">Accept New Connections</span>
                <p className="text-[11px] text-zinc-400">
                  {isAcceptingConnections
                    ? 'Visitors can connect their FlowDesk account to your workspace.'
                    : 'New connections are closed. Existing clients remain unaffected.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleAccepting}
                disabled={isSavingToggle}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg shrink-0 transition-opacity disabled:opacity-50 cursor-pointer"
                title={isAcceptingConnections ? 'Click to pause new connections' : 'Click to enable connections'}
              >
                {isSavingToggle ? (
                  <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
                ) : isAcceptingConnections ? (
                  <ToggleRight className="w-9 h-9 text-emerald-400 hover:text-emerald-300 transition-colors" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-zinc-500 hover:text-zinc-400 transition-colors" />
                )}
              </button>
            </div>

            {/* Connected Clients Counter */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">Connected Clients</span>
                <p className="text-[11px] text-zinc-400">
                  Active client workspaces connected to your studio.
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-bold font-mono text-emerald-400">{connectedClientsCount}</span>
                <span className="text-[10px] text-zinc-500 font-mono block">Active</span>
              </div>
            </div>
          </div>

          {/* VERIFICATION QUEUE: Clients Awaiting Approval */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-200 font-semibold">
                  Client Verification Queue
                </span>
                {pendingRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-medium animate-pulse">
                    {pendingRequests.length} Awaiting Approval
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {portalMode === 'private' ? 'Private Mode Active' : 'Public Mode (Direct Joins)'}
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-5 rounded-xl bg-zinc-900/40 border border-dashed border-white/10 text-center space-y-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs text-zinc-300 font-medium">Verification Queue Clean</p>
                <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
                  {portalMode === 'private'
                    ? 'When a new client visits your permanent link, their profile details will appear here for your review and approval before they gain workspace access.'
                    : 'Your portal is currently in Public Mode. Clients connect automatically upon signing in.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => {
                  const isProcessing = processingRequestId === req.id;
                  const reqDate = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : 'Recently';

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-gradient-to-r from-amber-500/[0.05] via-zinc-900/80 to-zinc-900/80 border border-amber-500/30 space-y-4 shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 font-mono text-sm shrink-0">
                            {req.clientName?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{req.clientName}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Pending Approval
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-0.5">
                              {req.company && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                                  <span>{req.company}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-zinc-300">
                                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                                <span>{req.email}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Approve / Decline Action Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleApproveRequest(req.id, req.clientName)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs px-3.5 gap-1.5 shadow-sm shadow-emerald-950"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            )}
                            <span>Approve Client</span>
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleRejectRequest(req.id, req.clientName)}
                            className="text-xs px-3 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </Button>
                        </div>
                      </div>

                      {/* Client Verification Card Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono">
                        <div>
                          <span className="text-zinc-500 block">SUBMITTED VIA</span>
                          <span className="text-zinc-300">Permanent Link</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">REQUEST TIMESTAMP</span>
                          <span className="text-zinc-300">{reqDate}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">SECURITY STATUS</span>
                          <span className="text-amber-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Sandboxed (Zero Access)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CONNECTED CLIENTS DIRECTORY */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowConnectedList(!showConnectedList)}
                className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-300 font-semibold hover:text-white transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Connected Client Workspaces ({connectedClients.length})</span>
                {showConnectedList ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </button>

              {connectedClients.length > 3 && showConnectedList && (
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              )}
            </div>

            {showConnectedList && (
              <div className="space-y-2">
                {connectedClients.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-500">
                    No active clients connected yet. Share your connection URL above to onboard your first client.
                  </div>
                ) : filteredConnectedClients.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-500">
                    No clients matching &quot;{clientSearchTerm}&quot;
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredConnectedClients.map((client) => {
                      const connectedDate = client.connectedAt
                        ? new Date(client.connectedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Active';

                      return (
                        <div
                          key={client.id || client.clientId}
                          className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 font-mono text-xs shrink-0">
                              {client.clientName?.charAt(0).toUpperCase() || 'C'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-white block truncate">
                                {client.clientName}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
                                {client.company && <span>{client.company} •</span>}
                                <span className="font-mono">{client.email}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Active</span>
                            </div>
                            <span className="text-[9px] text-zinc-500 font-mono block mt-0.5">
                              {connectedDate}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Multi-Freelancer Architecture Explanation & Security Note */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-Freelancer Client Architecture & Security Guarantees</span>
            </div>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
              <li>Clients register or sign in once with their FlowDesk client credentials.</li>
              <li>A single client account connects to multiple independent freelancers simultaneously.</li>
              <li>Clients switch between connected studios using the integrated workspace switcher.</li>
              <li>
                In <strong className="text-zinc-200">Private Mode</strong>, pending clients are locked in an isolated queue with zero access to deliverables, invoices, documents, or private workspace data.
              </li>
              <li>
                In <strong className="text-zinc-200">Public Mode</strong>, row-level tenant security guarantees clients can only see their own assigned workspace assets.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
