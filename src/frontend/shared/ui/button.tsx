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
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#43D6B0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312] disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl relative overflow-hidden active:scale-[0.98] motion-reduce:transform-none';

    const sizeStyles = {
      sm: 'px-3.5 py-2 text-sm font-semibold gap-2 min-h-[38px]',
      md: 'px-5 py-2.5 text-[15px] sm:text-base font-semibold gap-2.5 min-h-[44px]',
      lg: 'px-6 py-3.5 text-base sm:text-lg font-bold gap-3 min-h-[52px]',
    };

    const variantStyles = {
      primary:
        'bg-[#43D6B0] text-[#101312] font-semibold border border-[#43D6B0] shadow-sm hover:bg-[#43D6B0]/90 hover:shadow active:bg-[#38b796]',
      secondary:
        'bg-[#191F1D] text-[#F5F5F0] border border-[#176B5B]/40 shadow-sm hover:bg-[#1E2523] hover:border-[#176B5B]/80 hover:text-white',
      outline:
        'bg-transparent text-[#F5F5F0] border border-[#176B5B]/40 hover:border-[#43D6B0]/50 hover:bg-[#176B5B]/15 hover:text-white',
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
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
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
