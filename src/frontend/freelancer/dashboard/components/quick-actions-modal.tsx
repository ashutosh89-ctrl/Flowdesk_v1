import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Users,
  FolderKanban,
  FileText,
  Receipt,
  FileSearch,
  X,
  ChevronRight,
} from 'lucide-react';
import { CreateClientModal } from '@/frontend/freelancer/clients/components/create-client-modal';
import { CreateProjectModal } from '@/frontend/freelancer/projects/components/create-project-modal';
import { CreateDeliverableModal } from '@/frontend/freelancer/deliverables/components/create-deliverable-modal';
import { InvoiceBuilderModal } from '@/frontend/freelancer/invoices/components/invoice-builder-modal';
import { RequestDocumentModal } from '@/frontend/freelancer/documents/components/request-document-modal';

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onRefresh?: () => void;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onRefresh,
}) => {
  const [activeModal, setActiveModal] = useState<
    'none' | 'client' | 'project' | 'deliverable' | 'invoice' | 'document'
  >('none');

  const handleOpenAction = (action: 'client' | 'project' | 'deliverable' | 'invoice' | 'document') => {
    setActiveModal(action);
  };

  const handleCloseSubModal = () => {
    setActiveModal('none');
    onClose();
  };

  const handleSuccess = (viewName: string) => {
    setActiveModal('none');
    onClose();
    if (onRefresh) onRefresh();
    onNavigate(viewName);
  };

  const actions = [
    {
      id: 'new_client',
      title: 'Create Client Workspace',
      description: 'Onboard a new client into FlowDesk',
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      onClick: () => handleOpenAction('client'),
    },
    {
      id: 'new_project',
      title: 'Create New Project',
      description: 'Set up milestones, budget & target deadlines',
      icon: <FolderKanban className="w-5 h-5 text-sky-400" />,
      onClick: () => handleOpenAction('project'),
    },
    {
      id: 'new_deliverable',
      title: 'Generate Deliverable Package',
      description: 'Package design assets & files for review',
      icon: <FileText className="w-5 h-5 text-emerald-400" />,
      onClick: () => handleOpenAction('deliverable'),
    },
    {
      id: 'new_invoice',
      title: 'Generate Invoice',
      description: 'Create line items and request client payment',
      icon: <Receipt className="w-5 h-5 text-amber-400" />,
      onClick: () => handleOpenAction('invoice'),
    },
    {
      id: 'new_doc',
      title: 'Request Document',
      description: 'Request a document from a client workspace',
      icon: <FileSearch className="w-5 h-5 text-rose-400" />,
      onClick: () => handleOpenAction('document'),
    },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && activeModal === 'none' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -12 }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="relative w-full max-w-lg bg-zinc-950/95 border border-white/20 backdrop-blur-3xl rounded-2xl shadow-2xl overflow-hidden z-10 p-6"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Quick Actions &amp; Create</h3>
                    <p className="text-xs text-zinc-400">Instant workflow launchers for FlowDesk OS.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {actions.map((act) => (
                  <button
                    key={act.id}
                    onClick={act.onClick}
                    className="w-full p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 hover:border-white/20 transition-all text-left flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                        {act.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {act.title}
                        </h4>
                        <p className="text-xs text-zinc-400">{act.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Detailed Feature Modals */}
      {activeModal === 'client' && (
        <CreateClientModal
          isOpen={true}
          onClose={handleCloseSubModal}
          onSuccess={(client) => handleSuccess('clients')}
        />
      )}

      {activeModal === 'project' && (
        <CreateProjectModal
          isOpen={true}
          onClose={handleCloseSubModal}
          onSuccess={(project) => handleSuccess('projects')}
        />
      )}

      {activeModal === 'deliverable' && (
        <CreateDeliverableModal
          isOpen={true}
          onClose={handleCloseSubModal}
          onSuccess={(deliv) => handleSuccess('deliverables')}
        />
      )}

      {activeModal === 'invoice' && (
        <InvoiceBuilderModal
          isOpen={true}
          onClose={handleCloseSubModal}
          onSave={() => handleSuccess('invoices')}
        />
      )}

      {activeModal === 'document' && (
        <RequestDocumentModal
          isOpen={true}
          onClose={handleCloseSubModal}
          onSuccess={(doc) => handleSuccess('documents')}
        />
      )}
    </>
  );
};
