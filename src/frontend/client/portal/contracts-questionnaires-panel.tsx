'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Contract, Questionnaire } from '@/shared/types';
import {
  FileCheck2,
  HelpCircle,
  PenTool,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Send,
  Eye,
  FileText,
} from 'lucide-react';

interface ContractsQuestionnairesPanelProps {
  clientId: string;
  contracts: Contract[];
  questionnaires: Questionnaire[];
  onSignContract: (contractId: string, signData: { signedByName: string; signatureDataUrl: string }) => Promise<void>;
  onSubmitQuestionnaire: (questionnaireId: string, responses: Record<string, any>) => Promise<void>;
}

export const ContractsQuestionnairesPanel: React.FC<ContractsQuestionnairesPanelProps> = ({
  clientId,
  contracts,
  questionnaires,
  onSignContract,
  onSubmitQuestionnaire,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'contracts' | 'questionnaires'>('contracts');

  // Contract signing modal state
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [signing, setSigning] = useState(false);

  // Questionnaire answering modal state
  const [selectedQ, setSelectedQ] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submittingQ, setSubmittingQ] = useState(false);

  const handleSign = async () => {
    if (!selectedContract || !signerName.trim() || !agreeTerms) return;
    setSigning(true);
    try {
      const signatureDataUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60"><text x="10" y="40" font-family="cursive" font-size="24" fill="%2343D6B0">${encodeURIComponent(signerName.trim())}</text></svg>`;
      await onSignContract(selectedContract.id, {
        signedByName: signerName.trim(),
        signatureDataUrl,
      });
      setSelectedContract(null);
      setSignerName('');
      setAgreeTerms(false);
    } finally {
      setSigning(false);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!selectedQ) return;
    setSubmittingQ(true);
    try {
      await onSubmitQuestionnaire(selectedQ.id, answers);
      setSelectedQ(null);
      setAnswers({});
    } finally {
      setSubmittingQ(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Toggle */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <button
          type="button"
          onClick={() => setActiveSubTab('contracts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === 'contracts'
              ? 'bg-[#176B5B] text-white shadow-lg shadow-[#176B5B]/30'
              : 'text-zinc-400 hover:text-white bg-white/5'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Contracts & Agreements ({contracts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('questionnaires')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeSubTab === 'questionnaires'
              ? 'bg-[#176B5B] text-white shadow-lg shadow-[#176B5B]/30'
              : 'text-zinc-400 hover:text-white bg-white/5'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Intake & Questionnaires ({questionnaires.length})
        </button>
      </div>

      {/* Contracts View */}
      {activeSubTab === 'contracts' && (
        <div className="space-y-4">
          {contracts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-zinc-500 opacity-60" />
              <p className="font-medium text-white">No contracts pending</p>
              <p className="text-xs text-zinc-400 mt-1">Agreements sent by your freelancer will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contracts.map((c) => {
                const isSigned = c.status === 'signed';
                return (
                  <Card key={c.id} className="border-white/10 bg-zinc-900/60 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base font-bold text-white leading-snug">
                          {c.title}
                        </CardTitle>
                        <StatusPill
                          status={isSigned ? 'signed' : 'pending'}
                          customLabel={isSigned ? 'Signed' : 'Awaiting Signature'}
                        />
                      </div>
                      <CardDescription className="line-clamp-2 text-xs text-zinc-400 mt-1">
                        {c.terms || 'Standard Master Service Agreement terms apply.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 border-t border-white/10 flex items-center justify-between text-xs mt-3">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {isSigned ? `Signed by ${c.signedByName || 'Client'}` : 'Requires your approval'}
                      </span>
                      <Button
                        type="button"
                        variant={isSigned ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => {
                          setSelectedContract(c);
                          setSignerName('');
                          setAgreeTerms(false);
                        }}
                        leftIcon={isSigned ? <Eye className="w-3.5 h-3.5" /> : <PenTool className="w-3.5 h-3.5" />}
                      >
                        {isSigned ? 'View Agreement' : 'Review & Sign'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Questionnaires View */}
      {activeSubTab === 'questionnaires' && (
        <div className="space-y-4">
          {questionnaires.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400">
              <HelpCircle className="w-10 h-10 mx-auto mb-2 text-zinc-500 opacity-60" />
              <p className="font-medium text-white">No questionnaires assigned</p>
              <p className="text-xs text-zinc-400 mt-1">Project intake questions will appear here when requested.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questionnaires.map((q) => {
                const isSubmitted = q.status === 'submitted';
                return (
                  <Card key={q.id} className="border-white/10 bg-zinc-900/60 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base font-bold text-white leading-snug">
                          {q.title}
                        </CardTitle>
                        <StatusPill
                          status={isSubmitted ? 'completed' : 'pending'}
                          customLabel={isSubmitted ? 'Completed' : 'Action Required'}
                        />
                      </div>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {q.description || `${q.questions?.length || 0} questions to complete.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 border-t border-white/10 flex items-center justify-between text-xs mt-3">
                      <span className="text-[11px] text-zinc-500">
                        {isSubmitted ? 'Answers submitted' : `${q.questions?.length || 0} intake questions`}
                      </span>
                      <Button
                        type="button"
                        variant={isSubmitted ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => {
                          setSelectedQ(q);
                          setAnswers(q.responses || {});
                        }}
                        leftIcon={isSubmitted ? <Eye className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                      >
                        {isSubmitted ? 'Review Responses' : 'Complete Form'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contract Signature / Review Modal */}
      {selectedContract && (
        <Modal
          isOpen={!!selectedContract}
          onClose={() => setSelectedContract(null)}
          title={selectedContract.title}
          size="lg"
        >
          <div className="space-y-5">
            <div className="max-h-72 overflow-y-auto p-4 rounded-xl bg-black/40 border border-white/10 text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
              {selectedContract.content}
            </div>

            {selectedContract.terms && (
              <div className="p-3 rounded-lg bg-zinc-800/60 border border-white/5 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-200">Legal Terms: </span>
                {selectedContract.terms}
              </div>
            )}

            {selectedContract.status === 'signed' ? (
              <div className="p-4 rounded-xl bg-[#176B5B]/20 border border-[#176B5B]/40 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-[#43D6B0] shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-white">Digitally Executed & Locked</p>
                  <p className="text-zinc-300 mt-0.5">
                    Signed by {selectedContract.signedByName} on {new Date(selectedContract.signedAt || '').toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Full Legal Name (Authorized Signatory)
                  </label>
                  <Input
                    placeholder="e.g. Jane Doe"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20 text-[#176B5B] focus:ring-[#43D6B0]"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    I confirm that I am authorized to execute this agreement and accept all terms and conditions above.
                  </span>
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setSelectedContract(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!signerName.trim() || !agreeTerms || signing}
                    isLoading={signing}
                    onClick={handleSign}
                    leftIcon={<PenTool className="w-4 h-4" />}
                  >
                    Execute & Sign Agreement
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Questionnaire Answering Modal */}
      {selectedQ && (
        <Modal
          isOpen={!!selectedQ}
          onClose={() => setSelectedQ(null)}
          title={selectedQ.title}
          size="lg"
        >
          <div className="space-y-4">
            {selectedQ.description && (
              <p className="text-xs text-zinc-400">{selectedQ.description}</p>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {selectedQ.questions.map((q, idx) => {
                const isReadOnly = selectedQ.status === 'submitted';
                return (
                  <div key={q.id || idx} className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
                    <label className="block text-xs font-semibold text-zinc-200">
                      {idx + 1}. {q.prompt}
                      {q.required && <span className="text-rose-400 ml-1">*</span>}
                    </label>

                    {q.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        disabled={isReadOnly}
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder="Provide details..."
                        className="w-full text-xs rounded-lg bg-black/40 border border-white/15 p-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#43D6B0]"
                      />
                    ) : (
                      <Input
                        disabled={isReadOnly}
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder="Your response..."
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <Button variant="ghost" onClick={() => setSelectedQ(null)}>
                Close
              </Button>
              {selectedQ.status !== 'submitted' && (
                <Button
                  variant="primary"
                  isLoading={submittingQ}
                  onClick={handleSubmitAnswers}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Submit Answers
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
