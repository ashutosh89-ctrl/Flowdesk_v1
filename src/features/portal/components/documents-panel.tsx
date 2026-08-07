'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { DocumentItem, PortalFileRequest } from '../../../types';
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
} from 'lucide-react';

interface DocumentsPanelProps {
  documents: DocumentItem[];
  fileRequests?: PortalFileRequest[];
  onUploadClick: (doc: DocumentItem) => void;
  onDownloadClick: (doc: DocumentItem) => void;
  onFulfillRequestClick?: (req: PortalFileRequest) => void;
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  documents,
  fileRequests = [],
  onUploadClick,
  onDownloadClick,
  onFulfillRequestClick,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchDocQuery, setSearchDocQuery] = useState<string>('');

  const folders = ['all', 'Contracts', 'Brand Assets', 'Briefs', 'Compliance', 'Invoices & Receipts'];

  const filteredDocs = documents.filter((doc) => {
    const matchesFolder = selectedFolder === 'all' || doc.folder === selectedFolder || doc.type === selectedFolder.toLowerCase();
    const matchesSearch = doc.title.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
                          (doc.fileName && doc.fileName.toLowerCase().includes(searchDocQuery.toLowerCase()));
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* File Requests Section */}
      <Card variant="crystal" className="p-6 border-blue-500/20 bg-gradient-to-r from-blue-950/20 via-zinc-950 to-zinc-950 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-blue-400 font-bold">CLIENT ACTION REQUIRED</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono">
                {fileRequests.filter((r) => r.status === 'pending').length} Outstanding Request(s)
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-1">Requested Document Checklist</h2>
            <p className="text-xs text-zinc-300">Upload required brand assets, contracts, and references for Alex Rivera</p>
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
                    onClick={() =>
                      onFulfillRequestClick
                        ? onFulfillRequestClick(req)
                        : onUploadClick({
                            id: req.id,
                            clientId: req.clientId,
                            title: req.title,
                            type: 'other',
                            status: 'pending',
                            updatedAt: new Date().toISOString(),
                          })
                    }
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
            <p className="text-xs text-zinc-400">Browse shared contracts, briefs, and deliverables</p>
          </div>

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
              <p>No documents found in this folder.</p>
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
                    <h4 className="text-xs font-bold text-white">{doc.title}</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{doc.description || doc.fileName || 'Shared Workspace File'}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-zinc-500">
                      <span>Updated: {doc.updatedAt}</span>
                      {doc.size && <span>Size: {doc.size}</span>}
                      {doc.folder && <span>Folder: {doc.folder}</span>}
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
                  {doc.status === 'pending' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onUploadClick(doc)}
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                    >
                      Upload
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
