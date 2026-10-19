import React, { useState, useEffect } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { useToast } from '@/frontend/shared/ui/toast';
import { Client } from '@/shared/types';
import { useAuth } from '@/frontend/auth/auth-context';
import {
  Mail,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface InviteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSuccess?: () => void;
}

export const InviteClientModal: React.FC<InviteClientModalProps> = ({
  isOpen,
  onClose,
  client,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [isSending, setIsSending] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [emailStatus, setEmailStatus] = useState<{
    dispatched?: boolean;
    error?: string | null;
    message?: string;
  } | null>(null);

  const [providerHealth, setProviderHealth] = useState<{
    status: string;
    details?: string;
    loading: boolean;
  }>({ status: 'checking', loading: true });

  // Check email health on mount
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    fetch('/api/email/health')
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          setProviderHealth({
            status: data.status || (data.success ? 'ready' : 'unconfigured'),
            details: data.details,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setProviderHealth({
            status: 'transient_error',
            details: 'Could not contact health service',
            loading: false,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Handle countdown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Reset local state when client changes
  const [prevClientId, setPrevClientId] = useState(client?.id);
  if (client?.id !== prevClientId) {
    setPrevClientId(client?.id);
    setConnectionUrl('');
    setEmailStatus(null);
    setCopied(false);
  }

  if (!client) return null;

  const studioName = profile?.companyName || profile?.name || 'FlowDesk Studio';
  const isAlreadyConnected = Boolean(client.userId);
  const hasPendingInvitation = Boolean(client.portalToken) && !isAlreadyConnected;

  const handleGenerateOrSend = async (sendEmail: boolean) => {
    setIsSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}/invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: client.email,
          forceNew: true,
          sendEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to generate invitation');
      }

      setConnectionUrl(data.url);
      if (sendEmail) {
        setCooldownSeconds(60);
        setEmailStatus({
          dispatched: data.emailDispatched,
          error: data.emailDeliveryError,
          message: data.message,
        });

        if (data.emailDispatched) {
          showToast('Invitation Dispatched', `Email sent to ${client.email}`, 'success');
        } else if (data.emailDeliveryError) {
          showToast(
            'Email Not Sent',
            `Link generated, but provider error: ${data.emailDeliveryError}`,
            'info'
          );
        }
      } else {
        showToast('Link Generated', 'One-time client invitation link ready.', 'success');
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to generate invitation', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    let urlToCopy = connectionUrl;
    if (!urlToCopy) {
      try {
        setIsSending(true);
        const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}/invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: client.email,
            forceNew: false,
            sendEmail: false,
          }),
        });
        const data = await res.json();
        if (data.url) {
          urlToCopy = data.url;
          setConnectionUrl(data.url);
        }
      } catch (e: any) {
        showToast('Error', e.message || 'Failed to retrieve connection link', 'error');
        setIsSending(false);
        return;
      } finally {
        setIsSending(false);
      }
    }

    if (urlToCopy) {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      showToast('Link Copied', 'Invitation link copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}/invitation`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to revoke invitation');
      }
      setConnectionUrl('');
      setEmailStatus(null);
      showToast('Invitation Revoked', 'Pending invitation has been invalidated.', 'info');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to revoke invitation', 'error');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invite Client: ${client.company}`}>
      <div className="space-y-5">
        {/* Connection Status Header */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Current Status:</span>
            {isAlreadyConnected ? (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Client Connected
              </span>
            ) : hasPendingInvitation ? (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Invitation Pending
              </span>
            ) : (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-white/10 flex items-center gap-1.5">
                Not Connected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/5 font-mono">
            <div>
              <span className="text-zinc-500">Contact:</span>{' '}
              <span className="text-white font-sans">{client.name}</span>
            </div>
            <div>
              <span className="text-zinc-500">Email:</span>{' '}
              <span className="text-white">{client.email}</span>
            </div>
          </div>
        </div>

        {/* Brevo Provider Compliance Notice (if suspended) */}
        {providerHealth.status === 'suspended_or_disabled' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Email Provider Platform Suspended</span>
            </div>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              Brevo has placed the transactional sending relay into a disabled state pending account compliance review.
              Direct email delivery is paused. You can still generate and copy the secure connection link below to send directly via your own email client or messaging.
            </p>
          </div>
        )}

        {/* Connected state notice */}
        {isAlreadyConnected ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Client has claimed this workspace
            </p>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              This client account has completed authentication and is bound to this workspace. They can sign in at any time to review invoices, documents, and deliverables.
            </p>
          </div>
        ) : (
          <>
            {/* Invitation Details Summary */}
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Sending Studio:</span>
                  <span className="text-white font-medium">{studioName}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Recipient Address:</span>
                  <span className="text-white font-mono">{client.email}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Token Validity:</span>
                  <span className="text-amber-400 font-mono">7 Days (Cryptographically hashed)</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Client Verification:</span>
                  <span className="text-emerald-400">Required on Acceptance</span>
                </div>
              </div>
            </div>

            {/* Email dispatch feedback */}
            {emailStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  emailStatus.dispatched
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {emailStatus.dispatched ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {emailStatus.dispatched ? 'Email Dispatched' : 'Email Delivery Notice'}
                  </span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  {emailStatus.message || emailStatus.error}
                </p>
              </div>
            )}

            {/* Connection Link Box (if generated) */}
            {connectionUrl && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span>One-Time Connection Link</span>
                  <span className="text-[10px] text-zinc-500">Single-use token</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={connectionUrl}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all focus:outline-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    disabled={isSending}
                    className="shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {hasPendingInvitation ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={isRevoking || isSending}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {isRevoking ? 'Revoking...' : 'Revoke Invitation'}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    disabled={isSending}
                    className="text-zinc-300 hover:text-white justify-center"
                  >
                    <Link2 className="w-3.5 h-3.5 mr-1" />
                    {connectionUrl ? 'Copy Link Again' : 'Get Connection Link'}
                  </Button>
                )}

                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" onClick={onClose} disabled={isSending || isRevoking}>
                    Close
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => handleGenerateOrSend(true)}
                    disabled={
                      isSending ||
                      isRevoking ||
                      cooldownSeconds > 0 ||
                      providerHealth.status === 'suspended_or_disabled'
                    }
                    title={
                      providerHealth.status === 'suspended_or_disabled'
                        ? 'Brevo sending platform is disabled by compliance'
                        : cooldownSeconds > 0
                        ? `Please wait ${cooldownSeconds}s before resending`
                        : 'Send transactional invitation email'
                    }
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Sending...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Resend in ${cooldownSeconds}s`
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5 mr-1.5" />
                        {hasPendingInvitation ? 'Resend Invitation Email' : 'Send Invitation Email'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
