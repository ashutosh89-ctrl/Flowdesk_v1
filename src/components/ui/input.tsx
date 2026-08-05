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
          <label className="text-xs font-medium text-zinc-300 tracking-wide">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {/* Currency Prefix */}
          {isCurrency && (
            <span className="absolute left-3.5 text-zinc-400 text-sm font-medium pointer-events-none">
              {currencySymbol || '$'}
            </span>
          )}

          {/* Left Icon */}
          {!isCurrency && (leftIcon || isSearch) && (
            <span className="absolute left-3.5 text-zinc-400 pointer-events-none flex items-center justify-center">
              {leftIcon || <Search className="w-4 h-4 text-zinc-500" />}
            </span>
          )}

          <input
            ref={ref}
            type={inputType}
            value={value}
            disabled={disabled}
            className={`w-full bg-zinc-900/40 backdrop-blur-md text-zinc-100 text-sm placeholder-zinc-500 border rounded-xl py-2.5 transition-all duration-200 focus:outline-none focus:ring-1 ${
              error
                ? 'border-zinc-500 focus:border-zinc-400 focus:ring-zinc-400'
                : 'border-white/10 hover:border-white/20 focus:border-white/30 focus:ring-white/20'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
              isCurrency ? 'pl-8' : leftIcon || isSearch ? 'pl-10' : 'pl-3.5'
            } ${rightIcon || isPassword || onClear ? 'pr-10' : 'pr-3.5'} ${className}`}
            {...props}
          />

          {/* Right Icon / Actions */}
          <div className="absolute right-3.5 flex items-center gap-1.5 text-zinc-400">
            {value && onClear && (
              <button
                type="button"
                onClick={onClear}
                className="hover:text-white transition-colors p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="hover:text-zinc-200 transition-colors p-0.5"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}

            {!isPassword && rightIcon && <span>{rightIcon}</span>}
          </div>
        </div>

        {error ? (
          <p className="text-xs text-zinc-400 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-zinc-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
