import React from 'react';

export interface ProgressProps {
  value: number; // 0 to 100
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  size = 'md',
  showLabel = false,
  label = 'Progress',
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

  const sizeStyles = {
    xs: { track: 'h-1.5 p-[1px]', indicator: 'w-1', marker: 'h-1' },
    sm: { track: 'h-2 p-[1px]', indicator: 'w-1.5', marker: 'h-1.5' },
    md: { track: 'h-2.5 p-[2px]', indicator: 'w-2', marker: 'h-2' },
    lg: { track: 'h-3.5 p-[2px]', indicator: 'w-2.5', marker: 'h-2.5' },
  };

  const isComplete = clampedValue >= 100;

  return (
    <div className={`w-full flex flex-col gap-1.5 select-none ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400 font-medium tracking-wide">{label}</span>
          <span className={`font-mono font-bold ${isComplete ? 'text-[#43D6B0]' : 'text-white'}`}>
            {clampedValue}%
          </span>
        </div>
      )}

      {/* Unique Designy Track with Micro Calibration Ticks */}
      <div
        className={`relative w-full bg-[#121417] border border-white/10 rounded-full overflow-hidden ${sizeStyles[size].track}`}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Subtle Calibration Markers at 25%, 50%, 75% */}
        <div className="absolute inset-0 flex justify-between px-[25%] pointer-events-none z-10 opacity-30">
          <div className="w-[1px] h-full bg-white/40" />
          <div className="w-[1px] h-full bg-white/40" />
        </div>
        <div className="absolute left-[50%] top-0 bottom-0 w-[1px] bg-white/30 pointer-events-none z-10 opacity-40" />

        {/* Solid Neon Mint Fill without Gradients */}
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out relative ${
            isComplete ? 'bg-[#43D6B0]' : 'bg-[#43D6B0]'
          }`}
          style={{ width: `${clampedValue}%` }}
        >
          {/* Designy High-Precision White Terminal Cap (Visible when > 0 and < 100) */}
          {clampedValue > 0 && clampedValue < 100 && (
            <span
              className={`absolute right-0 top-0 bottom-0 bg-white rounded-full shadow-[0_0_8px_#43D6B0] ${sizeStyles[size].indicator}`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Progress;
