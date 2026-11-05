'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
import { Questionnaire, QuestionnaireQuestion, QuestionnaireStatus, WorkspaceSummary } from '@/shared/types';
import { QuestionnaireService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  ClipboardList,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Loader2,
  Eye,
} from 'lucide-react';

export interface QuestionnairesTabProps {
  summary: WorkspaceSummary;
  onRefresh?: () => void;
}

export const QuestionnairesTab: React.FC<QuestionnairesTabProps> = ({ summary, onRefresh }) => {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<{ prompt: string; type: 'text' | 'textarea'; required: boolean }[]>([
    { prompt: 'What are the core business goals for this project?', type: 'textarea', required: true },
    { prompt: 'Who is your target audience or key customer segment?', type: 'text', required: true },
  ]);
  const [selectedQ, setSelectedQ] = useState<Questionnaire | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const loadQuestionnaires = async () => {
    try {
      setLoading(true);
      const data = await QuestionnaireService.getQuestionnaires(summary.client.id);
      setQuestionnaires(data || []);
    } catch {
      showToast('Error', 'Could not load questionnaires.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestionnaires();
  }, [summary.client.id]);

  const handleAddQuestionRow = () => {
    setQuestions((prev) => [...prev, { prompt: '', type: 'text', required: false }]);
  };

  const handleRemoveQuestionRow = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || questions.length === 0) return;

    try {
      setSubmitting(true);
      const formattedQuestions: QuestionnaireQuestion[] = questions.map((q, i) => ({
        id: `q-${i + 1}`,
        prompt: q.prompt.trim() || `Question ${i + 1}`,
        type: q.type,
        required: q.required,
      }));

      const created = await QuestionnaireService.createQuestionnaire({
        clientId: summary.client.id,
        title: title.trim(),
        description: description.trim(),
        questions: formattedQuestions,
      });

      setQuestionnaires((prev) => [created, ...prev]);
      showToast('Questionnaire Created', `Sent "${created.title}" to client onboarding tab.`, 'success');
      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to create questionnaire.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: QuestionnaireStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Responses Received
          </span>
        );
      case 'sent':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Awaiting Client Answers
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
        <p className="text-xs">Loading client questionnaires...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#43D6B0]" />
            Client Intake Questionnaires
          </h3>
          <p className="text-xs text-zinc-400">
            Collect structured onboarding requirements, brand preferences, and project assets from clients.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          New Questionnaire
        </Button>
      </div>

      {/* Questionnaire Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {questionnaires.length === 0 ? (
          <div className="col-span-full p-12 text-center text-xs text-zinc-400 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
            No onboarding forms sent yet. Click &quot;New Questionnaire&quot; to build custom client intake questions.
          </div>
        ) : (
          questionnaires.map((q) => (
            <Card key={q.id} variant="crystal" className="flex flex-col justify-between hover:border-[#43D6B0]/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <CardTitle className="text-base text-white">{q.title}</CardTitle>
                  {getStatusBadge(q.status)}
                </div>
                {q.description && (
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    {q.description}
                  </p>
                )}
                <span className="font-mono text-[11px] text-[#43D6B0]">
                  {q.questions.length} structured {q.questions.length === 1 ? 'question' : 'questions'}
                </span>
              </CardHeader>

              <CardContent className="pt-0 border-t border-white/10 flex items-center justify-between text-xs mt-3">
                <span className="text-[11px] text-zinc-500 font-mono">
                  {q.status === 'submitted' ? 'Answered' : 'Awaiting responses'}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedQ(q)}
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                >
                  {q.status === 'submitted' ? 'Review Answers' : 'Inspect Form'}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Questionnaire Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Client Questionnaire"
        description="Build an onboarding question list for your client to answer in their portal."
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Form Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Brand Strategy &amp; Identity Discovery"
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#43D6B0]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Instructions for Client</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly guide the client on what kind of answers help most..."
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#43D6B0] text-xs"
            />
          </div>

          {/* Dynamic Question Builder */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">Questions</span>
              <button
                type="button"
                onClick={handleAddQuestionRow}
                className="text-xs font-semibold text-[#43D6B0] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {questions.map((q, idx) => (
                <div key={idx} className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">Q{idx + 1}</span>
                    <input
                      type="text"
                      required
                      placeholder="Enter question prompt..."
                      value={q.prompt}
                      onChange={(e) => {
                        const copy = [...questions];
                        copy[idx].prompt = e.target.value;
                        setQuestions(copy);
                      }}
                      className="flex-1 bg-[#101312] border border-[#176B5B]/30 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#43D6B0]"
                    />
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const copy = [...questions];
                        copy[idx].type = e.target.value as any;
                        setQuestions(copy);
                      }}
                      className="bg-[#101312] border border-[#176B5B]/30 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                    >
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Answer</option>
                    </select>

                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestionRow(idx)}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Publish Questionnaire'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inspect Questionnaire & Responses Modal */}
      {selectedQ && (
        <Modal
          isOpen={Boolean(selectedQ)}
          onClose={() => setSelectedQ(null)}
          title={selectedQ.title}
          description={selectedQ.description || 'Client onboarding responses.'}
          size="lg"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedQ.questions.map((q) => {
                const response = selectedQ.responses?.[q.id];
                return (
                  <div key={q.id} className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-1.5">
                    <p className="font-semibold text-zinc-200">{q.prompt}</p>
                    <div className="p-2.5 bg-[#101312] rounded-lg border border-white/5 text-zinc-300 font-sans">
                      {response ? (
                        <p className="whitespace-pre-wrap">{response}</p>
                      ) : (
                        <span className="italic text-zinc-500">Awaiting client response...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setSelectedQ(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

