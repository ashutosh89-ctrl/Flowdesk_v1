import React from 'react';
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
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-1 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl relative overflow-hidden active:scale-[0.98]';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
      md: 'px-4 py-2 text-sm gap-2 min-h-[40px]',
      lg: 'px-6 py-3 text-base gap-2.5 min-h-[48px]',
    };

    const variantStyles = {
      primary:
        'bg-white text-zinc-950 font-semibold border border-white/80 shadow-[0_4px_20px_rgba(255,255,255,0.15),inset_0_1px_0_0_rgba(255,255,255,1)] hover:bg-zinc-100 hover:shadow-[0_6px_24px_rgba(255,255,255,0.25)]',
      secondary:
        'bg-white/[0.07] text-zinc-100 border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] hover:bg-white/[0.12] hover:border-white/20 hover:text-white',
      outline:
        'bg-transparent text-zinc-200 border border-white/15 hover:border-white/30 hover:bg-white/[0.04] hover:text-white',
      ghost:
        'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]',
      icon:
        'p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] rounded-lg aspect-square',
      danger:
        'bg-zinc-900 text-zinc-200 border border-zinc-700/60 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white shadow-sm',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
