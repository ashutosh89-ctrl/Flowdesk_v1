'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Modal } from '@/frontend/shared/ui/modal';
import { RequestDocumentModal } from './components/request-document-modal';
import { DocumentPreviewModal } from './components/document-preview-modal';
import { DocumentService, ClientService, InvoiceService, SettingsService } from '@/backend/freelancer';
import { DocumentItem, Client } from '@/shared/types';
import { generateInvoicePDF, printInvoiceDocument } from '@/shared/utils/invoice-pdf';
import { getDocumentPreviewUrl } from '@/shared/utils/document-preview';
import {
  FileText,
  Download,
  Plus,
  Upload,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  Calendar,
  Users,
  FileSearch,
  Printer,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export const DocumentsListView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<DocumentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifyingDoc, setVerifyingDoc] = useState<DocumentItem | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docs, cls] = await Promise.all([
        DocumentService.getDocuments(),
        ClientService.getClients(),
      ]);
      setDocuments(docs);
      setClients(cls);
    } catch (err) {
      console.warn('Error loading documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadData();
    };
    run();
  }, [loadData]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingDoc || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await DocumentService.verifyDocument(verifyingDoc.id, verificationNotes);
      showToast('Document Verified', `"${verifyingDoc.title}" verified successfully.`, 'success');
      setVerifyingDoc(null);
      setVerificationNotes('');
      loadData();
    } catch {
      showToast('Verify Failed', 'Unable to verify document.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingDoc || !rejectionReason.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await DocumentService.rejectDocument(rejectingDoc.id, rejectionReason);
      showToast('Document Rejected', `Document marked as rejected.`, 'info');
      setRejectingDoc(null);
      setRejectionReason('');
      loadData();
    } catch {
      showToast('Reject Failed', 'Unable to reject document.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (doc.type === 'invoice' || doc.fileName?.startsWith('Invoice_') || doc.title.includes('Invoice #')) {
      try {
        const invoices = await InvoiceService.getInvoices();
        const inv = invoices.find(
          (i) =>
            doc.title.includes(i.invoiceNumber) ||
            doc.fileName === `Invoice_${i.invoiceNumber}.pdf` ||
            (doc.clientId === i.clientId && i.invoiceNumber)
        ) || invoices[0];

        if (inv) {
          const profile = await SettingsService.getUserProfile().catch(() => null);
          await generateInvoicePDF(inv, profile);
          showToast('Invoice PDF Downloaded', `Generated PDF for "${doc.title}".`, 'success');
          return;
        }
      } catch (err) {
        console.warn('Could not generate dynamic invoice PDF:', err);
      }
    }

    if (doc.downloadUrl && doc.downloadUrl !== '#' && doc.downloadUrl !== '') {
      const link = document.createElement('a');
      link.href = doc.downloadUrl;
      link.download = doc.fileName || doc.title;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Download Started', `Downloading "${doc.title}"...`, 'info');
    } else {
      try {
        const preview = await getDocumentPreviewUrl(doc);
        if (preview?.url) {
          const link = document.createElement('a');
          link.href = preview.url;
          link.download = doc.fileName || `${doc.title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('Download Started', `Downloading "${doc.title}"...`, 'info');
          return;
        }
      } catch {
        // fallback
      }
      showToast('No File', `"${doc.title}" has no uploaded file yet.`, 'error');
    }
  };

  const handlePrintDoc = async (doc: DocumentItem) => {
    if (doc.type === 'invoice' || doc.fileName?.startsWith('Invoice_') || doc.title.includes('Invoice #')) {
      try {
        const invoices = await InvoiceService.getInvoices();
        const inv = invoices.find(
          (i) =>
            doc.title.includes(i.invoiceNumber) ||
            doc.fileName === `Invoice_${i.invoiceNumber}.pdf` ||
            (doc.clientId === i.clientId && i.invoiceNumber)
        ) || invoices[0];

        if (inv) {
          const profile = await SettingsService.getUserProfile().catch(() => null);
          printInvoiceDocument(inv, profile);
          return;
        }
      } catch (err) {
        console.warn('Could not print invoice document:', err);
      }
    }
    showToast('Print Document', `Opening document print preview...`, 'info');
    window.print();
  };


  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description?.toLowerCase().includes(search.toLowerCase()) ||
      doc.type?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'verified' ? (doc.status === 'verified' || doc.status === 'signed') : doc.status === statusFilter);
    const matchesClient = clientFilter === 'all' || doc.clientId === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  const statusCounts = {
    all: documents.length,
    pending: documents.filter((d) => d.status === 'pending').length,
    uploaded: documents.filter((d) => d.status === 'uploaded').length,
    verified: documents.filter((d) => d.status === 'verified' || d.status === 'signed').length,
    rejected: documents.filter((d) => d.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Documents</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Request, upload, verify, and organize client agreements and project files.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsRequestModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Request Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="w-full lg:w-80">
          <Input
            type="search"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Client filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="all" className="bg-zinc-900">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900">
                {c.company}
              </option>
            ))}
          </select>

          {/* Status filter pills */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-white/10 rounded-xl">
            {(['all', 'pending', 'uploaded', 'verified', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  statusFilter === st ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {st} <span className="text-[10px] font-mono opacity-70">({statusCounts[st]})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents List */}
      <Card variant="crystal">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-zinc-400">Loading documents...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <FileSearch className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No documents found.</p>
              <p className="text-xs text-zinc-500 mt-1">Try adjusting your filters or request a new document.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white shrink-0 mt-0.5 sm:mt-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{doc.title}</h4>
                        {doc.isRequired && (
                          <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{doc.description || 'No description'}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 font-mono">
                        <span className="uppercase text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          {doc.type}
                        </span>
                        <span>•</span>
                        <span>{doc.size || 'N/A'}</span>
                        {doc.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400">Due: {doc.dueDate}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-zinc-500">Updated: {doc.updatedAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    <StatusPill status={doc.status} />
                    <Button
                      variant={doc.status === 'uploaded' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setPreviewDoc(doc)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      {doc.status === 'uploaded' ? 'Review Document' : 'Preview'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} leftIcon={<Download className="w-3.5 h-3.5" />}>
                      Download
                    </Button>
                    {doc.status !== 'verified' && doc.status !== 'signed' && (
                      <Button variant="secondary" size="sm" onClick={() => setVerifyingDoc(doc)} leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}>
                        Verify
                      </Button>
                    )}
                    {doc.status !== 'rejected' && doc.status !== 'verified' && doc.status !== 'signed' && (
                      <Button variant="ghost" size="sm" onClick={() => setRejectingDoc(doc)} leftIcon={<XCircle className="w-3.5 h-3.5 text-red-400" />}>
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Detailed Request Document Modal */}
      <RequestDocumentModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        clients={clients}
        onSuccess={() => loadData()}
      />

      {/* Verify Modal */}
      <Modal isOpen={!!verifyingDoc} onClose={() => setVerifyingDoc(null)} title="Verify & Accept Document">
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <p className="text-xs text-zinc-300">
            Confirm verification for <strong className="text-white">{verifyingDoc?.title}</strong>:
          </p>
          <textarea
            rows={3}
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            placeholder="Optional verification note..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
          />
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setVerifyingDoc(null)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Approve & Verify'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectingDoc} onClose={() => setRejectingDoc(null)} title="Reject Document">
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <p className="text-xs text-zinc-300">
            Provide rejection reason for <strong className="text-white">{rejectingDoc?.title}</strong>:
          </p>
          <textarea
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Missing signature on page 3..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
            required
          />
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setRejectingDoc(null)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Rejecting...' : 'Reject Document'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* High-Fidelity In-Browser Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        onVerify={(doc) => {
          setPreviewDoc(null);
          setVerifyingDoc(doc);
        }}
        onReject={(doc) => {
          setPreviewDoc(null);
          setRejectingDoc(doc);
        }}
        onDownload={handleDownload}
        onPrint={handlePrintDoc}
      />
    </div>
  );
};
