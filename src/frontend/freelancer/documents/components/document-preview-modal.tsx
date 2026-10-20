'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { DocumentItem } from '@/shared/types';
import { getDocumentPreviewUrl, DocumentPreviewResult } from '@/shared/utils/document-preview';
import {
  FileText,
  Download,
  Printer,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem | null;
  onVerify?: (doc: DocumentItem) => void;
  onReject?: (doc: DocumentItem) => void;
  onDownload?: (doc: DocumentItem) => void;
  onPrint?: (doc: DocumentItem) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onVerify,
  onReject,
  onDownload,
  onPrint,
}) => {
  const [previewResult, setPreviewResult] = useState<DocumentPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load or generate preview URL whenever the selected document changes
  useEffect(() => {
    let isCancelled = false;

    if (!isOpen || !doc) {
      setPreviewResult(null);
      setIsLoading(false);
      setError(null);
      setZoomLevel(100);
      setRotation(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    getDocumentPreviewUrl(doc)
      .then((res) => {
        if (!isCancelled) {
          setPreviewResult(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Document preview resolution error:', err);
          setError('Could not load document preview.');
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => {
    setZoomLevel(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handlePrint = () => {
    if (onPrint) {
      onPrint(doc);
      return;
    }
    if (previewResult?.url) {
      if (previewResult.fileType === 'pdf' && iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
          return;
        } catch {
          // fallback to opening url in print
        }
      }
      const printWindow = window.open(previewResult.url, '_blank');
      printWindow?.focus();
      printWindow?.print();
    } else {
      window.print();
    }
  };

  const handleOpenExternal = () => {
    if (previewResult?.url) {
      window.open(previewResult.url, '_blank', 'noopener,noreferrer');
    }
  };

  const isVerified = doc.status === 'verified' || doc.status === 'signed';
  const isImage = previewResult?.fileType === 'image';
  const isPdf = previewResult?.fileType === 'pdf';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size={isFullScreen ? 'full' : 'xl'}
    >
      <div className="flex flex-col h-full -m-6 max-h-[88vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                  {doc.title}
                </h3>
                <StatusPill status={doc.status} />
                <span className="text-[10px] font-mono uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-300">
                  {doc.type}
                </span>
                {doc.isRequired && (
                  <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    REQUIRED
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {doc.fileName || doc.title} • {doc.size || 'N/A'} • Updated: {doc.updatedAt}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && (
              <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-xl px-2 py-1 mr-2 text-xs font-mono text-zinc-400">
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                  className="px-1 text-[11px] hover:text-white transition-colors"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  title="Zoom In"
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRotate}
                  title="Rotate 90°"
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors ml-1 border-l border-white/10 pl-2"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullScreen((prev) => !prev)}
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen View'}
              className="p-2 text-zinc-400 hover:text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            {previewResult?.url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenExternal}
                title="Open in new window"
                className="p-2 text-zinc-400 hover:text-white"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              className="hidden sm:inline-flex"
            >
              Print
            </Button>

            {onDownload && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onDownload(doc)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download
              </Button>
            )}
          </div>
        </div>

        {/* Document Preview Viewport */}
        <div className="relative flex-1 bg-zinc-950 p-4 sm:p-6 overflow-hidden flex flex-col justify-center items-center min-h-[520px] lg:min-h-[620px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-xs font-mono">Loading document preview...</p>
              <span className="text-[10px] text-zinc-500">Preparing secure in-browser reader</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center max-w-md space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Preview Unavailable</h4>
              <p className="text-xs text-zinc-400">{error}</p>
              {onDownload && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onDownload(doc)}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Download Document
                </Button>
              )}
            </div>
          ) : previewResult ? (
            <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl relative">
              {isPdf ? (
                /* Native In-Browser PDF Reader */
                <iframe
                  ref={iframeRef}
                  src={`${previewResult.url}#toolbar=1&navpanes=1&view=FitH`}
                  className="w-full h-full min-h-[520px] lg:min-h-[620px] rounded-xl border-0 bg-zinc-900"
                  title={`Preview of ${doc.title}`}
                />
              ) : isImage ? (
                /* High-Res Interactive Image Viewer */
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4 bg-[#0a0a0c]">
                  <div
                    style={{
                      transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    className="max-w-full max-h-full flex items-center justify-center origin-center select-none shadow-2xl rounded-lg overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewResult.url}
                      alt={doc.title}
                      className="max-w-full max-h-[75vh] object-contain rounded-lg border border-white/10"
                    />
                  </div>
                </div>
              ) : (
                /* Generic Text/Document Viewer */
                <iframe
                  ref={iframeRef}
                  src={previewResult.url}
                  className="w-full h-full min-h-[520px] rounded-xl border-0 bg-zinc-900"
                  title={`Preview of ${doc.title}`}
                />
              )}
            </div>
          ) : null}
        </div>

        {/* Bottom Review & Verification Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-zinc-950/90 shrink-0">
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Secure In-Browser Review (No local download required)
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isVerified && onReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReject(doc)}
                leftIcon={<XCircle className="w-3.5 h-3.5 text-rose-400" />}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Reject Document
              </Button>
            )}

            {!isVerified && onVerify && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onVerify(doc)}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              >
                Approve & Verify
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
