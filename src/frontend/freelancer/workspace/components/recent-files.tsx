import React from 'react';
import { Card } from '@/frontend/shared/ui/card';
import { DocumentItem, Deliverable } from '@/shared/types';
import { FileText, Download, ShieldCheck, Clock, ExternalLink } from 'lucide-react';

export interface RecentFilesProps {
  documents: DocumentItem[];
  deliverables: Deliverable[];
}

export const RecentFiles: React.FC<RecentFilesProps> = ({ documents, deliverables }) => {
  const recentDocs = documents.slice(0, 4);

  return (
    <Card variant="crystal" className="p-5 border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-purple-400" />
          Recent Workspace Files
        </h3>
      </div>

      <div className="space-y-2">
        {recentDocs.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">No documents uploaded yet.</p>
        ) : (
          recentDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-colors text-xs"
            >
              <div className="flex items-center gap-2.5 truncate">
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <div className="truncate">
                  <p className="font-semibold text-white truncate">{doc.title}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {doc.size || '1.2 MB'} • {doc.updatedAt}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 capitalize">
                {doc.status}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
