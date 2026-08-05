'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusPill } from '../../components/ui/status-pill';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import {
  PortalService,
  InvitationService,
  DeliverableService,
  DocumentService,
  InvoiceService,
  CommentService,
} from '../../services';
import { ClientPortalDashboardData, Deliverable, DocumentItem, Invoice } from '../../types';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Upload,
  CreditCard,
  MessageSquare,
  ArrowRight,
  Download,
  AlertCircle,
  Clock,
  Send,
  Sparkles,
  Lock,
} from 'lucide-react';

export interface ClientPortalViewProps {
  clientId: string;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({ clientId }) => {
  const [data, setData] = useState<ClientPortalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'deliverables' | 'documents' | 'invoices' | 'messages'>('overview');

  // Modals
  const [reviewDeliv, setReviewDeliv] = useState<Deliverable | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [uploadDocItem, setUploadDocItem] = useState<DocumentItem | null>(null);
  const [payInvoiceItem, setPayInvoiceItem] = useState<Invoice | null>(null);
  const [commentText, setCommentText] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadPortalData = React.useCallback(async () => {
    const res = await PortalService.getClientPortalDashboardData(clientId);
    setData(res);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    let active = true;
    PortalService.getClientPortalDashboardData(clientId).then((res) => {
      if (active) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [clientId]);

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleAcceptInvite = async () => {
    await InvitationService.acceptInvitation(clientId);
    showNotification('Portal Invitation Activated! Welcome to your client workspace.');
    loadPortalData();
  };

  const handleApproveDeliverable = async (delId: string) => {
    await DeliverableService.approveDeliverable(delId, 'Approved via Client Portal');
    showNotification('Deliverable Approved & Signed Off!');
    setReviewDeliv(null);
    loadPortalData();
  };

  const handleRequestRevision = async (delId: string) => {
    if (!revisionNote.trim()) return;
    await DeliverableService.requestDeliverableRevision(delId, revisionNote);
    showNotification('Revision request sent to Alex Rivera.');
    setReviewDeliv(null);
    setRevisionNote('');
    loadPortalData();
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocItem) return;
    await DocumentService.uploadDocumentFile(uploadDocItem.id, {
      fileName: `${uploadDocItem.title.toLowerCase().replace(/\s+/g, '-')}-client.pdf`,
      size: '2.1 MB',
    });
    showNotification(`Uploaded ${uploadDocItem.title} successfully!`);
    setUploadDocItem(null);
    loadPortalData();
  };

  const handlePayInvoice = async (invoiceId: string) => {
    await InvoiceService.markAsPaid(invoiceId);
    showNotification('Payment processed successfully! Invoice marked as paid.');
    setPayInvoiceItem(null);
    loadPortalData();
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await CommentService.addComment(clientId, {
      text: commentText,
      author: data?.client.name || 'Client Contact',
      avatar: data?.client.avatarUrl,
      isOwner: false,
    });
    showNotification('Message posted to workspace thread.');
    setCommentText('');
    loadPortalData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Loading Passwordless Client Portal...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card variant="crystal" className="max-w-md p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold">Client Portal Not Found</h2>
          <p className="text-xs text-zinc-400">
            This workspace URL is invalid or access has been disabled by Rivera Studio.
          </p>
        </Card>
      </div>
    );
  }

  const { client, projects, upcomingTasks, pendingApprovalsCount, pendingDocumentsCount, outstandingInvoicesTotal, nextAction } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans antialiased selection:bg-white selection:text-zinc-950">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 font-extrabold flex items-center justify-center text-lg shadow-md">
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">{client.company}</span>
                <span className="text-[10px] font-mono bg-white/10 border border-white/15 px-2 py-0.5 rounded text-zinc-300">
                  Client Portal
                </span>
              </div>
              <p className="text-xs text-zinc-400">Prepared by Alex Rivera (Rivera Studio)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Passwordless Magic Access</span>
          </div>
        </div>
      </header>

      {/* Main Client Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Invitation Banner */}
        <Card variant="crystal" className="p-6 border-white/20 bg-white/[0.03]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-zinc-400 uppercase">Welcome, {client.name}</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Your Project Workspace & Review Hub</h1>
              <p className="text-xs text-zinc-400">
                Track deliverables, upload required compliance documents, and review billing statements in one place.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleAcceptInvite}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
            >
              Confirm Workspace Access
            </Button>
          </div>
        </Card>

        {/* Next Action Callout */}
        {nextAction && (
          <Card variant="crystal" className="p-5 border-amber-500/30 bg-amber-500/[0.04]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">NEXT ACTION REQUIRED</span>
                  <h3 className="text-sm font-bold text-white mt-0.5">{nextAction.title}</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">{nextAction.description}</p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (nextAction.actionType === 'upload_doc') setActiveTab('documents');
                  else if (nextAction.actionType === 'review_deliverable') setActiveTab('deliverables');
                  else if (nextAction.actionType === 'pay_invoice') setActiveTab('invoices');
                }}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Take Action
              </Button>
            </div>
          </Card>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="crystal" className="p-5">
            <span className="text-xs font-mono text-zinc-400 uppercase">Pending Approvals</span>
            <p className="text-2xl font-bold text-white mt-1">{pendingApprovalsCount}</p>
            <p className="text-xs text-zinc-400 mt-1">Deliverables for review</p>
          </Card>

          <Card variant="crystal" className="p-5">
            <span className="text-xs font-mono text-zinc-400 uppercase">Documents Requested</span>
            <p className="text-2xl font-bold text-white mt-1">{pendingDocumentsCount}</p>
            <p className="text-xs text-zinc-400 mt-1">Awaiting your upload</p>
          </Card>

          <Card variant="crystal" className="p-5">
            <span className="text-xs font-mono text-zinc-400 uppercase">Outstanding Balance</span>
            <p className="text-2xl font-bold text-white mt-1">
              ${outstandingInvoicesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Unpaid statements</p>
          </Card>
        </div>

        {/* Portal Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'deliverables', label: 'Deliverables & Sign-Off' },
            { id: 'documents', label: 'Document Upload Checklist' },
            { id: 'invoices', label: 'Invoices & Billing' },
            { id: 'messages', label: 'Workspace Discussion' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-950 font-bold shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Views */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card variant="crystal">
                <CardHeader>
                  <CardTitle>Active Projects Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {projects.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">{p.title}</h4>
                        <StatusPill status={p.status} />
                      </div>
                      <p className="text-xs text-zinc-400">{p.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card variant="crystal">
                <CardHeader>
                  <CardTitle>Upcoming Action Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingTasks.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No pending action items for your team!</p>
                  ) : (
                    upcomingTasks.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white">{t.title}</span>
                          <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">{t.category}</span>
                        </div>
                        <span className="text-xs font-mono text-zinc-400">Due: {t.dueDate}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card variant="crystal">
                <CardHeader>
                  <CardTitle>Freelancer Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-white font-bold">Alex Rivera</p>
                  <p className="text-zinc-400">Lead Product Designer & Architect</p>
                  <p className="text-zinc-400 font-mono">alex@riverastudio.com</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Deliverables Tab */}
        {activeTab === 'deliverables' && (
          <Card variant="crystal">
            <CardHeader>
              <CardTitle>Deliverables & Work Sign-Off</CardTitle>
              <CardDescription>Review latest file versions and approve work</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.flatMap(p => p.milestones || []).length === 0 ? null : null}
                {upcomingTasks.length === 0 && <p className="text-xs text-zinc-400 italic">No deliverables assigned.</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};
