import React from 'react';
import { LayoutGrid, List, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

export interface FilterBarProps {
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  healthFilter: string;
  onHealthFilterChange: (health: string) => void;
  industryFilter: string;
  onIndustryFilterChange: (industry: string) => void;
  availableIndustries: string[];
  sortBy: 'company' | 'totalBilled' | 'createdAt' | 'activeProjects';
  onSortByChange: (sortBy: 'company' | 'totalBilled' | 'createdAt' | 'activeProjects') => void;
  sortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  onStatusFilterChange,
  healthFilter,
  onHealthFilterChange,
  industryFilter,
  onIndustryFilterChange,
  availableIndustries,
  sortBy,
  onSortByChange,
  sortOrder,
  onToggleSortOrder,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-3 bg-zinc-900/60 border border-white/10 rounded-2xl backdrop-blur-xl">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
        {['all', 'active', 'lead', 'inactive', 'archived'].map((st) => (
          <button
            key={st}
            onClick={() => onStatusFilterChange(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-colors ${
              statusFilter === st
                ? 'bg-white text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Secondary Filters & View Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Health Filter */}
        <div className="flex items-center gap-1.5 bg-zinc-950/70 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px]">Health:</span>
          <select
            value={healthFilter}
            onChange={(e) => onHealthFilterChange(e.target.value)}
            className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs"
          >
            <option value="all" className="bg-zinc-900 text-white">All Health</option>
            <option value="excellent" className="bg-zinc-900 text-white">Excellent</option>
            <option value="healthy" className="bg-zinc-900 text-white">Healthy</option>
            <option value="attention" className="bg-zinc-900 text-white">Needs Attention</option>
            <option value="critical" className="bg-zinc-900 text-white">Critical</option>
          </select>
        </div>

        {/* Industry Filter */}
        {availableIndustries.length > 0 && (
          <div className="flex items-center gap-1.5 bg-zinc-950/70 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400">
            <span className="text-[11px]">Industry:</span>
            <select
              value={industryFilter}
              onChange={(e) => onIndustryFilterChange(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs max-w-[130px] truncate"
            >
              <option value="all" className="bg-zinc-900 text-white">All Industries</option>
              {availableIndustries.map((ind) => (
                <option key={ind} value={ind} className="bg-zinc-900 text-white">
                  {ind}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 bg-zinc-950/70 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400">
          <span className="text-[11px]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as any)}
            className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs"
          >
            <option value="company" className="bg-zinc-900 text-white">Company Name</option>
            <option value="totalBilled" className="bg-zinc-900 text-white">Lifetime Revenue</option>
            <option value="activeProjects" className="bg-zinc-900 text-white">Active Projects</option>
            <option value="createdAt" className="bg-zinc-900 text-white">Date Added</option>
          </select>

          <button
            onClick={onToggleSortOrder}
            title={`Sort Order: ${sortOrder.toUpperCase()}`}
            className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-zinc-950/70 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => onViewModeChange('grid')}
            title="Grid View"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            title="Table View"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'table' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
