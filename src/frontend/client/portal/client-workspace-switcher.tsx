'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useClientAuth } from '@/frontend/client/auth/client-auth-context';
import { ConnectedFreelancerWorkspace } from '@/shared/types';
import {
  Building2,
  ChevronDown,
  Check,
  Sparkles,
  ExternalLink,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { Avatar } from '@/frontend/shared/ui/avatar';

export const ClientWorkspaceSwitcher: React.FC = () => {
  const { workspaces, activeWorkspace, switchWorkspace, isLoading } = useClientAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!workspaces || workspaces.length === 0) {
    return null;
  }

  const currentStudioName = activeWorkspace?.studioName || activeWorkspace?.freelancerName || 'Workspace';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-medium focus:outline-none focus:ring-1 focus:ring-white/20 ${
          isOpen
            ? 'bg-white/15 border-white/30 text-white shadow-lg'
            : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-white/10 text-zinc-200 hover:border-white/20'
        }`}
        title="Switch Freelancer Workspace"
      >
        <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <Building2 className="w-3 h-3" />
        </div>
        <span className="font-semibold text-white max-w-[130px] sm:max-w-[170px] truncate">
          {currentStudioName}
        </span>
        {workspaces.length > 1 && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
            {workspaces.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 rounded-2xl bg-zinc-950/95 border border-white/15 shadow-2xl backdrop-blur-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                Connected Freelancers
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5">Switch between active studios</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              {workspaces.length} Active
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 py-1 custom-scrollbar">
            {workspaces.map((ws) => {
              const isActive = activeWorkspace?.workspaceId === ws.workspaceId;
              return (
                <button
                  key={ws.workspaceId}
                  type="button"
                  onClick={async () => {
                    setIsOpen(false);
                    if (!isActive) {
                      await switchWorkspace(ws.workspaceId);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl text-left transition-all group ${
                    isActive
                      ? 'bg-white/10 border border-white/15 text-white'
                      : 'hover:bg-white/5 border border-transparent text-zinc-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={ws.avatarUrl}
                      name={ws.studioName || ws.freelancerName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {ws.studioName}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
                        <span>{ws.freelancerName}</span>
                        <span className="text-zinc-600 font-mono">•</span>
                        <span className="font-mono text-[10px] text-zinc-400">{ws.currency}</span>
                      </div>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[10px] font-mono shrink-0">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                      Switch
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/5 px-2 py-1 text-center">
            <p className="text-[10px] text-zinc-400 leading-tight">
              To connect another freelancer, open their permanent link while signed in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
