import React from 'react';

export interface ProgressProps {
  value: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-medium text-zinc-400">
          <span>Progress</span>
          <span className="text-white font-semibold">{clampedValue}%</span>
        </div>
      )}
      <div className={`w-full bg-zinc-900 border border-white/10 rounded-full overflow-hidden p-0.5 ${heightStyles[size]}`}>
        <div
          className="bg-white h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
