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
      'inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-1 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl relative overflow-hidden active:scale-[0.98] will-change-transform';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
      md: 'px-4 py-2 text-sm gap-2 min-h-[40px]',
      lg: 'px-6 py-3 text-base gap-2.5 min-h-[48px]',
    };

    const variantStyles = {
      primary:
        'bg-white text-zinc-950 font-semibold border border-white/80 shadow-[0_4px_20px_rgba(255,255,255,0.18),inset_0_1px_0_0_rgba(255,255,255,1)] hover:bg-zinc-100 hover:shadow-[0_8px_28px_rgba(255,255,255,0.3)] hover:-translate-y-[2px]',
      secondary:
        'bg-zinc-950/70 text-zinc-100 border border-white/20 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.2)] hover:bg-zinc-900/90 hover:border-white/35 hover:text-white hover:-translate-y-[2px]',
      outline:
        'bg-transparent text-zinc-200 border border-white/15 hover:border-white/30 hover:bg-white/[0.06] hover:text-white hover:-translate-y-[1px]',
      ghost:
        'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08]',
      icon:
        'p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] rounded-lg aspect-square',
      danger:
        'bg-zinc-900 text-zinc-200 border border-zinc-700/60 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white shadow-sm',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {/* Crystal Glass Cursor Reflection Effect */}
        {isHovered && coords.x >= 0 && (
          <span
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 80px at ${coords.x}px ${coords.y}px, ${
                variant === 'primary' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)'
              }, transparent 70%)`,
            }}
          />
        )}

        {/* Click Ripples */}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute rounded-full pointer-events-none bg-white/25 animate-ping"
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
