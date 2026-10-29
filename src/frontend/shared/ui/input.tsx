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
          <label className="text-sm font-semibold text-[#F5F5F0] tracking-normal">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full group">
          <input
            ref={ref}
            type={inputType}
            value={value}
            disabled={disabled}
            className={`w-full bg-[#191F1D]/80 backdrop-blur-md text-[#F5F5F0] text-base placeholder-[#A6B4AE]/60 border rounded-xl py-3 transition-all duration-200 focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/25'
                : 'border-[#176B5B]/35 hover:border-[#176B5B]/70 focus:border-[#43D6B0] focus:ring-[#43D6B0]/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
              isCurrency ? 'pl-9' : leftIcon || isSearch ? 'pl-11' : 'pl-4'
            } ${rightIcon || isPassword || onClear ? 'pr-11' : 'pr-4'} ${className}`}
            {...props}
          />

          {/* Currency Prefix rendered above input */}
          {isCurrency && (
            <span className="absolute left-3.5 z-20 text-[#A6B4AE] text-base font-semibold pointer-events-none group-focus-within:text-[#43D6B0] transition-colors">
              {currencySymbol || '$'}
            </span>
          )}

          {/* Left Icon */}
          {!isCurrency && (leftIcon || isSearch) && (
            <span className="absolute left-3.5 z-20 pointer-events-none flex items-center justify-center transition-colors duration-150 text-[#A6B4AE] group-focus-within:text-[#43D6B0] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-[#A6B4AE] group-focus-within:[&_svg]:text-[#43D6B0] [&_svg]:stroke-[2]">
              {leftIcon || <Search className="w-4 h-4 text-[#A6B4AE] group-focus-within:text-[#43D6B0]" />}
            </span>
          )}

          {/* Right Icon / Actions */}
          <div className="absolute right-3 z-20 flex items-center gap-1.5 text-[#A6B4AE]">
            {value && onClear && (
              <button
                type="button"
                aria-label="Clear input"
                onClick={onClear}
                className="hover:text-[#F5F5F0] transition-colors p-1 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-[#43D6B0]/50"
              >
                <X className="w-4 h-4 text-[#A6B4AE] hover:text-[#F5F5F0]" />
              </button>
            )}

            {isPassword && (
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#A6B4AE] hover:text-[#F5F5F0] transition-colors p-1.5 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-[#43D6B0]/50 focus-visible:bg-[#176B5B]/20"
              >
                {showPassword ? <EyeOff className="w-4 h-4 text-[#A6B4AE] hover:text-[#F5F5F0]" /> : <Eye className="w-4 h-4 text-[#A6B4AE] hover:text-[#F5F5F0]" />}
              </button>
            )}

            {!isPassword && rightIcon && <span className="text-[#A6B4AE]">{rightIcon}</span>}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-rose-400 font-medium" role="alert">{error}</p>
        ) : helperText ? (
          <p className="text-sm text-[#A6B4AE]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
