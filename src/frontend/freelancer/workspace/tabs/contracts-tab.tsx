'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
import { Contract, ContractStatus, WorkspaceSummary } from '@/shared/types';
import { ContractService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  FileCheck2,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  PenTool,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export interface ContractsTabProps {
  summary: WorkspaceSummary;
  onRefresh?: () => void;
}

export const ContractsTab: React.FC<ContractsTabProps> = ({ summary, onRefresh }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [terms, setTerms] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const loadContracts = async () => {
    try {
      setLoading(true);
      const data = await ContractService.getContracts(summary.client.id);
      setContracts(data || []);
    } catch {
      showToast('Error', 'Could not load contracts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, [summary.client.id]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      const created = await ContractService.createContract({
        clientId: summary.client.id,
        title: title.trim(),
        content: content.trim(),
        terms: terms.trim() || 'Payment due upon milestone completion. Intellectual property rights transfer upon final settlement.',
      });

      setContracts((prev) => [created, ...prev]);
      showToast('Contract Generated', `Contract "${created.title}" ready to send.`, 'success');
      setIsCreateOpen(false);
      setTitle('');
      setContent('');
      setTerms('');
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to create contract.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'signed':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Signed &amp; Legally Binding
          </span>
        );
      case 'sent':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Awaiting Client Signature
          </span>
        );
      case 'declined':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" /> Changes Requested
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/30">
            Draft
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 text-zinc-400">
        <Loader2 className="w-7 h-7 animate-spin text-[#43D6B0]" />
        <p className="text-xs">Loading client contracts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-[#43D6B0]" />
            Digital Agreements &amp; Signatures
          </h3>
          <p className="text-xs text-zinc-400">
            Create binding project agreements, intellectual property assignments, and record electronic sign-offs.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Draft Agreement
        </Button>
      </div>

      {/* Contract Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contracts.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs text-zinc-400 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            No agreements created for this client yet. Click &quot;Draft Agreement&quot; to establish terms.
          </div>
        ) : (
          contracts.map((c) => (
            <Card key={c.id} variant="crystal" className="flex flex-col justify-between hover:border-[#43D6B0]/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <CardTitle className="text-base text-white">{c.title}</CardTitle>
                  {getStatusBadge(c.status)}
                </div>
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                  {c.content}
                </p>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {c.status === 'signed' && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Electronically Verified</span>
                    </div>
                    <p className="text-zinc-300 text-[11px]">
                      Signer: <strong className="text-white">{c.signedByName || summary.client.name}</strong>
                    </p>
                    <p className="text-zinc-400 text-[10px] font-mono">
                      Timestamp: {c.signedAt ? new Date(c.signedAt).toLocaleString() : 'Recorded'}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recently'}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedContract(c)}
                  >
                    View Terms
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Agreement Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Draft Digital Agreement"
        description="Establish formal scope, intellectual property rights, and payment terms for this client."
        size="lg"
      >
        <form onSubmit={handleCreateContract} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Contract Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Master Services Agreement &amp; Deliverable Scope"
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#43D6B0]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Agreement Body / Scope of Work *</label>
            <textarea
              rows={6}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Outline specific milestones, revisions included, timelines, and final delivery conditions..."
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#43D6B0] font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Terms &amp; Intellectual Property Clauses</label>
            <textarea
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. All source files and intellectual property transfer automatically to client upon full payment of all invoices."
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#43D6B0] text-xs"
            />
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Save & Prepare Agreement'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Agreement Detail Modal */}
      {selectedContract && (
        <Modal
          isOpen={Boolean(selectedContract)}
          onClose={() => setSelectedContract(null)}
          title={selectedContract.title}
          description="Legally documented client agreement."
          size="lg"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 font-mono text-zinc-300 whitespace-pre-wrap max-h-72 overflow-y-auto">
              {selectedContract.content}
            </div>

            {selectedContract.terms && (
              <div className="p-3 bg-[#43D6B0]/5 border border-[#43D6B0]/20 rounded-xl space-y-1">
                <span className="font-bold text-[#43D6B0]">Commercial Terms &amp; IP Clause</span>
                <p className="text-zinc-300 leading-relaxed">{selectedContract.terms}</p>
              </div>
            )}

            {selectedContract.status === 'signed' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-emerald-400">Signed by {selectedContract.signedByName}</p>
                  <p className="text-[10px] text-zinc-400">Date: {selectedContract.signedAt ? new Date(selectedContract.signedAt).toLocaleString() : 'Recorded'}</p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setSelectedContract(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

