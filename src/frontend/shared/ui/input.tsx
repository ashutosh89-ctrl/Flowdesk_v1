import React, { useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  currencySymbol?: string;
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      type = 'text',
      currencySymbol,
      onClear,
      className = '',
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === 'password';
    const isSearch = type === 'search';
    const isCurrency = type === 'currency';

    const inputType = isPassword ? (showPassword ? 'text' : 'password') : isCurrency ? 'number' : type;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-semibold text-zinc-200 tracking-normal">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full group">
          <input
            ref={ref}
            type={inputType}
            value={value}
            disabled={disabled}
            className={`w-full bg-[#111111]/70 backdrop-blur-md text-[#F5F7FA] text-base placeholder-zinc-500 border rounded-xl py-3 transition-all duration-200 focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/25'
                : 'border-[#2A2A2A] hover:border-zinc-500 focus:border-[#2563EB] focus:ring-[#2563EB]/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
              isCurrency ? 'pl-9' : leftIcon || isSearch ? 'pl-11' : 'pl-4'
            } ${rightIcon || isPassword || onClear ? 'pr-11' : 'pr-4'} ${className}`}
            {...props}
          />

          {/* Currency Prefix rendered above input */}
          {isCurrency && (
            <span className="absolute left-3.5 z-20 text-zinc-200 text-base font-semibold pointer-events-none group-focus-within:text-[#3B82F6] transition-colors">
              {currencySymbol || '$'}
            </span>
          )}

          {/* Left Icon with guaranteed z-20 visibility and focus illumination */}
          {!isCurrency && (leftIcon || isSearch) && (
            <span className="absolute left-3.5 z-20 pointer-events-none flex items-center justify-center transition-all duration-200 text-zinc-200 group-focus-within:text-[#3B82F6] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-zinc-200 group-focus-within:[&_svg]:text-[#3B82F6] [&_svg]:stroke-[2] group-focus-within:[&_svg]:drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]">
              {leftIcon || <Search className="w-4 h-4 text-zinc-200 group-focus-within:text-[#3B82F6]" />}
            </span>
          )}

          {/* Right Icon / Actions */}
          <div className="absolute right-3 z-20 flex items-center gap-1.5 text-zinc-300">
            {value && onClear && (
              <button
                type="button"
                aria-label="Clear input"
                onClick={onClear}
                className="hover:text-white transition-colors p-1 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <X className="w-4 h-4 text-zinc-300 hover:text-white" />
              </button>
            )}

            {isPassword && (
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                className="text-zinc-300 hover:text-white transition-colors p-1.5 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:bg-white/10"
              >
                {showPassword ? <EyeOff className="w-4 h-4 text-zinc-300 hover:text-white" /> : <Eye className="w-4 h-4 text-zinc-300 hover:text-white" />}
              </button>
            )}

            {!isPassword && rightIcon && <span className="text-zinc-300">{rightIcon}</span>}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-400 font-medium" role="alert">{error}</p>
        ) : helperText ? (
          <p className="text-sm text-zinc-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
