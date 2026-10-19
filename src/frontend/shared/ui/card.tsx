import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'crystal' | 'subtle' | 'outline' | 'flat';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'crystal', interactive = false, className = '', ...props }, ref) => {
    const variantStyles = {
      crystal:
        'bg-[#111111]/85 backdrop-blur-xl border border-[#2A2A2A] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.06)] relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.04] before:to-transparent before:pointer-events-none',
      subtle: 'bg-[#111111]/60 border border-[#2A2A2A]/70 backdrop-blur-md',
      outline: 'bg-transparent border border-[#2A2A2A]',
      flat: 'bg-[#111111] border border-[#2A2A2A]',
    };

    const interactiveStyles = interactive
      ? 'cursor-pointer hover:border-[#2563EB]/40 hover:bg-[#181818] hover:shadow-[0_16px_40px_-10px_rgba(0,71,171,0.25)] transition-all duration-200 hover:-translate-y-0.5'
      : '';

    return (
      <div
        ref={ref}
        className={`rounded-2xl p-6 ${variantStyles[variant]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-col gap-1 mb-4 ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold text-white tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-sm text-zinc-400 ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`space-y-4 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mt-6 pt-4 border-t border-white/5 flex items-center justify-between ${className}`}>
    {children}
  </div>
);
