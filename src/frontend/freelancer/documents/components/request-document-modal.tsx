import React, { useState, useEffect } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { FreelancerDocumentService as DocumentService, FreelancerClientService as ClientService } from '@/backend/freelancer';
import { Client, DocumentItem } from '@/shared/types';
import { useToast } from '@/frontend/shared/ui/toast';
import { FileText, Calendar, Upload, AlertCircle } from 'lucide-react';

interface RequestDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
  clients?: Client[];
  onSuccess?: (newDoc: DocumentItem) => void;
}

export const RequestDocumentModal: React.FC<RequestDocumentModalProps> = ({
  isOpen,
  onClose,
  defaultClientId,
  clients: propClients,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [fetchedClients, setFetchedClients] = useState<Client[]>([]);
  const clients = propClients && propClients.length > 0 ? propClients : fetchedClients;
  const [docTitle, setDocTitle] = useState('');
  const [docClientId, setDocClientId] = useState(defaultClientId || '');
  const [docType, setDocType] = useState<DocumentItem['type']>('contract');
  const [docDescription, setDocDescription] = useState('');
  const [docDueDate, setDocDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [isRequired, setIsRequired] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveClientId = docClientId || defaultClientId || clients[0]?.id || '';

  useEffect(() => {
    if (isOpen && (!propClients || propClients.length === 0)) {
      ClientService.getClients().then((cls) => {
        setFetchedClients(cls);
      }).catch(console.error);
    }
  }, [isOpen, propClients]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetForm = () => {
    setDocTitle('');
    setDocType('contract');
    setDocDescription('');
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDocDueDate(d.toISOString().split('T')[0]);
    setIsRequired(true);
    setSelectedFile(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setError('Document title is required.');
      return;
    }

    const effectiveClientId = docClientId || clients[0]?.id;
    if (!effectiveClientId) {
      setError('Please select a target client.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const createdDoc = await DocumentService.requestDocument(effectiveClientId, {
        title: docTitle.trim(),
        type: docType,
        isRequired,
        dueDate: docDueDate,
        description: docDescription.trim(),
      });

      if (selectedFile && createdDoc?.id) {
        try {
          await DocumentService.uploadDocumentFile(createdDoc.id, {
            fileName: selectedFile.name,
            size: formatFileSize(selectedFile.size),
            file: selectedFile,
          });
        } catch (uploadErr) {
          console.warn('Optional template upload notice:', uploadErr);
        }
      }

      showToast('Document Requested', `Request for "${docTitle.trim()}" dispatched.`, 'success');
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess(createdDoc);
      }
    } catch (err: any) {
      console.error('Request document error:', err);
      setError(err?.message || 'Failed to request document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Document from Client">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}

        <Input
          label="Document Title"
          placeholder="e.g. Master Services Agreement (MSA), W-9, or Brand Guidelines"
          value={docTitle}
          onChange={(e) => setDocTitle(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300">Target Client Workspace</label>
          <select
            value={effectiveClientId}
            onChange={(e) => setDocClientId(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900">
                {c.company} ({c.name})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Category</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="contract" className="bg-zinc-900">Contract / Agreement</option>
              <option value="proposal" className="bg-zinc-900">Statement of Work (SOW)</option>
              <option value="brief" className="bg-zinc-900">Project Brief</option>
              <option value="nda" className="bg-zinc-900">Non-Disclosure Agreement (NDA)</option>
              <option value="tax" className="bg-zinc-900">Tax & Billing Form</option>
              <option value="other" className="bg-zinc-900">Brand Asset / Other</option>
            </select>
          </div>
          <Input
            label="Due Date"
            type="date"
            value={docDueDate}
            onChange={(e) => setDocDueDate(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300">Instructions for Client</label>
          <textarea
            rows={3}
            value={docDescription}
            onChange={(e) => setDocDescription(e.target.value)}
            placeholder="e.g. Please sign Section 4 and upload the executed PDF..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Optional Template / Reference File */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300">Attach Template or Starter File (Optional)</label>
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="req-doc-check"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="rounded bg-zinc-900 border-white/20 text-white cursor-pointer"
          />
          <label htmlFor="req-doc-check" className="text-xs text-zinc-300 cursor-pointer select-none">
            Mark this document as required for project kickoff
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Requesting...' : 'Send Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
