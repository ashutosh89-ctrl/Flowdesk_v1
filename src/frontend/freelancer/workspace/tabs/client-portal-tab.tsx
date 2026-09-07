import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Modal } from '@/frontend/shared/ui/modal';
import { WorkspaceService } from '@/backend/freelancer';
import { WorkspaceSummary } from '@/shared/types';
import { QRCode } from '@/frontend/shared/ui/qr-code';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Globe, Copy, CheckCircle2, ShieldCheck, RefreshCw, Power, Eye, QrCode as QrIcon, Mail } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { FreelancerClientManagementService } from '@/backend/freelancer/client-management-service';
import { getCurrentWorkspace } from '@/backend/utilities/workspace';

export interface ClientPortalTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const ClientPortalTab: React.FC<ClientPortalTabProps> = ({ summary, onRefresh }) => {
  const { client, deliverables, invoices, portalConfig } = summary;
  const { showToast } = useToast();
  // Freelancer's own workspace identity (no hardcoded demo studio name).
  const [freelancerIdentity, setFreelancerIdentity] = useState<string>('');
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ws = await getCurrentWorkspace();
        if (mounted) setFreelancerIdentity(ws?.name || '');
      } catch {
        // Non-fatal: falls back to client company name in the UI.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/${client.id}`
    : `https://flowdesk.app/portal/${client.id}`;

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

  const handleSendInvite = async () => {
    setIsSendingInvite(true);
    try {
      const res = await FreelancerClientManagementService.sendClientInvitationEmail(client.id);
      if (res.success) {
        showToast('Invitation Dispatched', res.message || `Invitation email sent to ${client.email}`, 'success');
      } else {
        showToast('Delivery Notice', res.error || 'Failed to dispatch email', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to send invitation', 'error');
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Magic Link & QR Code Management Box */}
      <Card variant="crystal" className="border-white/20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
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
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Client Magic Portal Link & QR Code</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Share this direct access link, send an email invite, or present the QR code to {client.name}.
              </p>
            </div>
            <p className="text-xs text-zinc-300 font-mono select-all bg-zinc-900/90 p-2.5 rounded-xl border border-white/10 break-all">
              {portalUrl}
            </p>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button variant="secondary" size="sm" onClick={handleCopyLink} leftIcon={<Copy className="w-3.5 h-3.5" />}>
                Copy Link
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendInvite}
                isLoading={isSendingInvite}
                leftIcon={<Mail className="w-3.5 h-3.5 text-emerald-400" />}
              >
                Send Email Invite
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

          {/* QR Code Presentation */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col items-center gap-2.5 shrink-0 self-center sm:self-auto">
            <div className="p-2.5 rounded-xl bg-white shadow-md">
              <QRCode value={portalUrl} size={110} darkColor="#09090b" lightColor="#ffffff" />
            </div>
            <div className="text-center">
              <span className="text-[10px] font-mono font-semibold text-zinc-300 block">SCAN PORTAL QR</span>
              <span className="text-[9px] text-zinc-500">Instant mobile view</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Live Client View Frame Simulator */}
      <Card variant="crystal" className="p-6 sm:p-8 border-white/20 bg-zinc-950/90 space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <FlowDeskLogo variant="symbol" size={36} className="p-1 rounded-xl bg-white/5 border border-white/10" />
            <div>
              <h2 className="text-lg font-bold text-white">{client.company} Client Portal</h2>
              <p className="text-xs text-zinc-400">
                {freelancerIdentity || client.company || 'Your Studio'} — client portal preview
              </p>
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
                  <StatusPill status={inv.status || inv.paymentStatus || 'pending'} />
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
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono border border-zinc-700">
                      Client Action: Sign-Off
                    </span>
                  </div>
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
