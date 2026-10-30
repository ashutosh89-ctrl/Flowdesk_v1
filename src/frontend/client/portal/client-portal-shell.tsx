'use client';

import React, { useState, useMemo } from 'react';
import { isSafeHttpUrl } from '@/shared/utils/safe-url';

import { PortalSidebar, PortalTabType } from './portal-sidebar';
import { PortalHeader } from './portal-header';
import { OverviewCards } from './overview-cards';
import { ProjectOverview } from './project-overview';
import { DeliverablesPanel } from './deliverables-panel';
import { DocumentsPanel } from './documents-panel';
import { InvoicesPanel } from './invoices-panel';
import { CommentsPanel } from './comments-panel';
import { ActivityPanel } from './activity-panel';
import { NotificationsPanel } from './notifications-panel';
import { ProfilePanel } from './profile-panel';
import { ApprovalModal } from './approval-modal';
import { RevisionModal } from './revision-modal';
import { QuickActions } from './quick-actions';
import { RazorpayCheckoutModal } from '@/frontend/client/invoices/razorpay-checkout-modal';

import {
  Client,
  Project,
  Deliverable,
  DocumentItem,
  Invoice,
  PortalActivity,
  PortalNotification,
  PortalComment,
  PortalProfile,
  PortalFileRequest,
  InvoiceBranding,
} from '@/shared/types';
import {
  CheckCircle2,
  ShieldCheck,
  X,
  LayoutDashboard,
  PackageCheck,
  Receipt,
  Folder,
  Menu,
} from 'lucide-react';
import { generateInvoicePDF } from '@/shared/utils/invoice-pdf';

