import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Users,
  FolderKanban,
  Receipt,
  FileText,
  FileSearch,
  MessageSquare,
  Activity,
  Pin,
  CornerDownLeft,
  X,
  Sparkles,
} from 'lucide-react';
import { FlowDeskStore } from '../../../services/storage-store';
import { SearchResultItem } from '../../../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Clients' | 'Projects' | 'Invoices' | 'Deliverables' | 'Documents'>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const indexData = useMemo(() => FlowDeskStore.getSearchIndex(), [isOpen]);

  const allItems: SearchResultItem[] = useMemo(() => {
    return [
      ...indexData.clients,
      ...indexData.projects,
      ...indexData.invoices,
      ...indexData.deliverables,
      ...indexData.documents,
      ...indexData.comments,
      ...indexData.activities,
    ];
  }, [indexData]);

  const filteredItems = useMemo(() => {
    let list = allItems;
    if (selectedCategory !== 'All') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 20);
  }, [allItems, query, selectedCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleKeyDownInInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        const item = filteredItems[selectedIndex];
        FlowDeskStore.addRecentSearch(item.title);
        FlowDeskStore.trackRecentWork({
          resourceId: item.id,
          title: item.title,
          type: item.type === 'comment' || item.type === 'activity' ? 'project' : item.type,
          subtitle: item.subtitle,
          path: item.path,
          clientId: item.clientId,
        });
        onNavigate(item.path);
        onClose();
      }
    }
  };

  const getCategoryIcon = (type: SearchResultItem['type']) => {
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
        return <FileSearch className="w-4 h-4 text-rose-400" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 select-none">
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
            className="relative w-full max-w-2xl bg-zinc-950/95 border border-white/20 backdrop-blur-3xl rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden z-10 flex flex-col"
          >
            {/* Input Bar */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-white/[0.02]">
              <Search className="w-5 h-5 text-amber-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onKeyDown={handleKeyDownInInput}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Global Search: client, project, invoice #, file, milestone..."
                className="w-full bg-transparent text-white text-base placeholder-zinc-500 focus:outline-none"
              />
              <button
                onClick={onClose}
                className="px-2 py-1 text-[10px] font-mono text-zinc-400 bg-white/10 border border-white/15 rounded-md hover:bg-white/20 transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 p-3 px-4 border-b border-white/10 bg-zinc-900/50 overflow-x-auto scrollbar-none">
              {(['All', 'Clients', 'Projects', 'Invoices', 'Deliverables', 'Documents'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    selectedCategory === cat
                      ? 'bg-white text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="p-2 max-h-[380px] overflow-y-auto space-y-1">
              {filteredItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-zinc-500 font-mono">
                  No workspace items matched &quot;{query}&quot;
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        FlowDeskStore.addRecentSearch(item.title);
                        FlowDeskStore.trackRecentWork({
                          resourceId: item.id,
                          title: item.title,
                          type: item.type === 'comment' || item.type === 'activity' ? 'project' : item.type,
                          subtitle: item.subtitle,
                          path: item.path,
                          clientId: item.clientId,
                        });
                        onNavigate(item.path);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-white/10 border border-white/20 text-white shadow-md'
                          : 'bg-transparent text-zinc-300 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white text-zinc-950' : 'bg-white/10 text-zinc-300 border border-white/10'
                          }`}
                        >
                          {getCategoryIcon(item.type)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                            {item.badge}
                          </span>
                        )}
                        {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 px-4 border-t border-white/10 bg-zinc-950 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>ESC Close</span>
              </div>
              <span className="flex items-center gap-1 text-zinc-400">
                <Sparkles className="w-3 h-3 text-amber-400" /> Universal Index Active
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
