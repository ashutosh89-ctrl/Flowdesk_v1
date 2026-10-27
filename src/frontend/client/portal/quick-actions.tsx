'use client';

import React from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import {
  Upload,
  CheckSquare,
  MessageSquare,
  CreditCard,
  Download,
  Sparkles,
} from 'lucide-react';

interface QuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (actionType: 'upload' | 'approve' | 'comment' | 'pay' | 'download_zip') => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ isOpen, onClose, onActionSelect }) => {
  const actions = [
    {
      id: 'approve' as const,
      title: 'Approve Latest Deliverable',
      desc: 'Inspect pending files and submit formal client sign-off',
      icon: CheckSquare,
      color: 'bg-[#176B5B]/20 border-[#176B5B]/40 text-[#43D6B0]',
    },
    {
      id: 'upload' as const,
      title: 'Upload Requested Files',
      desc: 'Submit requested brand assets, briefs, or compliance documents',
      icon: Upload,
      color: 'bg-[#176B5B]/15 border-[#176B5B]/30 text-[#43D6B0]',
    },
    {
      id: 'pay' as const,
      title: 'Pay Outstanding Statement',
      desc: 'Settle billing statements securely via online payment',
      icon: CreditCard,
      color: 'bg-[#176B5B]/20 border-[#176B5B]/40 text-[#43D6B0]',
    },
    {
      id: 'comment' as const,
      title: 'Post Discussion Note',
      desc: 'Send a quick message to your freelancer in workspace thread',
      icon: MessageSquare,
      color: 'bg-[#176B5B]/10 border-[#176B5B]/25 text-[#A6B4AE]',
    },
    {
      id: 'download_zip' as const,
      title: 'Download Deliverables',
      desc: 'View and download approved deliverable files',
      icon: Download,
      color: 'bg-[#176B5B]/10 border-[#176B5B]/25 text-[#A6B4AE]',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Client Workspace Quick Actions">
      <div className="space-y-3 font-sans">
        <p className="text-xs text-zinc-400">Select an action to perform directly in your client portal</p>

        <div className="space-y-2">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => {
                  onActionSelect(act.id);
                  onClose();
                }}
                className="w-full p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/25 hover:bg-white/[0.04] transition-all flex items-center gap-3 text-left group"
              >
                <div className={`p-2.5 rounded-xl border shrink-0 ${act.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-white transition-colors">{act.title}</h4>
                  <p className="text-[11px] text-zinc-400">{act.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
