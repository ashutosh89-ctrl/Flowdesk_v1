'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Users,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  QrCode,
  Globe,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export const PortalSettingsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [portalSlug, setPortalSlug] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [isAcceptingConnections, setIsAcceptingConnections] = useState(true);
  const [connectedClientsCount, setConnectedClientsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSavingToggle, setIsSavingToggle] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch('/api/portal/settings');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPortalSlug(data.portalSlug || '');
            setPortalUrl(data.portalUrl || '');
            setIsAcceptingConnections(data.isAcceptingConnections !== false);
            setConnectedClientsCount(data.connectedClientsCount || 0);
          }
        }
      } catch (err) {
        console.warn('Error loading portal settings:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyLink = () => {
    if (!portalUrl) return;
    navigator.clipboard?.writeText(portalUrl);
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

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-white mx-auto" />
        <p className="text-xs text-zinc-400 font-mono">Loading permanent portal identity...</p>
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
                <Link2 className="w-5 h-5 text-emerald-400" />
                Permanent Client Portal Link
              </CardTitle>
              <CardDescription>
                Share this stable, permanent link with clients on WhatsApp, email, proposal decks, or social profiles.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5" /> Stable Identifier
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
                {portalUrl || `https://flowdesk.app/portal/join/${portalSlug}`}
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
                  onClick={() => window.open(portalUrl, '_blank')}
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
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg shrink-0 transition-opacity disabled:opacity-50"
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

          {/* Multi-Freelancer Architecture Explanation */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-Freelancer Client Architecture</span>
            </div>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
              <li>Clients register or sign in once with their FlowDesk client credentials.</li>
              <li>A single client account connects to multiple independent freelancers simultaneously.</li>
              <li>Clients switch between connected studios using the integrated workspace switcher.</li>
              <li>All invoices, deliverables, documents, and messages remain strictly isolated to your studio.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
