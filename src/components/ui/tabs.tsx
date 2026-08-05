import React from 'react';
import { motion } from 'motion/react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline' | 'glass';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onChange,
  variant = 'glass',
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-1 p-1 overflow-x-auto no-scrollbar rounded-xl ${
        variant === 'glass'
          ? 'bg-zinc-900/60 backdrop-blur-md border border-white/10'
          : variant === 'pills'
          ? 'bg-zinc-900/40 border border-zinc-800'
          : 'border-b border-white/10 p-0 rounded-none bg-transparent gap-6'
      } ${className}`}
    >
      {items.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-colors duration-200 whitespace-nowrap rounded-lg select-none z-10 ${
              isActive
                ? 'text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.icon && <span className="w-4 h-4 shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {tab.count}
              </span>
            )}

            {/* Active Highlight Animation */}
            {isActive && variant !== 'underline' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-white/10 border border-white/15 backdrop-blur-md rounded-lg -z-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {isActive && variant === 'underline' && (
              <motion.div
                layoutId="activeUnderlineIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
