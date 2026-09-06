import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'outline' | 'subtle' | 'muted';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'subtle',
  size = 'sm',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
  };

  const variantStyles = {
    solid: 'bg-white text-zinc-950 shadow-sm font-semibold',
    outline: 'border border-white/20 text-zinc-200 bg-transparent',
    subtle: 'bg-white/10 text-zinc-200 border border-white/10 backdrop-blur-xs',
    muted: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md whitespace-nowrap tracking-wide ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
