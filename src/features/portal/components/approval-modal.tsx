'use client';

import React, { useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Deliverable } from '../../../types';
import { CheckSquare, ShieldCheck, Download, History, RotateCcw, FileText } from 'lucide-react';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverable: Deliverable | null;
  onConfirmApprove: (deliverableId: string, approvalNotes?: string) => void;
  onRequestRevision: (deliverable: Deliverable) => void;
  onDownload: (deliverable: Deliverable) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  isOpen,
  onClose,
  deliverable,
  onConfirmApprove,
  onRequestRevision,
  onDownload,
}) => {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);

  if (!deliverable) return null;

  const handleApprove = () => {
    if (!confirmedCheckbox) return;
    onConfirmApprove(deliverable.id, approvalNotes);
    setConfirmedCheckbox(false);
    setApprovalNotes('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Approve Deliverable: ${deliverable.title}`}>
      <div className="space-y-6 font-sans">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-white/10 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Work Sign-Off Protocol</span>
              <h4 className="text-sm font-bold text-white mt-0.5">{deliverable.title}</h4>
            </div>
            <span className="px-2.5 py-1 rounded bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">
              {deliverable.version || 'v1.0'}
            </span>
          </div>

          <p className="text-xs text-zinc-300">{deliverable.description}</p>

          <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400 pt-1">
            <span>Deadline: {deliverable.dueDate}</span>
            {deliverable.fileSize && <span>File Size: {deliverable.fileSize}</span>}
          </div>
        </div>

        {/* Quick Actions inside modal */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownload(deliverable)}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Download File
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              onRequestRevision(deliverable);
            }}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
          >
            Request Revision Instead
          </Button>
        </div>

        {/* Approval Confirmation Form */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-white">Approval Comments (Optional)</span>
            <textarea
              rows={2}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Leave sign-off notes for Rivera Studio..."
              className="w-full p-3 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
            />
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedCheckbox}
              onChange={(e) => setConfirmedCheckbox(e.target.checked)}
              className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-emerald-400 focus:ring-emerald-400"
            />
            <span className="text-xs text-emerald-200 leading-relaxed">
              I confirm that I have inspected this deliverable and grant formal client sign-off for milestone completion.
            </span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            disabled={!confirmedCheckbox}
            onClick={handleApprove}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Confirm Sign-Off & Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
};
