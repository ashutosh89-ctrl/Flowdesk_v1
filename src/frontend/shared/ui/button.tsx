import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'icon' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      type = 'button',
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [coords, setCoords] = useState({ x: -1, y: -1 });
    const [isHovered, setIsHovered] = useState(false);
    const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setCoords({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      setCoords({ x: -1, y: -1 });
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { x, y, id }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);

      if (onClick) onClick(e);
    };

    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#43D6B0] focus:ring-offset-2 focus:ring-offset-[#101312] disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl relative overflow-hidden active:scale-[0.98] will-change-transform';

    const sizeStyles = {
      sm: 'px-3.5 py-2 text-sm font-semibold gap-2 min-h-[38px]',
      md: 'px-5 py-2.5 text-[15px] sm:text-base font-semibold gap-2.5 min-h-[44px]',
      lg: 'px-6 py-3.5 text-base sm:text-lg font-bold gap-3 min-h-[52px]',
    };

    const variantStyles = {
      primary:
        'bg-[#43D6B0] text-[#101312] font-semibold border border-[#43D6B0] shadow-[0_4px_20px_rgba(67,214,176,0.3)] hover:bg-[#43D6B0]/90 hover:shadow-[0_8px_28px_rgba(67,214,176,0.45)] hover:-translate-y-[1px]',
      secondary:
        'bg-[#191F1D] text-[#F5F5F0] border border-[#176B5B]/40 shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:bg-[#1E2523] hover:border-[#176B5B]/80 hover:text-white hover:-translate-y-[1px]',
      outline:
        'bg-transparent text-[#F5F5F0] border border-[#176B5B]/40 hover:border-[#43D6B0]/50 hover:bg-[#176B5B]/15 hover:text-white hover:-translate-y-[1px]',
      ghost:
        'bg-transparent text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#176B5B]/15',
      icon:
        'p-2 text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#176B5B]/15 hover:border-[#176B5B]/40 rounded-lg aspect-square',
      danger:
        'bg-rose-950/40 text-rose-200 border border-rose-500/35 hover:border-rose-500 hover:bg-rose-900/60 hover:text-white shadow-sm',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {/* Subtle Cursor Reflection Effect */}
        {isHovered && coords.x >= 0 && (
          <span
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 80px at ${coords.x}px ${coords.y}px, ${
                variant === 'primary' ? 'rgba(67, 214, 176, 0.35)' : 'rgba(23, 107, 91, 0.2)'
              }, transparent 70%)`,
            }}
          />
        )}

        {/* Click Ripples */}
        {ripples.map((r) => (
          <span
            key={r.id}
            className={`absolute rounded-full pointer-events-none animate-ping ${
              variant === 'primary' ? 'bg-white/35' : 'bg-white/25'
            }`}
            style={{
              left: r.x - 20,
              top: r.y - 20,
              width: 40,
              height: 40,
            }}
          />
        ))}

        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current z-10" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 z-10">{leftIcon}</span>
        )}
        {children && <span className="z-10">{children}</span>}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0 z-10">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
