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
          ? 'bg-[#111111]/80 backdrop-blur-md border border-[#2A2A2A]'
          : variant === 'pills'
          ? 'bg-[#111111]/60 border border-[#2A2A2A]'
          : 'border-b border-[#2A2A2A] p-0 rounded-none bg-transparent gap-6'
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
                ? 'text-white font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab.icon && <span className="w-4 h-4 shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive ? 'bg-[#0047AB] text-white border border-[#2563EB]/40' : 'bg-[#181818] text-zinc-400 border border-[#2A2A2A]'
                }`}
              >
                {tab.count}
              </span>
            )}

            {/* Active Highlight Animation */}
            {isActive && variant !== 'underline' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-[#0047AB] border border-[#2563EB]/60 backdrop-blur-md rounded-lg -z-10 shadow-[0_2px_12px_rgba(0,71,171,0.4),inset_0_1px_0_0_rgba(255,255,255,0.25)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {isActive && variant === 'underline' && (
              <motion.div
                layoutId="activeUnderlineIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0047AB] shadow-[0_0_10px_rgba(37,99,235,0.9)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
