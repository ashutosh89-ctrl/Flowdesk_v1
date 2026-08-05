import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { DocumentService } from '../../../services';
import { WorkspaceSummary, DocumentItem } from '../../../types';
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
} from 'lucide-react';
import { useToast } from '../../../components/ui/toast';

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

  const handleRequestDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    DocumentService.requestDocument(client.id, {
      title: docTitle,
      type: docType,
      isRequired,
      dueDate: docDueDate,
      description: docDescription,
    }).then(() => {
      showToast('Document Requested', `Requested "${docTitle}" from client checklist.`, 'success');
      setIsRequestModalOpen(false);
      resetForm();
      onRefresh();
    });
  };

  const handleUploadDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;
    DocumentService.requestDocument(client.id, { title: docTitle, type: docType }).then((doc) => {
      DocumentService.uploadDocumentFile(doc.id, { fileName: `${docTitle}.pdf`, size: '1.8 MB' }).then(() => {
        showToast('Document Uploaded', `Uploaded "${docTitle}" to repository.`, 'success');
        setIsUploadModalOpen(false);
        resetForm();
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

  const handleDownload = (title: string) => {
    showToast('Download Started', `Downloading "${title}"...`, 'info');
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
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewDoc(doc)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Preview
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc.title)}
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

      {/* Request Document Modal */}
      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Request Document from Client">
        <form onSubmit={handleRequestDocument} className="space-y-4">
          <Input
            label="Document Title"
            placeholder="e.g. Master Services Agreement (MSA) or Tax W-9"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">Document Category</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="contract">Contract / MSA</option>
                <option value="proposal">Statement of Work (SOW)</option>
                <option value="brief">Project Brief</option>
                <option value="nda">Non-Disclosure Agreement (NDA)</option>
                <option value="tax">Tax & Billing Form</option>
                <option value="other">Brand Asset / Other</option>
              </select>
            </div>

            <Input
              label="Due Date"
              type="date"
              value={docDueDate}
              onChange={(e) => setDocDueDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Instruction for Client</label>
            <textarea
              rows={2}
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              placeholder="e.g. Please sign on page 4 and upload the executed PDF copy..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="req-check"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="rounded bg-zinc-900 border-white/20 text-white"
            />
            <label htmlFor="req-check" className="text-xs text-zinc-300">
              Mark as Required (Blocks workspace health if missing)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Send Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload Document Modal */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Document to Repository">
        <form onSubmit={handleUploadDocument} className="space-y-4">
          <Input
            label="Document Name"
            placeholder="e.g. Signed Brand NDA v1.pdf"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />

          <div className="p-6 rounded-2xl border-2 border-dashed border-white/15 bg-zinc-900/50 flex flex-col items-center justify-center text-center space-y-2">
            <Upload className="w-6 h-6 text-zinc-400" />
            <span className="text-xs text-zinc-300 font-semibold">Click or drag PDF / DOCX file here</span>
            <span className="text-[10px] text-zinc-500">Max file size 25MB</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsUploadModalOpen(false)}>
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

      {/* Document Preview Modal */}
      <Modal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.title || 'Document Preview'}>
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-white" />
                <span className="text-sm font-bold text-white">{previewDoc?.title}</span>
              </div>
              <StatusPill status={previewDoc?.status || 'signed'} />
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-zinc-300 space-y-2 font-mono">
              <p><strong>Type:</strong> {previewDoc?.type.toUpperCase()}</p>
              <p><strong>File Size:</strong> {previewDoc?.size}</p>
              <p><strong>Last Updated:</strong> {previewDoc?.updatedAt}</p>
              <p><strong>Requirement:</strong> {previewDoc?.isRequired ? 'Mandatory' : 'Optional'}</p>
            </div>

            <div className="p-8 border border-white/10 rounded-xl bg-zinc-900 text-center text-xs text-zinc-400 font-mono">
              [ PDF / Document Preview Container ]
              <br />
              Digital signature checksum verified.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setPreviewDoc(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                handleDownload(previewDoc?.title || '');
                setPreviewDoc(null);
              }}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

