import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { RequestDocumentModal } from '../../documents/components/request-document-modal';
import { DocumentPreviewModal } from '../../documents/components/document-preview-modal';
import { DocumentService, InvoiceService, SettingsService } from '@/backend/freelancer';
import { WorkspaceSummary, DocumentItem } from '@/shared/types';
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
  AlertTriangle,
  Calendar,
  FileCheck,
  Printer,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export interface DocumentsTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ summary, onRefresh }) => {
  const { documents, client } = summary;
  const { showToast } = useToast();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Action Modals
  const [rejectingDoc, setRejectingDoc] = useState<DocumentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifyingDoc, setVerifyingDoc] = useState<DocumentItem | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Form states
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<DocumentItem['type']>('contract');
  const [docDescription, setDocDescription] = useState('');
  const [docDueDate, setDocDueDate] = useState('2026-08-25');
  const [isRequired, setIsRequired] = useState(true);
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  const handleUploadDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    
    const actualFileName = selectedDocFile ? selectedDocFile.name : `${docTitle}.pdf`;
    const actualSize = selectedDocFile ? formatFileSize(selectedDocFile.size) : '1.8 MB';
    
    DocumentService.requestDocument(client.id, { title: docTitle, type: docType }).then((doc) => {
      DocumentService.uploadDocumentFile(doc.id, { fileName: actualFileName, size: actualSize }).then(() => {
        showToast('Document Uploaded', `Uploaded "${docTitle}" to repository.`, 'success');
        setIsUploadModalOpen(false);
        resetForm();
        setSelectedDocFile(null);
        onRefresh();
      });
    });
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingDoc) return;
    DocumentService.verifyDocument(verifyingDoc.id, verificationNotes).then(() => {
      showToast('Document Verified', `"${verifyingDoc.title}" verified successfully.`, 'success');
      setVerifyingDoc(null);
      setVerificationNotes('');
      onRefresh();
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingDoc || !rejectionReason.trim()) return;
    DocumentService.rejectDocument(rejectingDoc.id, rejectionReason).then(() => {
      showToast('Document Rejected', `Document marked as rejected with notes.`, 'error');
      setRejectingDoc(null);
      setRejectionReason('');
      onRefresh();
    });
  };

  const handleRequestReupload = (docId: string, title: string) => {
    DocumentService.requestReupload(docId, 'Please upload a updated or signed copy').then(() => {
      showToast('Re-upload Requested', `Requested client re-upload for "${title}".`, 'info');
      onRefresh();
    });
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

  const resetForm = () => {
    setDocTitle('');
    setDocDescription('');
    setIsRequired(true);
  };

  const filteredDocs = documents.filter((doc) => {
    if (filterStatus === 'pending') return doc.status === 'pending';
    if (filterStatus === 'uploaded') return doc.status === 'uploaded';
    if (filterStatus === 'verified') return doc.status === 'verified' || doc.status === 'signed';
    if (filterStatus === 'rejected') return doc.status === 'rejected';
    return true;
  });

  return (
    <div className="space-y-6">
      <Card variant="crystal">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>{client.company} Documents Repository & Checklist</CardTitle>
              <CardDescription>Contracts, Statements of Work, NDAs, and Tax forms</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsRequestModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Request Document
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsUploadModalOpen(true)}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Upload Document
              </Button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 pt-4 flex-wrap">
            {[
              { id: 'all', label: 'All Documents', count: documents.length },
              { id: 'pending', label: 'Pending Upload', count: documents.filter((d) => d.status === 'pending').length },
              { id: 'uploaded', label: 'Uploaded / Review', count: documents.filter((d) => d.status === 'uploaded').length },
              { id: 'verified', label: 'Verified', count: documents.filter((d) => d.status === 'verified' || d.status === 'signed').length },
              { id: 'rejected', label: 'Rejected', count: documents.filter((d) => d.status === 'rejected').length },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  filterStatus === f.id
                    ? 'bg-white text-zinc-950 font-bold shadow-md'
                    : 'bg-zinc-900/60 border border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                <span>{f.label}</span>
                <span className="text-[10px] font-mono opacity-80 bg-black/20 px-1.5 py-0.2 rounded">{f.count}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredDocs.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-4 text-center">No documents matching selected filter.</p>
            ) : (
              filteredDocs.map((doc) => (
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
                      <p className="text-xs text-zinc-400 mt-0.5">{doc.description}</p>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 font-mono">
                        <span className="uppercase text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          {doc.type}
                        </span>
                        <span>•</span>
                        <span>{doc.size}</span>
                        {doc.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400">Due: {doc.dueDate}</span>
                          </>
                        )}
                      </div>

                      {doc.rejectionReason && (
                        <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                          <strong>Rejection Note:</strong> {doc.rejectionReason}
                        </div>
                      )}

                      {doc.verificationNotes && (
                        <div className="mt-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                          <strong>Verification Note:</strong> {doc.verificationNotes}
                        </div>
                      )}
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

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Download
                    </Button>

                    {doc.status !== 'verified' && doc.status !== 'signed' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setVerifyingDoc(doc)}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        Verify
                      </Button>
                    )}

                    {doc.status !== 'rejected' && doc.status !== 'verified' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRejectingDoc(doc)}
                        leftIcon={<XCircle className="w-3.5 h-3.5 text-red-400" />}
                      >
                        Reject
                      </Button>
                    )}

                    {doc.status === 'rejected' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRequestReupload(doc.id, doc.title)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        Re-upload Request
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full Detailed Request Document Modal */}
      <RequestDocumentModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        defaultClientId={client.id}
        clients={[client]}
        onSuccess={() => onRefresh()}
      />

      {/* Upload Document Modal */}
      <Modal isOpen={isUploadModalOpen} onClose={() => {
        setIsUploadModalOpen(false);
        setSelectedDocFile(null);
        setDocTitle('');
      }} title="Upload Document to Repository">
        <form onSubmit={handleUploadDocument} className="space-y-4">
          <Input
            label="Document Name"
            placeholder="e.g. Signed Brand NDA v1.pdf"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />

          {/* Real file upload input */}
          <div className="border-2 border-dashed border-white/15 rounded-2xl p-6 text-center hover:border-emerald-400/50 transition-colors bg-zinc-900/50">
            <input
              type="file"
              id="document-upload-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedDocFile(file);
                  setDocTitle(file.name.replace(/\.[^/.]+$/, '')); // Set name without extension
                }
              }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg"
            />
            <label
              htmlFor="document-upload-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-6 h-6 text-zinc-400" />
              <span className="text-xs text-zinc-300 font-semibold">
                {selectedDocFile ? selectedDocFile.name : 'Click to select PDF / DOCX file'}
              </span>
              <span className="text-[10px] text-zinc-500">Max file size 25MB</span>
            </label>
          </div>

          {selectedDocFile && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">{selectedDocFile.name}</span>
                <span className="text-[10px] text-zinc-500">({formatFileSize(selectedDocFile.size)})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDocFile(null);
                  setDocTitle('');
                }}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => {
              setIsUploadModalOpen(false);
              setSelectedDocFile(null);
              setDocTitle('');
            }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>

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
            placeholder="Optional verification note or approval comment..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setVerifyingDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Approve & Verify
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
            placeholder="e.g. Missing signature on page 3 or expired date..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
            required
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setRejectingDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Reject Document
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

