'use client';

import React, { useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Deliverable } from '../../../types';
import { RotateCcw, AlertCircle, Paperclip } from 'lucide-react';

interface RevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverable: Deliverable | null;
  onSubmitRevision: (deliverableId: string, reason: string, priority: string, comment: string) => void;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({
  isOpen,
  onClose,
  deliverable,
  onSubmitRevision,
}) => {
  const [reason, setReason] = useState('Visual Tweaks');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [comment, setComment] = useState('');

  if (!deliverable) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    onSubmitRevision(deliverable.id, reason, priority, comment);
    setComment('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Request Revision: ${deliverable.title}`}>
      <form onSubmit={handleSubmit} className="space-y-5 font-sans">
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">
            Submitting a revision request will notify Alex Rivera and update the deliverable status to <strong>Revision Requested</strong>.
          </p>
        </div>

        {/* Reason Select */}
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-white">Revision Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white focus:outline-none focus:border-white/30"
          >
            <option value="Visual Tweaks">Visual Tweaks & Styling</option>
            <option value="Content Change">Content & Copywriting Update</option>
            <option value="Functional Bug">Functional & Technical Fix</option>
            <option value="Scope Adjustment">Scope / Requirement Shift</option>
            <option value="Other">Other Specific Feedback</option>
          </select>
        </label>

        {/* Priority Select */}
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-white">Revision Priority</span>
          <div className="grid grid-cols-4 gap-2">
            {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                  priority === p
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </label>

        {/* Detailed Feedback */}
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-white">Detailed Change Instructions</span>
          <textarea
            required
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe what needs to be modified or adjusted..."
            className="w-full p-3 rounded-xl bg-zinc-900 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
        </label>

        {/* Mock Attachment Selector */}
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5" />
            <span>Attach reference images or files (optional)</span>
          </div>
          <button type="button" className="px-2.5 py-1 rounded bg-white/10 text-white font-mono text-[10px]">
            Browse
          </button>
        </div>

        {/* Form Footer */}
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={!comment.trim()}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Submit Revision Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};
