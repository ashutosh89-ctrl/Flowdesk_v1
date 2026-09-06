'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { DocumentItem, PortalFileRequest, Project } from '@/shared/types';
import {
  FileText,
  Folder,
  Upload,
  Download,
  Eye,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Lock,
  Plus,
  Loader2,
  X,
} from 'lucide-react';

export type DocumentCategory =
  | 'contract'
  | 'brief'
  | 'asset'
  | 'deliverable'
  | 'invoice'
  | 'proposal'
  | 'nda'
  | 'tax'
  | 'other';

interface DocumentsPanelProps {
  documents: DocumentItem[];
  fileRequests?: PortalFileRequest[];
  projects?: Project[];
  onUploadClick?: (doc: DocumentItem) => void;
  onDownloadClick: (doc: DocumentItem) => void;
  onFulfillRequestClick?: (req: PortalFileRequest, file: File) => Promise<void>;
  onDirectUpload?: (payload: {
    file: File;
    title: string;
    category: DocumentCategory;
    description?: string;
    projectId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  documents,
  fileRequests = [],
  projects = [],
  onUploadClick,
  onDownloadClick,
  onFulfillRequestClick,
  onDirectUpload,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchDocQuery, setSearchDocQuery] = useState<string>('');

  // Direct Upload Modal State
  const [isDirectUploadOpen, setIsDirectUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('contract');
  const [docProjectId, setDocProjectId] = useState<string>('');
  const [docDescription, setDocDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fulfill Request Modal State
  const [fulfillingRequest, setFulfillingRequest] = useState<PortalFileRequest | null>(null);
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  const folders = [
    'all',
    'Contracts',
    'Briefs',
    'Brand Assets',
    'Deliverables',
    'Invoices & Receipts',
    'Other',
  ];

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredDocs = documents.filter((doc) => {
    const normalize = (str?: string) => (str || '').toLowerCase().replace(/[\s&_-]+/g, '');
    const selectedNorm = normalize(selectedFolder);
    const docType = ((doc.type as string) || 'other').toLowerCase();

    const matchesFolder =
      selectedFolder === 'all' ||
      (selectedFolder === 'Contracts' &&
        (docType === 'contract' || docType === 'nda' || (doc.folder || '').toLowerCase().includes('contract'))) ||
      (selectedFolder === 'Briefs' &&
        (docType === 'brief' || docType === 'proposal' || (doc.folder || '').toLowerCase().includes('brief'))) ||
      (selectedFolder === 'Brand Assets' &&
        (docType === 'asset' ||
          (doc.folder || '').toLowerCase().includes('brand') ||
          (doc.folder || '').toLowerCase().includes('asset'))) ||
      (selectedFolder === 'Deliverables' &&
        (docType === 'deliverable' || (doc.folder || '').toLowerCase().includes('deliverable'))) ||
      (selectedFolder === 'Invoices & Receipts' &&
        (docType === 'invoice' ||
          docType === 'tax' ||
          (doc.folder || '').toLowerCase().includes('invoice') ||
          (doc.folder || '').toLowerCase().includes('receipt'))) ||
      (selectedFolder === 'Other' &&
        (docType === 'other' ||
          !['contract', 'brief', 'asset', 'deliverable', 'invoice', 'proposal', 'nda', 'tax'].includes(docType)));

    const matchesSearch =
      doc.title.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchDocQuery.toLowerCase())) ||
      (doc.description && doc.description.toLowerCase().includes(searchDocQuery.toLowerCase()));

    return matchesFolder && matchesSearch;
  });

  const handleDirectUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (!docTitle.trim()) {
      setUploadError('Please specify a document title.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      if (onDirectUpload) {
        const result = await onDirectUpload({
          file: uploadFile,
          title: docTitle.trim(),
          category: docCategory,
          description: docDescription.trim() || undefined,
          projectId: docProjectId || undefined,
        });

        if (!result.success) {
          setUploadError(result.error || 'Document upload failed. Please try again.');
          return;
        }
      }

      // Reset and close
      setIsDirectUploadOpen(false);
      setUploadFile(null);
      setDocTitle('');
      setDocCategory('contract');
      setDocProjectId('');
      setDocDescription('');
    } catch (err: any) {
      setUploadError(err.message || 'An unexpected error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingRequest || !requestFile) {
      setFulfillError('Please select a file to fulfill this request.');
      return;
    }

    setIsFulfilling(true);
    setFulfillError(null);

    try {
      if (onFulfillRequestClick) {
        await onFulfillRequestClick(fulfillingRequest, requestFile);
      } else if (onUploadClick) {
        onUploadClick({
          id: fulfillingRequest.id,
          clientId: fulfillingRequest.clientId,
          title: fulfillingRequest.title,
          type: 'other',
          status: 'pending',
          updatedAt: new Date().toISOString(),
        });
      }

      setFulfillingRequest(null);
      setRequestFile(null);
    } catch (err: any) {
      setFulfillError(err.message || 'Failed to upload requested file.');
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* File Requests Section */}
      <Card
        variant="crystal"
        className="p-6 border-blue-500/20 bg-gradient-to-r from-blue-950/20 via-zinc-950 to-zinc-950 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-blue-400 font-bold">CLIENT ACTION REQUIRED</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono">
                {fileRequests.filter((r) => r.status === 'pending').length} Outstanding Request(s)
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-1">Requested Document Checklist</h2>
            <p className="text-xs text-zinc-300">Upload required brand assets, contracts, and references</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fileRequests.length === 0 ? (
            <div className="col-span-full py-4 text-xs text-zinc-500 italic text-center">
              No custom file requests pending at this time.
            </div>
          ) : (
            fileRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{req.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        req.status === 'fulfilled'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {req.status === 'fulfilled' ? 'Fulfilled' : 'Pending Upload'}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block">{req.category}</span>
                  {req.description && <p className="text-xs text-zinc-300">{req.description}</p>}
                </div>

                {req.status === 'pending' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center mt-2"
                    onClick={() => {
                      setFulfillingRequest(req);
                      setRequestFile(null);
                      setFulfillError(null);
                    }}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    Upload Requested File
                  </Button>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-mono pt-2 border-t border-white/5">
                    <span>Uploaded: {req.uploadedAt || 'Recently'}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Main Folder & File Explorer */}
      <Card variant="crystal" className="p-6 border-white/15 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Document Repository</h3>
            <p className="text-xs text-zinc-400">Browse and upload shared contracts, briefs, and deliverables</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Upload Document Action */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsDirectUploadOpen(true);
                setUploadFile(null);
                setDocTitle('');
                setDocCategory('contract');
                setDocProjectId('');
                setDocDescription('');
                setUploadError(null);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Upload Document
            </Button>

            {/* Search Bar */}
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchDocQuery}
                onChange={(e) => setSearchDocQuery(e.target.value)}
                placeholder="Search files by name..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        </div>

        {/* Folder Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFolder(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-2 ${
                selectedFolder === f
                  ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/5'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{f === 'all' ? 'All Files' : f}</span>
            </button>
          ))}
        </div>

        {/* Documents Table / Grid */}
        <div className="space-y-3">
          {filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
              <FileText className="w-8 h-8 mx-auto text-zinc-600" />
              <p>No documents found in this category.</p>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{doc.title}</h4>
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400 uppercase">
                        {doc.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {doc.description || doc.fileName || 'Shared Workspace File'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-zinc-500">
                      <span>Updated: {doc.updatedAt}</span>
                      {doc.size && <span>Size: {doc.size}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownloadClick(doc)}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Direct Document Upload Modal */}
      <Modal
        isOpen={isDirectUploadOpen}
        onClose={() => {
          if (!isUploading) {
            setIsDirectUploadOpen(false);
            setUploadFile(null);
            setUploadError(null);
          }
        }}
        title="Upload Document"
        description="Add a contract, brief, brand asset, or reference file directly to your workspace."
      >
        <form onSubmit={handleDirectUploadSubmit} className="space-y-4">
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* File Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">File</label>
            <div className="border-2 border-dashed border-white/15 rounded-2xl p-6 text-center hover:border-emerald-400/50 transition-colors bg-zinc-900/50">
              <input
                type="file"
                id="client-direct-document-file"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    if (!docTitle) {
                      setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg,.zip"
              />
              <label htmlFor="client-direct-document-file" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-zinc-400" />
                <span className="text-xs text-zinc-300 font-semibold">
                  {uploadFile ? uploadFile.name : 'Click to select document'}
                </span>
                <span className="text-[10px] text-zinc-500">PDF, DOCX, XLSX, PNG, JPG, ZIP up to 25MB</span>
              </label>
            </div>
          </div>

          {uploadFile && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">{uploadFile.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono">({formatFileSize(uploadFile.size)})</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadFile(null)}
                className="text-xs text-zinc-400 hover:text-white"
                disabled={isUploading}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Document Title */}
          <Input
            label="Document Title"
            placeholder="e.g. Master Services Agreement"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            disabled={isUploading}
            required
          />

          {/* Category Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Category</label>
            <select
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="contract">Contract / Agreement</option>
              <option value="brief">Project Brief / Specification</option>
              <option value="asset">Brand Asset / Logo / Guidelines</option>
              <option value="deliverable">Deliverable</option>
              <option value="invoice">Invoice / Receipt</option>
              <option value="other">Other Reference Document</option>
            </select>
          </div>

          {/* Project Association (Optional) */}
          {projects.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Associated Project (Optional)</label>
              <select
                value={docProjectId}
                onChange={(e) => setDocProjectId(e.target.value)}
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="">None (Workspace Level)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Notes / Description (Optional)</label>
            <textarea
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              disabled={isUploading}
              placeholder="Add optional context or instructions..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              type="button"
              disabled={isUploading}
              onClick={() => {
                setIsDirectUploadOpen(false);
                setUploadFile(null);
                setUploadError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isUploading || !uploadFile}
              leftIcon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {isUploading ? 'Uploading Document...' : 'Upload Document'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fulfill Requested Document Modal */}
      <Modal
        isOpen={!!fulfillingRequest}
        onClose={() => {
          if (!isFulfilling) {
            setFulfillingRequest(null);
            setRequestFile(null);
            setFulfillError(null);
          }
        }}
        title="Fulfill Document Request"
        description={fulfillingRequest ? `Upload file for "${fulfillingRequest.title}"` : undefined}
      >
        <form onSubmit={handleFulfillSubmit} className="space-y-4">
          {fulfillError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{fulfillError}</span>
            </div>
          )}

          {fulfillingRequest?.description && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300">
              <span className="font-semibold text-white block mb-0.5">Instructions:</span>
              {fulfillingRequest.description}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Select File</label>
            <div className="border-2 border-dashed border-white/15 rounded-2xl p-6 text-center hover:border-emerald-400/50 transition-colors bg-zinc-900/50">
              <input
                type="file"
                id="client-fulfill-document-file"
                className="hidden"
                disabled={isFulfilling}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setRequestFile(file);
                  }
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg,.zip"
              />
              <label htmlFor="client-fulfill-document-file" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-zinc-400" />
                <span className="text-xs text-zinc-300 font-semibold">
                  {requestFile ? requestFile.name : 'Click to select requested file'}
                </span>
                <span className="text-[10px] text-zinc-500">PDF, DOCX, XLSX, PNG, JPG, ZIP up to 25MB</span>
              </label>
            </div>
          </div>

          {requestFile && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">{requestFile.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono">({formatFileSize(requestFile.size)})</span>
              </div>
              <button
                type="button"
                onClick={() => setRequestFile(null)}
                className="text-xs text-zinc-400 hover:text-white"
                disabled={isFulfilling}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              type="button"
              disabled={isFulfilling}
              onClick={() => {
                setFulfillingRequest(null);
                setRequestFile(null);
                setFulfillError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isFulfilling || !requestFile}
              leftIcon={isFulfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {isFulfilling ? 'Uploading File...' : 'Upload & Fulfill'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
