import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export interface PricingPreviewProps {
  onOpenAuth: (view: 'signup') => void;
  onLaunchApp: () => void;
}

export const PricingPreview: React.FC<PricingPreviewProps> = ({ onOpenAuth, onLaunchApp }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Ideal for independent creators starting out.',
      features: [
        'Up to 3 Active Client Workspaces',
        'Unlimited Invoices & Receipts',
        'Standard Client Magic Portals',
        'Document & Contract Repository',
      ],
      cta: 'Start Free',
      variant: 'secondary' as const,
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$29',
      period: 'per month',
      description: 'For established freelancers & solo consultants.',
      features: [
        'Unlimited Client Workspaces',
        'Custom Brand Domain & Logo on Portals',
        'Deliverable Versioning & Token Archives',
        'Priority Activity Logs & Real-time Feeds',
        'Command Palette & Rapid Search',
      ],
      cta: 'Get Pro Access',
      variant: 'primary' as const,
      highlight: true,
    },
    {
      name: 'Studio',
      price: '$79',
      period: 'per month',
      description: 'For small boutique agencies & collectives.',
      features: [
        'Everything in Pro Tier',
        'Multi-member Collaborator Seats',
        'Multi-currency Invoice Settlement',
        'Custom Contract Templates',
        'Dedicated VIP Onboarding Support',
      ],
      cta: 'Join Studio',
      variant: 'secondary' as const,
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none" />

      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Transparent Tiering
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Simple pricing for ambitious freelancers.
        </h2>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Zero commission cuts on your hard-earned client invoices. Choose a tier that fits your growth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch relative z-10">
        {tiers.map((tier, idx) => {
          const isHovered = hoveredIdx === idx;
          const isHighlighted = tier.highlight;

          const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
            const card = e.currentTarget;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotateX = (y - cy) / 20;
            const rotateY = (cx - x) / 20;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
          };

          const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
            const card = e.currentTarget;
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
            setHoveredIdx(null);
          };

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease',
              }}
              className={`pricing-card relative flex flex-col justify-between rounded-2xl p-7 ${
                isHighlighted
                  ? 'bg-zinc-900/90 border-white/30 shadow-[0_20px_60px_-10px_rgba(255,255,255,0.08),0_0_1px_1px_rgba(255,255,255,0.2)] z-10'
                  : 'bg-zinc-950/80 border-white/10 hover:border-white/25 shadow-xl'
              } border backdrop-blur-2xl overflow-hidden`}
            >
              {/* Soft Glass Highlight Beam on Hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none transition-opacity duration-500 ${
                  isHovered || isHighlighted ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Top Popular Badge */}
              {isHighlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-white text-zinc-950 font-bold text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(255,255,255,0.6)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-zinc-950" /> Most Popular
                </div>
              )}

              <div>
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-xl font-bold text-white tracking-tight">{tier.name}</CardTitle>
                  <CardDescription className="text-xs text-zinc-400 mt-1">{tier.description}</CardDescription>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{tier.price}</span>
                    <span className="text-xs font-mono text-zinc-400">{tier.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-0 space-y-3.5 border-t border-white/10 pt-6">
                  {tier.features.map((f, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-3 text-xs text-zinc-300">
                      <div className="w-4 h-4 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="leading-tight">{f}</span>
                    </div>
                  ))}
                </CardContent>
              </div>

              <CardFooter className="p-0 mt-8 pt-6 border-t border-white/10">
                <Button
                  variant={tier.variant}
                  className={`w-full text-xs font-semibold py-2.5 transition-all duration-300 ${
                    isHighlighted
                      ? 'shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]'
                      : ''
                  }`}
                  onClick={onLaunchApp}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />}
                >
                  {tier.cta}
                </Button>
              </CardFooter>
            </div>
          );
        })}
      </div>
    </section>
  );
};

