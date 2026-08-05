import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center gap-1.5 text-xs text-zinc-400 ${className}`}>
      <span className="flex items-center gap-1 text-zinc-500">
        <Home className="w-3.5 h-3.5" />
      </span>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          {item.active ? (
            <span className="font-semibold text-white tracking-wide">{item.label}</span>
          ) : (
            <button
              type="button"
              onClick={item.onClick}
              className="hover:text-zinc-200 transition-colors"
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
