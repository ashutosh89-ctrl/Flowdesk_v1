import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  id?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onChange,
  variant = 'glass',
  className = '',
  id = 'tabs',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabElementRef = useRef<HTMLButtonElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 4;
    setCanScrollLeft(hasOverflow && el.scrollLeft > 6);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, items]);

  // Smoothly center the active tab whenever it changes or on initial load
  useEffect(() => {
    if (activeTabElementRef.current && scrollContainerRef.current) {
      const activeEl = activeTabElementRef.current;
      const container = scrollContainerRef.current;
      const targetScrollLeft =
        activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;

      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
      // Re-check scroll state after animation completes
      setTimeout(checkScroll, 350);
    }
  }, [activeTab, checkScroll]);

  const handleScrollBy = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative w-full max-w-full group ${className}`}>
      {/* Left Scroll Indicator Button / Fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pl-0.5 pointer-events-none">
          <div className="h-full w-8 bg-gradient-to-r from-[#101312] via-[#101312]/80 to-transparent flex items-center justify-start">
            <button
              type="button"
              onClick={() => handleScrollBy(-140)}
              className="p-1 rounded-full bg-zinc-900/90 border border-white/20 text-[#43D6B0] shadow-md pointer-events-auto hover:bg-zinc-800 transition-colors"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Right Scroll Indicator Button / Fade */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pr-0.5 pointer-events-none">
          <div className="h-full w-8 bg-gradient-to-l from-[#101312] via-[#101312]/80 to-transparent flex items-center justify-end">
            <button
              type="button"
              onClick={() => handleScrollBy(140)}
              className="p-1 rounded-full bg-zinc-900/90 border border-white/20 text-[#43D6B0] shadow-md pointer-events-auto hover:bg-zinc-800 transition-colors"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="w-full max-w-full overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x py-1"
      >
        <div
          role="tablist"
          className={`inline-flex items-center gap-1 p-1 rounded-xl min-w-max select-none ${
            variant === 'underline'
              ? 'border-b border-white/10 p-0 rounded-none bg-transparent gap-4 sm:gap-6'
              : 'bg-[#131518] border border-white/10 shadow-sm'
          }`}
        >
          {items.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={isActive ? (el) => { activeTabElementRef.current = el; } : undefined}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap rounded-lg select-none z-10 shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon && (
                  <span className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`}>
                    {tab.icon}
                  </span>
                )}
                <span className="shrink-0">{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono font-bold leading-none transition-colors shrink-0 ${
                      isActive
                        ? 'bg-zinc-200 text-zinc-950'
                        : 'bg-white/10 text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}

                {/* Active Solid Black & White Indicator Animation */}
                {isActive && variant !== 'underline' && (
                  <motion.div
                    layoutId={`activeTabIndicator-${id}-${variant}`}
                    className="absolute inset-0 bg-white rounded-lg -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                {isActive && variant === 'underline' && (
                  <motion.div
                    layoutId={`activeUnderlineIndicator-${id}-${variant}`}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Tabs;