interface ClientPortalShellProps {
  client: Client;
  projects: Project[];
  deliverables: Deliverable[];
  documents: DocumentItem[];
  invoices: Invoice[];
  activities: PortalActivity[];
  notifications: PortalNotification[];
  comments: PortalComment[];
  profile: PortalProfile;
  branding?: InvoiceBranding | null;
  fileRequests: PortalFileRequest[];
  onApproveDeliverable: (deliverableId: string, notes?: string) => Promise<void>;
  onRequestRevision: (deliverableId: string, reason: string, priority: string, comment: string, attachmentFile?: File) => Promise<void>;
  onUploadDocument: (docId: string, fileData: { fileName: string; size: string; file?: File; downloadUrl?: string }) => Promise<void>;
  onDirectUploadDocument?: (payload: {
    file: File;
    title: string;
    category: any;
    description?: string;
    projectId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onPayInvoice: (invoiceId: string) => Promise<void>;
  onPostComment: (text: string, replyToId?: string) => Promise<void>;
  onMarkNotificationsRead: () => Promise<void>;
}

export const ClientPortalShell: React.FC<ClientPortalShellProps> = ({
  client,
  projects,
  deliverables,
  documents,
  invoices,
  activities,
  notifications,
  comments,
  profile,
  branding,
  fileRequests,
  onApproveDeliverable,
  onRequestRevision,
  onUploadDocument,
  onDirectUploadDocument,
  onPayInvoice,
  onPostComment,
  onMarkNotificationsRead,
}) => {
  const [activeTab, setActiveTab] = useState<PortalTabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  // Modals state
  const [selectedApprovalDeliverable, setSelectedApprovalDeliverable] = useState<Deliverable | null>(null);
  const [selectedRevisionDeliverable, setSelectedRevisionDeliverable] = useState<Deliverable | null>(null);
  const [uploadDocumentTarget, setUploadDocumentTarget] = useState<DocumentItem | null>(null);
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<Invoice | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Counts for sidebar badges
  const pendingApprovalsCount = deliverables.filter(d => d.status === 'ready_for_review' || d.status === 'submitted' || d.status === 'preparing').length;
  const pendingDocumentsCount = fileRequests.filter(r => r.status === 'pending').length + documents.filter(d => d.status === 'pending').length;
  const unpaidInvoicesCount = invoices.filter(i => i.paymentStatus !== 'paid').length;
  const unreadCommentsCount = comments.filter(c => c.unread).length;
  const outstandingInvoicesTotal = invoices
    .filter(i => i.paymentStatus !== 'paid')
    .reduce((sum, i) => sum + i.total, 0);

  // Search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return {
      projects: projects.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
      deliverables: deliverables.filter(d => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)),
      documents: documents.filter(d => d.title.toLowerCase().includes(q)),
      invoices: invoices.filter(i => i.invoiceNumber.toLowerCase().includes(q)),
      comments: comments.filter(c => c.text.toLowerCase().includes(q)),
    };
  }, [searchQuery, projects, deliverables, documents, invoices, comments]);

  // Tab Title Mapping
  const tabTitles: Record<PortalTabType, string> = {
    overview: 'Workspace Overview',
    projects: 'Project Roadmap & Status',
    deliverables: 'Deliverables & Work Sign-Off',
    documents: 'Documents & File Requests',
    invoices: 'Billing Statements & Payments',
    comments: 'Workspace Discussion Thread',
    activity: 'Client Activity Timeline',
    profile: 'Client Account & Preferences',
  };

  // Quick Action Handler
  const handleQuickActionSelect = (type: 'upload' | 'approve' | 'comment' | 'pay' | 'download_zip') => {
    if (type === 'approve') {
      const target = deliverables.find(d => d.status === 'ready_for_review' || d.status === 'submitted' || d.status === 'preparing') || deliverables[0];
      if (target) setSelectedApprovalDeliverable(target);
      else setActiveTab('deliverables');
    } else if (type === 'upload') {
      setActiveTab('documents');
    } else if (type === 'pay') {
      setActiveTab('invoices');
    } else if (type === 'comment') {
      setActiveTab('comments');
    } else if (type === 'download_zip') {
      // No implementation exists - direct to deliverables download
      setActiveTab('deliverables');
    }
  };

  return (
    <div className="min-h-screen bg-[#101312] text-[#F5F5F0] font-sans antialiased flex flex-col lg:flex-row selection:bg-[#43D6B0] selection:text-[#101312]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-[#176B5B]/20 border border-[#176B5B]/50 text-[#43D6B0] text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-[#43D6B0] shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-[#A6B4AE] hover:text-[#F5F5F0]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <PortalSidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
        }}
        companyName={client.company}
        clientName={client.name}
        logoUrl={(branding as any)?.logoUrl || (profile as any)?.logoUrl || client.avatarUrl || '/branding/flowdesk-symbol.png'}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        pendingApprovalsCount={pendingApprovalsCount}
        pendingDocumentsCount={pendingDocumentsCount}
        unpaidInvoicesCount={unpaidInvoicesCount}
        unreadCommentsCount={unreadCommentsCount}
      />

      {/* Main Content Workspace Canvas */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Header */}
        <PortalHeader
          companyName={client.company}
          clientName={client.name}
          logoUrl={(branding as any)?.logoUrl || (profile as any)?.logoUrl || client.avatarUrl || '/branding/flowdesk-symbol.png'}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          isNotificationsOpen={isNotificationsOpen}
          onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
          onOpenQuickActions={() => setIsQuickActionsOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          activeTabTitle={tabTitles[activeTab]}
        />

        {/* Notifications Popover Dropdown */}
        {isNotificationsOpen && (
          <div className="fixed right-4 top-16 z-40">
            <NotificationsPanel
              notifications={notifications}
              onMarkAllRead={async () => {
                await onMarkNotificationsRead();
                showToast('Notifications marked as read.');
              }}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </div>
        )}

        {/* Main Canvas Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8 space-y-6 sm:space-y-8">
          {/* Global Search Results overlay if searching */}
          {searchResults ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h2 className="text-lg font-bold text-white">Search Results for &quot;{searchQuery}&quot;</h2>
                <button onClick={() => setSearchQuery('')} className="text-xs text-zinc-400 hover:text-white font-mono">
                  Clear Search
                </button>
              </div>

              {/* Render Search Matches */}
              <div className="space-y-4">
                {searchResults.projects.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase text-zinc-400 font-bold">Projects ({searchResults.projects.length})</h3>
                    {searchResults.projects.map((p) => (
                      <div key={p.id} className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex justify-between items-center text-xs">
                        <span className="font-bold text-white">{p.title}</span>
                        <span className="text-zinc-400 font-mono">{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.deliverables.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase text-zinc-400 font-bold">Deliverables ({searchResults.deliverables.length})</h3>
                    {searchResults.deliverables.map((d) => (
                      <div key={d.id} className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex justify-between items-center text-xs">
                        <span className="font-bold text-white">{d.title} ({d.version})</span>
                        <button
                          onClick={() => {
                            setSelectedApprovalDeliverable(d);
                            setSearchQuery('');
                          }}
                          className="px-2.5 py-1 rounded bg-white text-zinc-950 font-bold text-[10px]"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.documents.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono uppercase text-zinc-400 font-bold">Documents ({searchResults.documents.length})</h3>
                    {searchResults.documents.map((doc) => (
                      <div key={doc.id} className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex justify-between items-center text-xs">
                        <span className="font-bold text-white">{doc.title}</span>
                        <span className="text-zinc-400">{doc.type}</span>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.projects.length === 0 && searchResults.deliverables.length === 0 && searchResults.documents.length === 0 && (
                  <p className="text-xs text-zinc-500 py-8 text-center">No matching assets found.</p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Tab views */}
              {activeTab === 'overview' && (
                <OverviewCards
                  client={client}
                  projects={projects}
                  deliverables={deliverables}
                  documents={documents}
                  invoices={invoices}
                  activities={activities}
                  pendingApprovalsCount={pendingApprovalsCount}
                  pendingDocumentsCount={pendingDocumentsCount}
                  outstandingInvoicesTotal={outstandingInvoicesTotal}
                  onNavigateTab={setActiveTab}
                  onApproveClick={(deliv) => setSelectedApprovalDeliverable(deliv)}
                  onUploadClick={(doc) => {
                    setActiveTab('documents');
                    setUploadDocumentTarget(doc);
                  }}
                  onPayClick={(inv) => {
                    setSelectedPaymentInvoice(inv);
                  }}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectOverview projects={projects} activities={activities} />
              )}

              {activeTab === 'deliverables' && (
                <DeliverablesPanel
                  deliverables={deliverables}
                  onApproveClick={(deliv) => setSelectedApprovalDeliverable(deliv)}
                  onRequestRevisionClick={(deliv) => setSelectedRevisionDeliverable(deliv)}
                  onDownloadClick={(deliv) => {
                    // Use the file URL from Supabase Storage if available
                    const fileUrl = (deliv as any).fileUrl || (deliv as any).file_url;
                    if (fileUrl && isSafeHttpUrl(fileUrl)) {
                      const link = document.createElement('a');
                      link.href = fileUrl;
                      link.download = `${deliv.title}-v${deliv.version || '1.0'}.zip`;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast(`Download initiated for ${deliv.title}`);
                    } else {
                      showToast(`No file available for ${deliv.title}. Please ask your freelancer to upload a file.`);
                    }

                  }}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsPanel
                  documents={documents}
                  fileRequests={fileRequests}
                  projects={projects}
                  onDirectUpload={async (payload) => {
                    if (onDirectUploadDocument) {
                      const res = await onDirectUploadDocument(payload);
                      if (res.success) {
                        showToast(`Uploaded "${payload.title}" successfully!`);
                      }
                      return res;
                    }
                    return { success: false, error: 'Direct upload not supported in this session.' };
                  }}
                  onFulfillRequestClick={async (req, file) => {
                    const formatSize = (bytes: number) => {
                      if (!bytes || bytes <= 0) return '0 B';
                      const k = 1024;
                      const sizes = ['B', 'KB', 'MB', 'GB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                    };
                    const blobUrl = typeof window !== 'undefined' && typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined;
                    await onUploadDocument(req.id, {
                      fileName: file.name,
                      size: formatSize(file.size),
                      file: file,
                      downloadUrl: blobUrl,
                    });
                    showToast(`Fulfilled file request: ${req.title}`);
                  }}
                  onUploadClick={async (doc) => {
                    await onUploadDocument(doc.id, {
                      fileName: `${doc.title.toLowerCase().replace(/\s+/g, '-')}-client.pdf`,
                      size: '2.4 MB',
                    });
                    showToast(`Uploaded ${doc.title} successfully!`);
                  }}
                  onDownloadClick={(doc) => {
                    if (doc.downloadUrl && doc.downloadUrl !== '#') {
                      const link = document.createElement('a');
                      link.href = doc.downloadUrl;
                      link.download = doc.fileName || doc.title;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast(`Download initiated for ${doc.title}`);
                    } else {
                      showToast(`No file available for ${doc.title}`);
                    }
                  }}
                />
              )}

              {activeTab === 'invoices' && (
                <InvoicesPanel
                  invoices={invoices}
                  profile={(branding as any) || profile}
                  branding={branding}
                  onPayClick={(inv) => {
                    setSelectedPaymentInvoice(inv);
                  }}
                  onDownloadClick={(inv) => generateInvoicePDF(inv, branding)}
                />
              )}

              {activeTab === 'comments' && (
                <CommentsPanel
                  comments={comments}
                  clientName={client.name}
                  clientAvatar={client.avatarUrl}
                  onPostComment={async (text, replyToId) => {
                    await onPostComment(text, replyToId);
                    showToast('Posted comment to workspace thread!');
                  }}
                />
              )}

              {activeTab === 'activity' && (
                <ActivityPanel activities={activities} />
              )}

              {activeTab === 'profile' && (
                <ProfilePanel profile={profile} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Client Mobile Bottom Navigation Dock */}
      <nav
        aria-label="Client Portal Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D0E11]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)] select-none"
      >
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
            activeTab === 'overview' ? 'text-[#43D6B0]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <LayoutDashboard className={`w-5 h-5 transition-transform ${activeTab === 'overview' ? 'scale-110' : ''}`} />
            {activeTab === 'overview' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#43D6B0]" />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-medium ${activeTab === 'overview' ? 'font-bold text-white' : ''}`}>
            Overview
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deliverables')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] relative ${
            activeTab === 'deliverables' ? 'text-[#43D6B0]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <PackageCheck className={`w-5 h-5 transition-transform ${activeTab === 'deliverables' ? 'scale-110' : ''}`} />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-amber-500 text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
            {activeTab === 'deliverables' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#43D6B0]" />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-medium ${activeTab === 'deliverables' ? 'font-bold text-white' : ''}`}>
            Work
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] relative ${
            activeTab === 'invoices' ? 'text-[#43D6B0]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <Receipt className={`w-5 h-5 transition-transform ${activeTab === 'invoices' ? 'scale-110' : ''}`} />
            {unpaidInvoicesCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-emerald-500 text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {unpaidInvoicesCount}
              </span>
            )}
            {activeTab === 'invoices' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#43D6B0]" />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-medium ${activeTab === 'invoices' ? 'font-bold text-white' : ''}`}>
            Invoices
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] relative ${
            activeTab === 'documents' ? 'text-[#43D6B0]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <Folder className={`w-5 h-5 transition-transform ${activeTab === 'documents' ? 'scale-110' : ''}`} />
            {pendingDocumentsCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-sky-500 text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {pendingDocumentsCount}
              </span>
            )}
            {activeTab === 'documents' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#43D6B0]" />
            )}
          </div>
          <span className={`text-[10px] mt-1 font-medium ${activeTab === 'documents' ? 'font-bold text-white' : ''}`}>
            Files
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer min-w-[56px]"
          aria-label="More navigation options"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Menu</span>
        </button>
      </nav>

      {/* Razorpay Checkout Modal — keyed by invoice so state resets per checkout */}
      <RazorpayCheckoutModal
        key={selectedPaymentInvoice?.id || 'closed'}
        isOpen={!!selectedPaymentInvoice}
        onClose={() => setSelectedPaymentInvoice(null)}
        invoice={selectedPaymentInvoice}
        clientId={client.id}
        branding={branding || (profile as any)}
        onPaymentSuccess={async () => {
          if (selectedPaymentInvoice) {
            await onPayInvoice(selectedPaymentInvoice.id);
            showToast(`Statement #${selectedPaymentInvoice.invoiceNumber} payment processed!`);
          }
        }}
      />

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={!!selectedApprovalDeliverable}
        onClose={() => setSelectedApprovalDeliverable(null)}
        deliverable={selectedApprovalDeliverable}
        onConfirmApprove={async (delivId, notes) => {
          await onApproveDeliverable(delivId, notes);
          setSelectedApprovalDeliverable(null);
          showToast('Sign-off recorded! Deliverable marked as Approved.');
        }}
        onRequestRevision={(deliv) => {
          setSelectedApprovalDeliverable(null);
          setSelectedRevisionDeliverable(deliv);
        }}
        onDownload={(deliv) => showToast(`Downloading ${deliv.title}...`)}
      />

      {/* Revision Modal */}
      <RevisionModal
        isOpen={!!selectedRevisionDeliverable}
        onClose={() => setSelectedRevisionDeliverable(null)}
        deliverable={selectedRevisionDeliverable}
        onSubmitRevision={async (delivId, reason, priority, comment, attachmentFile) => {
          await onRequestRevision(delivId, reason, priority, comment, attachmentFile);
          setSelectedRevisionDeliverable(null);
          showToast('Revision request submitted to your freelancer.');
        }}
      />

      {/* Quick Actions Modal */}
      <QuickActions
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onActionSelect={handleQuickActionSelect}
      />
    </div>
  );
};
