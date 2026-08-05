import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Activity,
  Settings,
  Plus,
  FileText,
  ArrowRight,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Clients' | 'Invoices' | 'Projects';
  icon: React.ReactNode;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut & navigation listeners
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

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'cmd-dashboard',
        title: 'Dashboard Overview',
        subtitle: 'Mission control & financial summary',
        category: 'Navigation',
        icon: <LayoutDashboard className="w-4 h-4" />,
        action: () => {
          onNavigate('dashboard');
          onClose();
        },
      },
      {
        id: 'cmd-clients',
        title: 'Client Workspaces',
        subtitle: 'Manage client hubs and contacts',
        category: 'Navigation',
        icon: <Users className="w-4 h-4" />,
        action: () => {
          onNavigate('clients');
          onClose();
        },
      },
      {
        id: 'cmd-projects',
        title: 'Projects Engineering',
        subtitle: 'Milestones, budgets & deliverables',
        category: 'Navigation',
        icon: <FolderKanban className="w-4 h-4" />,
        action: () => {
          onNavigate('projects');
          onClose();
        },
      },
      {
        id: 'cmd-invoices',
        title: 'Invoices & Billing',
        subtitle: 'Track payment status and settlements',
        category: 'Navigation',
        icon: <Receipt className="w-4 h-4" />,
        action: () => {
          onNavigate('invoices');
          onClose();
        },
      },
      {
        id: 'cmd-activity',
        title: 'Activity & Audit Trail',
        subtitle: 'Chronological events and client view logs',
        category: 'Navigation',
        icon: <Activity className="w-4 h-4" />,
        action: () => {
          onNavigate('activity');
          onClose();
        },
      },
      {
        id: 'cmd-settings',
        title: 'Studio Settings',
        subtitle: 'Preferences, profile, and security',
        category: 'Navigation',
        icon: <Settings className="w-4 h-4" />,
        action: () => {
          onNavigate('settings');
          onClose();
        },
      },
      {
        id: 'cmd-client-apex',
        title: 'Apex Labs Workspace',
        subtitle: 'Enterprise Client • Health 98/100',
        category: 'Clients',
        icon: <Users className="w-4 h-4 text-white" />,
        action: () => {
          onNavigate('clients');
          onClose();
        },
      },
      {
        id: 'cmd-client-monolith',
        title: 'Monolith Ventures Workspace',
        subtitle: 'Enterprise Client • Pending Invoice #002',
        category: 'Clients',
        icon: <Users className="w-4 h-4 text-white" />,
        action: () => {
          onNavigate('clients');
          onClose();
        },
      },
      {
        id: 'cmd-new-client',
        title: 'Create New Client Workspace',
        subtitle: 'Onboard a new client into FlowDesk',
        category: 'Actions',
        icon: <Plus className="w-4 h-4 text-emerald-400" />,
        action: () => {
          onNavigate('clients');
          onClose();
        },
      },
      {
        id: 'cmd-new-invoice',
        title: 'Generate New Invoice',
        subtitle: 'Create line items and request payment',
        category: 'Actions',
        icon: <FileText className="w-4 h-4 text-white" />,
        action: () => {
          onNavigate('invoices');
          onClose();
        },
      },
    ],
    [onNavigate, onClose]
  );

  const filteredCommands = useMemo(
    () =>
      commands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query.toLowerCase()) ||
          (cmd.subtitle && cmd.subtitle.toLowerCase().includes(query.toLowerCase())) ||
          cmd.category.toLowerCase().includes(query.toLowerCase())
      ),
    [commands, query]
  );

  // Handle arrow key navigation & Enter key execution inside search box
  const handleKeyDownInMenu = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 select-none">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="relative w-full max-w-2xl bg-zinc-950/95 border border-white/20 backdrop-blur-3xl rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden z-10 flex flex-col"
          >
            {/* Input Bar */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-white/[0.02]">
              <Search className="w-5 h-5 text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onKeyDown={handleKeyDownInMenu}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command or search client, project, invoice..."
                className="w-full bg-transparent text-white text-base placeholder-zinc-500 focus:outline-none"
              />
              <button
                onClick={onClose}
                className="px-2 py-1 text-[10px] font-mono text-zinc-400 bg-white/10 border border-white/15 rounded-md hover:bg-white/20 transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Results Stream */}
            <div className="p-2 max-h-[360px] overflow-y-auto space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                  No matching workspace results for &quot;{query}&quot;
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-white/10 border border-white/20 text-white shadow-md'
                          : 'bg-transparent text-zinc-300 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-white text-zinc-950' : 'bg-white/10 text-zinc-300 border border-white/10'
                          }`}
                        >
                          {cmd.icon}
                        </div>
                        <div>
                          <p className="text-xs font-bold tracking-tight text-white">{cmd.title}</p>
                          {cmd.subtitle && <p className="text-[10px] text-zinc-400">{cmd.subtitle}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                          {cmd.category}
                        </span>
                        {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Footer Navigation Hint */}
            <div className="p-3 px-4 border-t border-white/10 bg-zinc-950 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>ESC Close</span>
              </div>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-white" /> FlowDesk OS Core
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

