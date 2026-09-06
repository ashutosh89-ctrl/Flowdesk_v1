import React from 'react';
import { Pin, Users, FolderKanban, Receipt, FileText, Folder, X, ExternalLink } from 'lucide-react';
import { PinnedItem } from '@/shared/types';

interface PinnedItemsCardProps {
  items: PinnedItem[];
  onUnpin: (resourceId: string) => void;
  onNavigate: (view: string) => void;
}

export const PinnedItemsCard: React.FC<PinnedItemsCardProps> = ({ items, onUnpin, onNavigate }) => {
  const getResourceIcon = (type: PinnedItem['resourceType']) => {
    switch (type) {
      case 'client':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'project':
        return <FolderKanban className="w-4 h-4 text-sky-400" />;
      case 'invoice':
        return <Receipt className="w-4 h-4 text-amber-400" />;
      case 'deliverable':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'document':
      case 'folder':
        return <Folder className="w-4 h-4 text-purple-400" />;
      default:
        return <Pin className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Pin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Pinned Resources</h3>
              <p className="text-xs text-zinc-400">Quick bookmarks for high-frequency workspaces.</p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/40 border border-dashed border-white/10 rounded-xl my-2">
            <Pin className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-zinc-400">No Pinned Bookmarks</p>
            <p className="text-[11px] text-zinc-500 mt-1">Pin clients, projects, invoices or files for instant access.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate(item.path)}
                className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    {getResourceIcon(item.resourceType)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpin(item.resourceId);
                    }}
                    title="Unpin resource"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
