import React from 'react';
import { LandingNav } from './landing-nav';
import { Hero } from './hero';
import { FeatureShowcase } from './feature-showcase';
import { PricingPreview } from './pricing-preview';
import { LandingFooter } from './landing-footer';

export interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'login' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenAuth }) => {
  return (
    <div className="min-h-screen bg-[#101312] text-[#F5F5F0] selection:bg-[#43D6B0] selection:text-[#101312] font-sans relative overflow-x-hidden">
      <LandingNav onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
      <main className="pt-20 relative z-10">
        <Hero onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />
        <FeatureShowcase />
        <PricingPreview onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
      </main>
      <LandingFooter onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />
    </div>
  );
};
