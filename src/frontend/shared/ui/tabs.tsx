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
          ? 'bg-[#191F1D] backdrop-blur-md border border-[#176B5B]/30'
          : variant === 'pills'
          ? 'bg-[#191F1D]/80 border border-[#176B5B]/25'
          : 'border-b border-[#176B5B]/25 p-0 rounded-none bg-transparent gap-6'
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
                ? 'text-[#F5F5F0] font-semibold'
                : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
            }`}
          >
            {tab.icon && <span className="w-4 h-4 shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50' : 'bg-[#101312] text-[#A6B4AE] border border-[#176B5B]/30'
                }`}
              >
                {tab.count}
              </span>
            )}

            {/* Active Highlight Animation */}
            {isActive && variant !== 'underline' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-[#176B5B]/25 border border-[#176B5B]/60 backdrop-blur-md rounded-lg -z-10 shadow-[0_2px_12px_rgba(23,107,91,0.25)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {isActive && variant === 'underline' && (
              <motion.div
                layoutId="activeUnderlineIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#43D6B0] shadow-[0_0_8px_rgba(67,214,176,0.8)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
