import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'crystal' | 'subtle' | 'outline' | 'flat';
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'crystal', interactive = false, className = '', ...props }, ref) => {
    const variantStyles = {
      crystal:
        'bg-[#191F1D] backdrop-blur-xl border border-[#176B5B]/30 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.6)] relative overflow-hidden',
      subtle: 'bg-[#191F1D]/80 border border-[#176B5B]/25 backdrop-blur-md',
      outline: 'bg-transparent border border-[#176B5B]/30',
      flat: 'bg-[#191F1D] border border-[#176B5B]/30',
    };

    const interactiveStyles = interactive
      ? 'cursor-pointer hover:border-[#43D6B0]/50 hover:bg-[#1E2523] hover:shadow-[0_16px_40px_-10px_rgba(23,107,91,0.2)] transition-all duration-200 hover:-translate-y-0.5'
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
  <h3 className={`text-xl sm:text-2xl font-bold font-display text-[#F5F5F0] tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-base text-[#A6B4AE] font-normal ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`space-y-4 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`mt-6 pt-4 border-t border-[#176B5B]/20 flex items-center justify-between ${className}`}>
    {children}
  </div>
);
