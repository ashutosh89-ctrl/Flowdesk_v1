import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { Modal } from '../../../components/ui/modal';
import { WorkspaceService } from '../../../services';
import { WorkspaceSummary } from '../../../types';
import { Globe, Copy, CheckCircle2, ShieldCheck, RefreshCw, Power, Eye } from 'lucide-react';
import { useToast } from '../../../components/ui/toast';

export interface ClientPortalTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const ClientPortalTab: React.FC<ClientPortalTabProps> = ({ summary, onRefresh }) => {
  const { client, deliverables, invoices, portalConfig } = summary;
  const { showToast } = useToast();
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const portalUrl = `https://flowdesk.app/portal/${portalConfig.magicKey}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(portalUrl);
    showToast('Link Copied', 'Magic portal URL copied to clipboard.', 'success');
  };

  const handleTogglePortal = () => {
    WorkspaceService.togglePortalAccess(client.id, !portalConfig.enabled).then(() => {
      showToast(
        portalConfig.enabled ? 'Portal Disabled' : 'Portal Enabled',
        `Client portal status updated.`,
        'info'
      );
      onRefresh();
    });
  };

  const handleRegenerateLink = () => {
    WorkspaceService.regeneratePortalLink(client.id).then(() => {
      showToast('Magic Key Regenerated', 'Old magic link revoked and new key issued.', 'info');
      onRefresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Magic Link Management Box */}
      <Card variant="crystal" className="border-white/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase text-zinc-400">Zero-Login Share Portal</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  portalConfig.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {portalConfig.enabled ? 'Active - Passwordless Link' : 'Disabled'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Client Magic Portal Link</h3>
            <p className="text-xs text-zinc-400 mt-1 font-mono select-all bg-zinc-900/80 p-2 rounded-lg border border-white/5">
              {portalUrl}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={handleCopyLink} leftIcon={<Copy className="w-3.5 h-3.5" />}>
              Copy Link
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsPreviewModalOpen(true)}
              leftIcon={<Eye className="w-3.5 h-3.5" />}
            >
              Preview Portal
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerateLink}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Revoke and create new link"
            >
              Regenerate
            </Button>
            <Button
              variant={portalConfig.enabled ? 'ghost' : 'primary'}
              size="sm"
              onClick={handleTogglePortal}
              leftIcon={<Power className="w-3.5 h-3.5" />}
            >
              {portalConfig.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Live Client View Frame Simulator */}
      <Card variant="crystal" className="p-6 sm:p-8 border-white/20 bg-zinc-950/90 space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold text-lg shadow-md">
              F
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{client.company} Client Portal</h2>
              <p className="text-xs text-zinc-400">Prepared by Rivera Studio</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white/10 text-white border border-white/20 text-xs font-mono">
            LIVE CLIENT SIMULATION
          </span>
        </div>

        {/* Deliverables for Review */}
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3">
            Pending Deliverables For Client Sign-Off
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deliverables.map((del) => (
              <div key={del.id} className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{del.title}</span>
                  <StatusPill status={del.status} />
                </div>
                <p className="text-xs text-zinc-400">{del.description}</p>
                <div className="pt-2 flex justify-end">
                  <span className="text-[10px] text-zinc-500 font-mono">Version: {del.version}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invoices */}
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3">
            Statements & Billing History
          </h4>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">{inv.invoiceNumber}</span>
                  <p className="text-[10px] text-zinc-400">Due {inv.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white">${inv.total.toLocaleString()}</span>
                  <StatusPill status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Full-Screen Client Portal Preview Modal */}
      <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title={`Client View Simulator: ${client.company}`}>
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-white/15 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <span className="text-xs font-mono text-emerald-400">Client View Mode Active</span>
              <span className="text-xs text-zinc-400">Passwordless Security Active</span>
            </div>

            <h3 className="text-base font-bold text-white">Welcome back, {client.name}</h3>
            <p className="text-xs text-zinc-400">
              Here are your active deliverables and outstanding statements for {client.company}.
            </p>

            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-mono uppercase text-zinc-500">Deliverables Awaiting Your Approval</span>
              {deliverables.map((del) => (
                <div key={del.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white">{del.title}</h5>
                    <span className="text-[10px] text-zinc-400">{del.version}</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      showToast('Sign-Off Recorded', 'Client sign-off recorded.', 'success');
                      setIsPreviewModalOpen(false);
                    }}
                  >
                    Approve Work
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setIsPreviewModalOpen(false)}>
              Close Simulator
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
